import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { hashRom } from './hashRom.ts';

describe('hashRom (FR-SCR-1)', () => {
  let dir: string;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'hash-'));
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it('computes size, crc32, md5 and sha1 in lowercase hex', async () => {
    const file = join(dir, 'game.bin');
    await writeFile(file, 'abc');
    expect(await hashRom(file)).toEqual({
      size: 3,
      crc: '352441c2',
      md5: '900150983cd24fb0d6963f7d28e17f72',
      sha1: 'a9993e364706816aba3e25717850c26c9cd0d89d',
    });
  });

  it('pads the crc to 8 digits', async () => {
    const file = join(dir, 'empty.bin');
    await writeFile(file, '');
    expect((await hashRom(file))?.crc).toBe('00000000');
  });

  it('skips playlists and cue/gdi sheets, folders and missing files', async () => {
    for (const name of ['set.m3u', 'disc.CUE', 'disc.gdi']) {
      await writeFile(join(dir, name), 'x');
      expect(await hashRom(join(dir, name))).toBeNull();
    }
    await mkdir(join(dir, 'folder.iso'));
    expect(await hashRom(join(dir, 'folder.iso'))).toBeNull();
    expect(await hashRom(join(dir, 'missing.zip'))).toBeNull();
  });

  it('skips files at or over the size limit (512 MiB by default)', async () => {
    const file = join(dir, 'big.bin');
    await writeFile(file, 'abc');
    expect(await hashRom(file, { maxBytes: 3 })).toBeNull();
    expect(await hashRom(file, { maxBytes: 4 })).not.toBeNull();
  });
});
