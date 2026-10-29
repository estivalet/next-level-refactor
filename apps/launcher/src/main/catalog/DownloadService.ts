import {
  AppErrorException,
  ERROR_CODES,
  type DownloadFailure,
  type DownloadGrant,
  type DownloadSummary,
  type PausedReason,
} from '@nextlevel/shared';
import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { mkdir, rm, stat, statfs } from 'node:fs/promises';
import { join } from 'node:path';
import { pipeline } from 'node:stream/promises';
import type { EmitEvent } from '../ipc/events.ts';
import {
  toSummary,
  type DownloadRepository,
  type DownloadRow,
} from '../library/DownloadRepository.ts';
import type { CatalogClient } from './CatalogClient.ts';
import { DiskWriteError, downloadFile } from './downloadFile.ts';
import type { ItemLocks } from './itemLocks.ts';
import type { ItemInstaller, VerifiedFile } from './types.ts';

export interface DownloadLog {
  info(context: Record<string, unknown>, msg: string): void;
  warn(context: object, msg: string): void;
  error(context: Record<string, unknown>, msg: string): void;
}

export interface DownloadDeps {
  repo: DownloadRepository;
  catalog: Pick<CatalogClient, 'get' | 'downloads'>;
  installer: ItemInstaller;
  /** `<data>\downloads`: one folder of `.part` files per download. */
  dir: string;
  fetch: typeof fetch;
  freeSpace?: (dir: string) => Promise<number>;
  emit: EmitEvent;
  log: DownloadLog;
  clock: () => Date;
  newId: () => string;
  locks: ItemLocks;
}

/** Why the running download was aborted: pause and cancel by the player, quit by the app. */
type Stop = 'pause' | 'cancel' | 'quit';

const PROGRESS_MS = 250;

const diskFree = async (dir: string) => {
  const info = await statfs(dir);
  return info.bavail * info.bsize;
};

async function partSize(path: string): Promise<number> {
  try {
    return (await stat(path)).size;
  } catch {
    return 0;
  }
}

async function sha256Of(path: string): Promise<string> {
  const hash = createHash('sha256');
  await pipeline(createReadStream(path), hash);
  return hash.digest('hex');
}

/**
 * The catalog download queue (FR-CAT-4, D47, Review Focus 3): one download at a time, oldest
 * first; partial files resume with Range after a restart; an expired URL is asked for once more;
 * every file is checked against its size and SHA-256 (C9) before the installer gets it. Logs
 * carry ids and reasons, never a URL.
 */
export class DownloadService {
  readonly #deps: DownloadDeps;
  #running: { id: string; controller: AbortController } | null = null;
  #loop: Promise<void> | null = null;
  readonly #lastProgress = new Map<string, number>();
  #disposed = false;

  constructor(deps: DownloadDeps) {
    this.#deps = deps;
  }

  /** At boot: downloads cut off by quitting, or waiting for the network, run again. */
  start(): void {
    this.#deps.repo.requeueInterrupted(this.#now());
    this.networkBack();
  }

  /** Resolves when the queue has nothing it can run (tests). */
  async idle(): Promise<void> {
    while (this.#loop) await this.#loop;
  }

  list(): DownloadSummary[] {
    return this.#deps.repo.list().map(toSummary);
  }

  /** Queues the item's current version (Install or Update, D42); an active download is reused. */
  async install(itemId: string): Promise<DownloadSummary> {
    const active = this.#deps.repo.activeFor(itemId);
    if (active) return toSummary(active);
    const item = await this.#deps.catalog.get(itemId);
    const failed = this.#deps.repo.failedFor(itemId);
    if (failed?.version === item.version) {
      await this.resume(failed.id);
      return toSummary(this.#row(failed.id));
    }
    if (failed) await this.#discard(failed.id);
    const row = this.#deps.repo.enqueue(this.#deps.newId(), item, this.#now());
    this.#progress(row, row.bytesDone, true);
    this.#kick();
    return toSummary(row);
  }

  async pause(id: string): Promise<void> {
    const row = this.#row(id);
    if (this.#running?.id === id) {
      this.#running.controller.abort('pause' satisfies Stop);
      return;
    }
    if (row.state !== 'queued') return;
    this.#set(row, { state: 'paused', pausedReason: 'user' });
    await Promise.resolve();
  }

  async resume(id: string): Promise<void> {
    const row = this.#row(id);
    if (row.state !== 'paused' && row.state !== 'failed') return;
    this.#set(row, { state: 'queued', pausedReason: null, error: null });
    this.#kick();
    await Promise.resolve();
  }

  async cancel(id: string): Promise<void> {
    const row = this.#row(id);
    if (this.#running?.id === id) {
      this.#running.controller.abort('cancel' satisfies Stop);
      await this.idle();
      return;
    }
    await this.#discard(id);
    this.#deps.emit('downloads.finished', {
      downloadId: id,
      itemId: row.itemId,
      result: 'cancelled',
    });
  }

  /** The network or the session is back: downloads that paused for it continue. */
  networkBack(): void {
    for (const row of this.#deps.repo.list()) {
      if (row.state === 'paused' && row.pausedReason !== 'user') {
        this.#deps.repo.update(row.id, { state: 'queued', pausedReason: null }, this.#now());
      }
    }
    this.#kick();
  }

  /** Quitting: the running download stays `downloading`, so the next start resumes it. */
  dispose(): void {
    this.#disposed = true;
    this.#running?.controller.abort('quit' satisfies Stop);
  }

  #kick(): void {
    if (this.#loop || this.#disposed) return;
    this.#loop = (async () => {
      for (let row = this.#deps.repo.next(); row && !this.#disposed; row = this.#deps.repo.next()) {
        await this.#run(row);
      }
    })().finally(() => {
      this.#loop = null;
    });
  }

  async #run(row: DownloadRow): Promise<void> {
    const controller = new AbortController();
    this.#running = { id: row.id, controller };
    try {
      await this.#download(row, controller.signal);
    } catch (error) {
      const stop = controller.signal.aborted ? (controller.signal.reason as Stop) : null;
      if (stop === 'quit') return;
      if (stop === 'cancel') {
        await this.#discard(row.id);
        this.#deps.emit('downloads.finished', {
          downloadId: row.id,
          itemId: row.itemId,
          result: 'cancelled',
        });
        return;
      }
      if (stop === 'pause') {
        this.#pause(row, 'user');
        return;
      }
      if (error instanceof DiskWriteError) {
        this.#fail(row, 'write', { code: error.code });
        return;
      }
      this.#deps.log.error(
        { downloadId: row.id, itemId: row.itemId, error },
        'catalog download broke',
      );
      this.#fail(row, 'network');
    } finally {
      this.#running = null;
      this.#lastProgress.delete(row.id);
    }
  }

  async #download(row: DownloadRow, signal: AbortSignal): Promise<void> {
    const folder = join(this.#deps.dir, row.id);
    await mkdir(folder, { recursive: true });
    const part = (fileId: string) => join(folder, `${fileId}.part`);
    const sizes = await Promise.all(row.item.files.map((file) => partSize(part(file.id))));
    let done = sizes.reduce(
      (sum, size, i) => sum + Math.min(size, row.item.files[i]?.size ?? 0),
      0,
    );
    this.#set(row, { state: 'downloading', pausedReason: null, error: null, bytesDone: done });
    const free = await (this.#deps.freeSpace ?? diskFree)(this.#deps.dir);
    if (free < row.bytesTotal - done) {
      this.#fail(row, 'diskFull');
      return;
    }
    let grant = await this.#grant(row);
    if (!grant) return;
    for (const file of row.item.files) {
      let renewed = false;
      for (;;) {
        const url = grant.files.find((issued) => issued.fileId === file.id)?.url;
        if (!url) {
          this.#fail(row, 'refused');
          return;
        }
        const result = await downloadFile({
          url,
          part: part(file.id),
          expectedSize: file.size,
          fetch: this.#deps.fetch,
          signal,
          onBytes: (count) => {
            done += count;
            this.#progress({ ...row, state: 'downloading' }, done, false);
          },
        });
        if (result === 'done') break;
        if (result === 'network') {
          this.#deps.repo.update(row.id, { bytesDone: done }, this.#now());
          this.#pause(row, 'network');
          return;
        }
        if (renewed) {
          this.#fail(row, 'refused');
          return;
        }
        renewed = true;
        grant = await this.#grant(row);
        if (!grant) return;
      }
    }
    const verified = await this.#verify(row, part);
    if (!verified) return;
    this.#progress({ ...row, state: 'downloading' }, row.bytesTotal, true);
    try {
      await this.#deps.locks.run(row.itemId, () =>
        this.#deps.installer.install(row.item, verified),
      );
    } catch (error) {
      this.#deps.log.error(
        { downloadId: row.id, itemId: row.itemId, error },
        'catalog install failed',
      );
      this.#fail(row, 'write');
      return;
    }
    await rm(folder, { recursive: true, force: true });
    this.#deps.repo.delete(row.id);
    this.#deps.emit('downloads.finished', {
      downloadId: row.id,
      itemId: row.itemId,
      result: 'installed',
    });
  }

  /** Size and SHA-256 of every part (C9); a mismatching one is deleted. */
  async #verify(row: DownloadRow, part: (fileId: string) => string) {
    const verified: VerifiedFile[] = [];
    for (const file of row.item.files) {
      const path = part(file.id);
      const size = await partSize(path);
      const sha256 = size === file.size ? await sha256Of(path) : '';
      if (sha256 !== file.sha256) {
        await rm(path, { force: true });
        this.#fail(row, 'checksum', { fileId: file.id });
        return null;
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
    return verified;
  }

  /** Signed URLs; no API pauses (offline), a refusal fails (refused). */
  async #grant(row: DownloadRow): Promise<DownloadGrant | null> {
    try {
      return await this.#deps.catalog.downloads(row.itemId);
    } catch (error) {
      if (error instanceof AppErrorException && error.error.code === 'API_UNREACHABLE') {
        this.#pause(row, 'offline');
        return null;
      }
      const code = error instanceof AppErrorException ? error.error.code : 'INTERNAL';
      this.#fail(row, 'refused', { code });
      return null;
    }
  }

  #pause(row: DownloadRow, reason: PausedReason): void {
    this.#deps.log.info(
      { downloadId: row.id, itemId: row.itemId, reason },
      'catalog download paused',
    );
    this.#set(row, { state: 'paused', pausedReason: reason });
  }

  #fail(row: DownloadRow, reason: DownloadFailure, context: Record<string, unknown> = {}): void {
    this.#deps.log.warn(
      { downloadId: row.id, itemId: row.itemId, reason, ...context },
      'catalog download failed',
    );
    this.#set(row, { state: 'failed', error: reason, pausedReason: null });
    this.#deps.emit('downloads.finished', {
      downloadId: row.id,
      itemId: row.itemId,
      result: 'failed',
      error: reason,
    });
  }

  #set(row: DownloadRow, patch: Parameters<DownloadRepository['update']>[1]): void {
    this.#deps.repo.update(row.id, patch, this.#now());
    const next = this.#row(row.id);
    this.#progress(next, next.bytesDone, true);
  }

  /** At most 4 a second per download, unless `force` (a state change). */
  #progress(row: DownloadRow, bytesDone: number, force: boolean): void {
    const now = this.#deps.clock().getTime();
    const last = this.#lastProgress.get(row.id);
    if (!force && last !== undefined && now - last < PROGRESS_MS) return;
    this.#lastProgress.set(row.id, now);
    this.#deps.emit('downloads.progress', {
      downloadId: row.id,
      itemId: row.itemId,
      bytesDone,
      bytesTotal: row.bytesTotal,
      state: row.state,
    });
  }

  async #discard(id: string): Promise<void> {
    await rm(join(this.#deps.dir, id), { recursive: true, force: true });
    this.#deps.repo.delete(id);
  }

  #row(id: string): DownloadRow {
    const row = this.#deps.repo.get(id);
    if (!row) throw new AppErrorException({ code: 'NOT_FOUND', message: ERROR_CODES.NOT_FOUND });
    return row;
  }

  #now(): string {
    return this.#deps.clock().toISOString();
  }
}
