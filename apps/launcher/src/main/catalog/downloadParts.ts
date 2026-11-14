import { AppErrorException, type CatalogItem } from '@nextlevel/shared';
import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { readdir, rm, stat, statfs } from 'node:fs/promises';
import { join } from 'node:path';
import { pipeline } from 'node:stream/promises';
import type { DownloadDeps, VerifiedFile } from './types.ts';

// The download queue's files on disk (FR-CAT-4): part sizes and checksums, and the folders of
// downloads that no longer exist.

/** What an API file id may look like before it becomes a file name. */
export const SAFE_ID = /^[A-Za-z0-9-]{1,64}$/;

export const diskFree = async (dir: string) => {
  const info = await statfs(dir);
  return info.bavail * info.bsize;
};

export async function partSize(path: string): Promise<number> {
  try {
    return (await stat(path)).size;
  } catch {
    return 0;
  }
}

export async function sha256Of(path: string, signal: AbortSignal): Promise<string> {
  const hash = createHash('sha256');
  await pipeline(createReadStream(path), hash, { signal });
  return hash.digest('hex');
}

/** Size and SHA-256 of every part (C9); the first mismatching one is deleted and named. */
export async function verifyParts(
  files: CatalogItem['files'],
  part: (fileId: string) => string,
  hash: (path: string, signal: AbortSignal) => Promise<string>,
  signal: AbortSignal,
): Promise<{ verified: VerifiedFile[] } | { mismatch: string }> {
  const verified: VerifiedFile[] = [];
  for (const file of files) {
    const path = part(file.id);
    const size = await partSize(path);
    const sha256 = size === file.size ? await hash(path, signal) : '';
    if (sha256 !== file.sha256) {
      await rm(path, { force: true });
      return { mismatch: file.id };
    }
    verified.push({
      fileId: file.id,
      filename: file.filename,
      role: file.role,
      path,
      size,
      sha256,
    });
  }
  return { verified };
}

type FolderDeps = Pick<DownloadDeps, 'dir' | 'log' | 'removeDir'>;

/** A folder that can't be deleted (held by a virus scanner) is logged; start() sweeps it. */
export async function removeFolder(deps: FolderDeps, id: string): Promise<void> {
  const remove = deps.removeDir ?? ((path: string) => rm(path, { recursive: true, force: true }));
  try {
    await remove(join(deps.dir, id));
  } catch (error) {
    deps.log.warn({ downloadId: id, error }, 'download folder could not be removed');
  }
}

/** Removes the download folders no row points at (a cancel whose delete failed, a crash). */
export async function sweepFolders(deps: FolderDeps, wanted: ReadonlySet<string>): Promise<void> {
  try {
    const entries = await readdir(deps.dir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory() && !wanted.has(entry.name)) await removeFolder(deps, entry.name);
    }
  } catch (error) {
    deps.log.warn({ error }, 'download folders could not be checked');
  }
}

/**
 * Rows whose stored item no longer parses (written by an older launcher): the API's copy of the
 * same version replaces it and the parts are kept (verify still checks them); an item that
 * changed version or left the catalog is dropped; without the API the row waits untouched.
 */
export async function repairUnreadable(
  deps: Pick<DownloadDeps, 'repo' | 'catalog' | 'log' | 'clock'>,
  discard: (id: string) => Promise<void>,
): Promise<void> {
  const now = () => deps.clock().toISOString();
  for (const row of deps.repo.unreadable()) {
    let item: CatalogItem | null;
    try {
      item = await deps.catalog.get(row.itemId);
    } catch (error) {
      if (!(error instanceof AppErrorException) || error.error.code !== 'NOT_FOUND') continue;
      item = null;
    }
    const repaired = item?.version === row.version;
    deps.log.warn(
      { downloadId: row.id, itemId: row.itemId, repaired },
      'catalog download unreadable',
    );
    if (item && repaired) {
      deps.repo.replaceItem(row.id, item, now());
      // It waited for the network while unreadable: the API just answered, so it runs again.
      const fixed = deps.repo.get(row.id);
      if (fixed?.state === 'paused' && fixed.pausedReason !== 'user') {
        deps.repo.update(row.id, { state: 'queued', pausedReason: null }, now());
      }
    } else await discard(row.id);
  }
}

/**
 * The item as the catalog has it now: art URLs live an hour, and a download can take longer
 * (or wait days paused). Files and version stay the ones downloaded; offline, the stored item.
 */
export async function freshItem(
  catalog: DownloadDeps['catalog'],
  stored: CatalogItem,
): Promise<CatalogItem> {
  try {
    const now = await catalog.get(stored.id);
    return { ...now, files: stored.files, version: stored.version, size: stored.size };
  } catch {
    return stored;
  }
}
