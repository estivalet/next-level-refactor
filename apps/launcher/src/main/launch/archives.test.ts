import { path7za } from '7zip-bin';
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { tempDir } from '../library/testing.ts';
import { prepareRom, sevenZipExtractor, type Extractor } from './archives.ts';

let temp: Awaited<ReturnType<typeof tempDir>>;
beforeEach(async () => {
  temp = await tempDir('nextlevel-archives-');
});
afterEach(async () => {
  await temp.cleanup();
});

/** Writes the given files (path → size) into the destination instead of extracting. */
function fakeExtractor(files: Record<string, number>): Extractor & { calls: string[][] } {
  const calls: string[][] = [];
  return {
    calls,
    async extract(archive, dest) {
      calls.push([archive, dest]);
      for (const [name, size] of Object.entries(files)) {
        await mkdir(join(dest, name, '..'), { recursive: true });
        await writeFile(join(dest, name), 'x'.repeat(size));
      }
    },
  };
}

const base = () => ({
  dest: join(temp.dir, 'nextlevel-launch', '1'),
  systemExtensions: ['cue', 'bin', 'iso', 'zip', '7z', 'm3u'],
});

describe('prepareRom (FR-EMU-8)', () => {
  it('FR-EMU-8: pass mode hands the archive to the emulator', async () => {
    const extractor = fakeExtractor({});
    const prepared = await prepareRom({
      ...base(),
      romPath: 'E:\\r\\G.zip',
      mode: 'pass',
      extractor,
    });
    expect(prepared.path).toBe('E:\\r\\G.zip');
    expect(extractor.calls).toEqual([]);
  });

  it('FR-EMU-8: files that aren’t archives are never extracted', async () => {
    const extractor = fakeExtractor({});
    const prepared = await prepareRom({
      ...base(),
      romPath: 'E:\\r\\G.iso',
      mode: 'extract',
      extractor,
    });
    expect(prepared.path).toBe('E:\\r\\G.iso');
  });

  it('FR-EMU-8: extract mode picks the .cue over bigger tracks and cleans up', async () => {
    const extractor = fakeExtractor({ 'G (Track 1).bin': 50, 'G (Track 2).bin': 20, 'G.cue': 1 });
    const prepared = await prepareRom({
      ...base(),
      romPath: 'E:\\r\\G.7z',
      mode: 'extract',
      extractor,
    });
    expect(prepared.path).toBe(join(base().dest, 'G.cue'));
    expect(extractor.calls).toEqual([['E:\\r\\G.7z', base().dest]]);
    await prepared.cleanup();
    expect(existsSync(base().dest)).toBe(false);
  });

  it('FR-EMU-8: otherwise the largest file with a system extension, in subfolders too', async () => {
    const extractor = fakeExtractor({ 'readme.txt': 900, 'disc/G.iso': 100, 'small.bin': 5 });
    const prepared = await prepareRom({
      ...base(),
      romPath: 'E:\\r\\G.zip',
      mode: 'extract',
      extractor,
    });
    expect(prepared.path).toBe(join(base().dest, 'disc', 'G.iso'));
  });

  it('FR-EMU-8: an archive with nothing usable fails and is cleaned up', async () => {
    const extractor = fakeExtractor({ 'readme.txt': 9 });
    await expect(
      prepareRom({ ...base(), romPath: 'E:\\r\\G.zip', mode: 'extract', extractor }),
    ).rejects.toMatchObject({ error: { code: 'LAUNCH_FAILED' } });
    expect(existsSync(base().dest)).toBe(false);
  });
});

describe('sevenZipExtractor (ADR-014)', () => {
  it('FR-EMU-8: extracts a real .7z with the bundled 7-Zip', async () => {
    const source = join(temp.dir, 'src');
    await mkdir(source);
    await writeFile(join(source, 'Game (USA).iso'), 'disc');
    const archive = join(temp.dir, 'Game (USA).7z');
    execFileSync(path7za, ['a', archive, join(source, '*')], { stdio: 'ignore' });
    const dest = join(temp.dir, 'out dir');
    await sevenZipExtractor(path7za).extract(archive, dest);
    expect(await readFile(join(dest, 'Game (USA).iso'), 'utf8')).toBe('disc');
  });

  it('FR-EMU-8: a broken archive fails with LAUNCH_FAILED', async () => {
    const archive = join(temp.dir, 'broken.zip');
    await writeFile(archive, 'not a zip');
    await expect(
      sevenZipExtractor(path7za).extract(archive, join(temp.dir, 'out')),
    ).rejects.toMatchObject({ error: { code: 'LAUNCH_FAILED' } });
  });
});
