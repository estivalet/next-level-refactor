import { createHash } from 'node:crypto';
import { mkdtemp, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Readable } from 'node:stream';
import { text } from 'node:stream/consumers';
import { afterEach, describe, expect, it } from 'vitest';
import { LocalDiskStore } from './LocalDiskStore.ts';

const dirs: string[] = [];
afterEach(async () => {
  for (const dir of dirs.splice(0)) await rm(dir, { recursive: true, force: true });
});

async function store() {
  const dir = await mkdtemp(join(tmpdir(), 'nextlevel-files-'));
  dirs.push(dir);
  return { dir, files: new LocalDiskStore(dir) };
}

const sha = (body: string) => createHash('sha256').update(body).digest('hex');

/** Every file under `dir`, relative, with forward slashes. */
async function tree(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { recursive: true, withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile())
    .map((entry) =>
      join(entry.parentPath, entry.name)
        .slice(dir.length + 1)
        .replace(/\\/g, '/'),
    )
    .sort();
}

describe('LocalDiskStore (D40, ADR-012)', () => {
  it('put streams the body, answering its size and SHA-256; size and open read it back', async () => {
    const { files } = await store();
    const result = await files.put('files/i1/f1', Readable.from(['hello ', 'world']), 1024);
    expect(result).toEqual({ size: 11, sha256: sha('hello world') });
    expect(await files.size('files/i1/f1')).toBe(11);
    expect(await text(await files.open('files/i1/f1'))).toBe('hello world');
  });

  it('open takes an inclusive byte range', async () => {
    const { files } = await store();
    await files.put('files/i1/f1', Readable.from(['0123456789']), 1024);
    expect(await text(await files.open('files/i1/f1', { start: 3, end: 6 }))).toBe('3456');
  });

  it('a body past the limit is refused tooLarge and leaves no file', async () => {
    const { dir, files } = await store();
    await expect(
      files.put('files/i1/big', Readable.from(['x'.repeat(10), 'y'.repeat(10)]), 15),
    ).rejects.toMatchObject({ code: 'VALIDATION_FAILED', details: { reason: 'tooLarge' } });
    expect(await tree(dir)).toEqual([]);
    expect(await files.size('files/i1/big')).toBeNull();
  });

  it('a body that fails mid-way leaves no file', async () => {
    const { dir, files } = await store();
    const failing = new Readable({
      read() {
        this.push('part');
        this.destroy(new Error('connection reset'));
      },
    });
    await expect(files.put('files/i1/f1', failing, 1024)).rejects.toThrow();
    expect(await tree(dir)).toEqual([]);
  });

  it('two puts to one key leave the last', async () => {
    const { dir, files } = await store();
    await files.put('media/i1/box-front/1', Readable.from(['first']), 1024);
    await files.put('media/i1/box-front/1', Readable.from(['second']), 1024);
    expect(await text(await files.open('media/i1/box-front/1'))).toBe('second');
    expect(await tree(dir)).toEqual(['media/i1/box-front/1']);
  });

  it('delete removes a file; deleting a missing one is fine', async () => {
    const { files } = await store();
    await files.put('files/i1/f1', Readable.from(['x']), 1024);
    await files.delete('files/i1/f1');
    await files.delete('files/i1/f1');
    expect(await files.size('files/i1/f1')).toBeNull();
  });

  it('keys stay inside the store folder', async () => {
    const { files } = await store();
    await expect(files.put('../escape', Readable.from(['x']), 10)).rejects.toThrow(/key/);
    await expect(files.size('files/../../x')).rejects.toThrow(/key/);
  });
});
