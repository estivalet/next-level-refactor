import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import * as fsp from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { atomicWrite, type AtomicFs } from './atomicWrite.ts';

let dir: string;

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'nextlevel-atomic-'));
});

afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

describe('atomicWrite', () => {
  it('NFR-REL-1: writes the full content and leaves no tmp file', async () => {
    const file = join(dir, 'settings.json');
    await atomicWrite(file, '{"a":1}');
    expect(await readFile(file, 'utf8')).toBe('{"a":1}');
    expect(await readdir(dir)).toEqual(['settings.json']);
  });

  it('NFR-REL-1: replaces an existing file', async () => {
    const file = join(dir, 'settings.json');
    await writeFile(file, 'old');
    await atomicWrite(file, 'new');
    expect(await readFile(file, 'utf8')).toBe('new');
  });

  it('NFR-REL-1: a stale .tmp from a crash is overwritten', async () => {
    const file = join(dir, 'settings.json');
    await writeFile(`${file}.tmp`, 'half-written garbage that is much longer than the new content');
    await atomicWrite(file, 'ok');
    expect(await readFile(file, 'utf8')).toBe('ok');
    expect(await readdir(dir)).toEqual(['settings.json']);
  });

  it('NFR-REL-1: if rename fails, the original file is untouched and the tmp is removed', async () => {
    const file = join(dir, 'settings.json');
    await writeFile(file, 'original');
    const failingFs: AtomicFs = {
      open: fsp.open,
      rm: fsp.rm,
      rename: () => Promise.reject(new Error('disk full')),
    };
    await expect(atomicWrite(file, 'new', failingFs)).rejects.toThrow('disk full');
    expect(await readFile(file, 'utf8')).toBe('original');
    expect(await readdir(dir)).toEqual(['settings.json']);
  });
});
