import { createHash, randomUUID } from 'node:crypto';
import { createReadStream, createWriteStream } from 'node:fs';
import { mkdir, rename, rm, stat } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { Transform, type Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { apiError } from '../errors.ts';
import { checkKey, type FileStore } from './FileStore.ts';

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

  open(key: string, range?: { start: number; end: number }): Promise<Readable> {
    return Promise.resolve(createReadStream(this.#path(key), range));
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
}
