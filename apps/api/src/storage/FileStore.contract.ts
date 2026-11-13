import { createHash } from 'node:crypto';
import { Readable } from 'node:stream';
import { text } from 'node:stream/consumers';
import { afterEach, describe, expect, it } from 'vitest';
import type { FileStore } from './FileStore.ts';

// What every FileStore does (D40, D57): the local disk always, an S3 store (R2, MinIO) when one
// is reachable. Each test uses its own key prefix so a shared bucket is fine.

export interface ContractSubject {
  store: FileStore;
  cleanup: () => Promise<void>;
}

const sha = (body: string) => createHash('sha256').update(body).digest('hex');

async function all<T>(items: AsyncIterable<T>): Promise<T[]> {
  const result: T[] = [];
  for await (const item of items) result.push(item);
  return result;
}

export function fileStoreContract(name: string, make: () => Promise<ContractSubject>): void {
  describe(`FileStore contract: ${name} (D40, D57)`, () => {
    const cleanups: Array<() => Promise<void>> = [];
    afterEach(async () => {
      for (const cleanup of cleanups.splice(0)) await cleanup();
    });
    const subject = async () => {
      const made = await make();
      cleanups.push(made.cleanup);
      return {
        files: made.store,
        prefix: `contract-${String(Date.now())}-${String(Math.random()).slice(2, 8)}`,
      };
    };

    it('put with SHA-256, size, open (whole and an inclusive range), delete', async () => {
      const { files, prefix } = await subject();
      const key = `files/${prefix}/f1`;
      expect(await files.put(key, Readable.from(['0123', '456789']), 1024)).toEqual({
        size: 10,
        sha256: sha('0123456789'),
      });
      expect(await files.size(key)).toBe(10);
      expect(await text(await files.open(key))).toBe('0123456789');
      expect(await text(await files.open(key, { start: 3, end: 6 }))).toBe('3456');
      await files.delete(key);
      expect(await files.size(key)).toBeNull();
      await files.delete(key);
    });

    it('a missing file opens with ENOENT and has no size', async () => {
      const { files, prefix } = await subject();
      await expect(files.open(`files/${prefix}/none`)).rejects.toMatchObject({ code: 'ENOENT' });
      expect(await files.size(`files/${prefix}/none`)).toBeNull();
    });

    it('a body past the limit is refused tooLarge and nothing is kept', async () => {
      const { files, prefix } = await subject();
      const key = `files/${prefix}/big`;
      await expect(
        files.put(key, Readable.from(['x'.repeat(10), 'y'.repeat(10)]), 15),
      ).rejects.toMatchObject({
        code: 'VALIDATION_FAILED',
        details: { reason: 'tooLarge' },
      });
      expect(await files.size(key)).toBeNull();
    });

    it('list answers every file under a prefix with its size and time', async () => {
      const { files, prefix } = await subject();
      await files.put(`media/${prefix}/a/1`, Readable.from(['aa']), 1024);
      await files.put(`media/${prefix}/b/1`, Readable.from(['bbb']), 1024);
      await files.put(`evidence/${prefix}/x`, Readable.from(['x']), 1024);
      const listed = (await all(files.list(`media/${prefix}/`))).sort((a, b) =>
        a.key.localeCompare(b.key),
      );
      expect(listed.map(({ key, size }) => ({ key, size }))).toEqual([
        { key: `media/${prefix}/a/1`, size: 2 },
        { key: `media/${prefix}/b/1`, size: 3 },
      ]);
      expect(
        listed.every((file) => Math.abs(file.modifiedAt.getTime() - Date.now()) < 10 * 60_000),
      ).toBe(true);
      for (const key of [`media/${prefix}/a/1`, `media/${prefix}/b/1`, `evidence/${prefix}/x`]) {
        await files.delete(key);
      }
    });
  });
}
