import { mkdtemp, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { checkWritable } from './checkWritable.ts';

const dirs: string[] = [];
afterEach(async () => {
  for (const dir of dirs.splice(0)) await rm(dir, { recursive: true, force: true });
});

async function scratch() {
  const dir = await mkdtemp(join(tmpdir(), 'nextlevel-writable-'));
  dirs.push(dir);
  return dir;
}

describe('checkWritable (D50, Review Focus 5)', () => {
  it('creates the folder, writes and removes a test file', async () => {
    const dir = join(await scratch(), 'data');
    expect(await checkWritable(dir)).toEqual({ ok: true });
    expect(await readdir(dir)).toEqual([]);
  });

  it('a folder that cannot be created (its parent is a file) is refused', async () => {
    const base = await scratch();
    await writeFile(join(base, 'file'), 'x');
    expect(await checkWritable(join(base, 'file', 'data'))).toEqual({
      ok: false,
      reason: 'missing',
    });
  });

  it('a folder where a file cannot be written is readOnly', async () => {
    const base = await scratch();
    const dir = join(base, 'data');
    expect(
      await checkWritable(dir, {
        write: () => Promise.reject(Object.assign(new Error('denied'), { code: 'EPERM' })),
      }),
    ).toEqual({ ok: false, reason: 'readOnly' });
  });
});
