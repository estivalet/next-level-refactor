// Cases ported from NextLevelOS electron/romScan.test.ts @ 3d530b7.
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { tempDir } from '../library/testing.ts';
import { walkSystem } from './walk.ts';

let root: string;
let cleanup: () => Promise<void>;
beforeEach(async () => {
  ({ dir: root, cleanup } = await tempDir('nextlevel-walk-'));
});
afterEach(async () => {
  await cleanup();
});

async function write(rel: string, content = '') {
  const path = join(root, rel);
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, content);
}

async function names(extensions: string[], dirs = [{ locationId: 'a', dir: root }]) {
  const result = await walkSystem({ systemId: 'test', dirs, extensions });
  return result.files.map((file) => file.relPath).sort();
}

describe('walkSystem', () => {
  it('FR-LIB-3: keeps accepted extensions at root and one sub-folder deep', async () => {
    await write('Alice Madness Returns.m3u', 'content/alice.god\n');
    await write('! Brazil/Game (Brazil).zip');
    await write('Deep/Deeper/Too Deep.zip');
    await write('notes.txt');
    expect(await names(['m3u', 'zip'])).toEqual([
      '! Brazil/Game (Brazil).zip',
      'Alice Madness Returns.m3u',
    ]);
  });

  it('FR-LIB-3: skips the media folder', async () => {
    await write('Game.zip');
    await write('MEDIA/Preview.zip');
    expect(await names(['zip'])).toEqual(['Game.zip']);
  });

  it('FR-LIB-3: reports size and mtime of each file', async () => {
    await write('Game.zip', '12345');
    const result = await walkSystem({
      systemId: 'test',
      dirs: [{ locationId: 'a', dir: root }],
      extensions: ['zip'],
    });
    expect(result.files).toMatchObject([
      { relPath: 'Game.zip', locationId: 'a', size: 5, discGroup: null },
    ]);
    expect(result.files[0]?.mtime).toBeGreaterThan(0);
    expect(result.foldersFound).toBe(1);
  });

  it('FR-LIB-5: drops bins referenced by a cue', async () => {
    await write(
      'Game.cue',
      'FILE "Game (Track 1).bin" BINARY\r\n  TRACK 01 MODE1/2352\r\nFILE "Game (Track 2).bin" BINARY\r\n',
    );
    await write('Game (Track 1).bin');
    await write('Game (Track 2).bin');
    await write('Loose.bin');
    expect(await names(['cue', 'bin'])).toEqual(['Game.cue', 'Loose.bin']);
  });

  it('FR-LIB-5: drops discs referenced by an m3u, including nested cue/bin', async () => {
    await write('Saga.m3u', '# playlist\nSaga (Disc 1).cue\nSaga (Disc 2).chd\n');
    await write('Saga (Disc 1).cue', 'FILE "Saga (Disc 1).bin" BINARY\n');
    await write('Saga (Disc 1).bin');
    await write('Saga (Disc 2).chd');
    expect(await names(['m3u', 'cue', 'bin', 'chd'])).toEqual(['Saga.m3u']);
  });

  it('FR-LIB-5: resolves references into sub-folders, case-insensitively', async () => {
    await write('Saga.m3u', '! Discs/SAGA (Disc 1).chd\n');
    await write('! Discs/Saga (Disc 1).chd');
    expect(await names(['m3u', 'chd'])).toEqual(['Saga.m3u']);
  });

  it('FR-LIB-5: a leading slash in an m3u entry is relative to the playlist folder', async () => {
    await write(
      'Blue Dragon.m3u',
      '\\content\\Blue Dragon (Disc 1).iso\r\n/content/Blue Dragon (Disc 2).iso\r\n',
    );
    await write('content/Blue Dragon (Disc 1).iso');
    await write('content/Blue Dragon (Disc 2).iso');
    await write('content/Other.iso');
    expect(await names(['m3u', 'iso'])).toEqual(['Blue Dragon.m3u', 'content/Other.iso']);
  });

  it('FR-LIB-3: skips missing folders', async () => {
    const result = await walkSystem({
      systemId: 'test',
      dirs: [{ locationId: 'a', dir: join(root, 'nope') }],
      extensions: ['zip'],
    });
    expect(result).toEqual({ systemId: 'test', files: [], foldersFound: 0 });
  });

  it('FR-LIB-1: the first location containing a game wins', async () => {
    await write('a/Game.zip', 'a');
    await write('b/GAME.zip', 'bb');
    await write('b/Other.zip');
    const result = await walkSystem({
      systemId: 'test',
      dirs: [
        { locationId: 'first', dir: join(root, 'a') },
        { locationId: 'second', dir: join(root, 'b') },
      ],
      extensions: ['zip'],
    });
    expect(result.files.map((f) => [f.relPath, f.locationId, f.size])).toEqual([
      ['Game.zip', 'first', 1],
      ['Other.zip', 'second', 0],
    ]);
    expect(result.foldersFound).toBe(2);
  });

  it('FR-LIB-5: loose discs become one game', async () => {
    await write('Saga (USA) (Disc 1).chd');
    await write('Saga (USA) (Disc 2).chd');
    const result = await walkSystem({
      systemId: 'test',
      dirs: [{ locationId: 'a', dir: root }],
      extensions: ['chd'],
    });
    expect(result.files.map((f) => [f.relPath, f.discGroup])).toEqual([
      ['Saga (USA) (Disc 1).chd', 'Saga (USA)'],
    ]);
  });
});
