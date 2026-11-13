import { createHash, randomUUID } from 'node:crypto';
import { createReadStream, createWriteStream } from 'node:fs';
import { mkdir, readdir, rename, rm, stat } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { Transform, type Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { apiError } from '../errors.ts';
import { checkKey, type FileStore, type StoredFile } from './FileStore.ts';

/** Files under one folder on the API's disk (`FILES_DIR`, D40). */
export class LocalDiskStore implements FileStore {
  readonly #root: string;

  constructor(root: string) {
    this.#root = root;
  }

  #path(key: string): string {
    checkKey(key);
    return join(this.#root, ...key.split('/'));
  }

  async put(key: string, body: Readable, limit: number): Promise<{ size: number; sha256: string }> {
    const target = this.#path(key);
    await mkdir(dirname(target), { recursive: true });
    // A unique temp name: two uploads to one key never write the same temp file.
    const temp = `${target}.${randomUUID()}.tmp`;
    const hash = createHash('sha256');
    let size = 0;
    const meter = new Transform({
      transform(chunk: Buffer, _encoding, done) {
        size += chunk.length;
        if (size > limit) {
          done(apiError('VALIDATION_FAILED', 'The file is too large.', { reason: 'tooLarge' }));
          return;
        }
        hash.update(chunk);
        done(null, chunk);
      },
    });
    try {
      await pipeline(body, meter, createWriteStream(temp));
      await rename(temp, target);
    } catch (error) {
      await rm(temp, { force: true });
      throw error;
    }
    return { size, sha256: hash.digest('hex') };
  }

  /** Resolves once the file is open, so a missing one rejects (`ENOENT`) before any reply. */
  open(key: string, range?: { start: number; end: number }): Promise<Readable> {
    const stream = createReadStream(this.#path(key), range);
    return new Promise((resolve, reject) => {
      stream.once('open', () => {
        stream.off('error', reject);
        resolve(stream);
      });
      stream.once('error', reject);
    });
  }

  async size(key: string): Promise<number | null> {
    try {
      return (await stat(this.#path(key))).size;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
      throw error;
    }
  }

  async delete(key: string): Promise<void> {
    await rm(this.#path(key), { force: true });
  }

  /** The API serves local files itself (`/v1/files/:token`). */
  downloadUrl(): null {
    return null;
  }

  /** Files under `prefix`, without the temp files of uploads still running. */
  async *list(prefix: string): AsyncIterable<StoredFile> {
    let entries;
    try {
      entries = await readdir(this.#root, { recursive: true, withFileTypes: true });
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return;
      throw error;
    }
    for (const entry of entries) {
      if (!entry.isFile() || entry.name.endsWith('.tmp')) continue;
      const path = join(entry.parentPath, entry.name);
      const key = path.slice(this.#root.length + 1).replace(/\\/g, '/');
      if (!key.startsWith(prefix)) continue;
      const info = await stat(path).catch(() => null);
      if (info) yield { key, size: info.size, modifiedAt: info.mtime };
    }
  }
}
