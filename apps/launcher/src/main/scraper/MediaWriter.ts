import { AppErrorException, ERROR_CODES, type GameArtKind } from '@nextlevel/shared';
import { randomUUID } from 'node:crypto';
import { mkdir, readdir, rename, rm, rmdir, stat, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { targetExtension } from './screenscraper/mediaSelect.ts';

export interface MediaWriterDeps {
  /** Re-encodes an image as PNG (`nativeImage` in production); null = cannot decode it. */
  toPng: (bytes: Buffer) => Buffer | null;
}

export interface WrittenMedia {
  path: string;
  size: number;
  /** The file's mtime in ms, as the scan reads it (`game_media.version`). */
  version: number;
}

export interface WriteResult extends WrittenMedia {
  /** Paths the new file replaced: the target itself and deleted same-stem siblings. */
  replaced: string[];
}

/** Temp files live beside the kind folders; the scan skips it (not a valid kind name). */
export const MEDIA_TMP_DIR = '.nextlevel-tmp';

const invalidStem = (stem: string) =>
  new AppErrorException({
    code: 'VALIDATION_FAILED',
    message: ERROR_CODES.VALIDATION_FAILED,
    details: { stem },
  });

const stemOf = (name: string) => {
  const dot = name.lastIndexOf('.');
  return dot <= 0 ? name : name.slice(0, dot);
};
const sameStem = (a: string, b: string) =>
  a.normalize('NFC').toLowerCase() === b.normalize('NFC').toLowerCase();

const TEMP_TRIES = 3;

/**
 * Another write removes the shared temp folder once it is empty, possibly between this write's
 * mkdir and its writeFile (ENOENT); the folder is then made again.
 */
async function writeTemp(tmpDir: string, tmp: string, data: Buffer): Promise<void> {
  for (let attempt = 1; ; attempt += 1) {
    await mkdir(tmpDir, { recursive: true });
    try {
      await writeFile(tmp, data);
      return;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT' || attempt >= TEMP_TRIES) throw error;
    }
  }
}

/**
 * Writes scraped media in the formats NextLevelOS loads (FR-SCR-4, D17): images as `.png`
 * (transcoded unless already PNG), JPEG fanart as `.jpg`, video as `.mp4`. The file is written to
 * `<dir>/.nextlevel-tmp/` and renamed into `<dir>/<kind>/<stem><ext>`, so a failure never leaves
 * a partial file; only then are other files with the same stem in that kind folder deleted.
 */
export class MediaWriter {
  constructor(private readonly deps: MediaWriterDeps) {}

  private encode(bytes: Buffer, format: string, ext: string): Buffer {
    const source = format.replace(/^\./, '').toLowerCase();
    if (ext !== '.png' || source === 'png') return bytes;
    return this.deps.toPng(bytes) ?? bytes;
  }

  async write(
    dir: string,
    kind: GameArtKind,
    stem: string,
    bytes: Buffer,
    format: string,
  ): Promise<WriteResult> {
    if (stem === '' || stem === '.' || stem === '..' || /[\\/]/.test(stem)) {
      throw invalidStem(stem);
    }
    const ext = targetExtension(kind, format);
    const data = this.encode(bytes, format, ext);
    const kindDir = join(dir, kind);
    const target = join(kindDir, `${stem}${ext}`);
    const tmpDir = join(dir, MEDIA_TMP_DIR);
    const tmp = join(tmpDir, `${randomUUID()}${ext}`);
    try {
      await mkdir(kindDir, { recursive: true });
      await writeTemp(tmpDir, tmp, data);
      await rename(tmp, target);
    } catch (error) {
      await rm(tmp, { force: true }).catch(() => undefined);
      throw error;
    } finally {
      // Only removed when empty: another write may be using it.
      await rmdir(tmpDir).catch(() => undefined);
    }
    const written = `${stem}${ext}`;
    const replaced = [target];
    for (const name of await readdir(kindDir)) {
      if (name !== written && sameStem(stemOf(name), stem)) {
        const sibling = join(kindDir, name);
        await rm(sibling, { force: true }).then(
          () => replaced.push(sibling),
          () => undefined,
        );
      }
    }
    const info = await stat(target);
    return { path: target, size: info.size, version: Math.trunc(info.mtimeMs), replaced };
  }
}
