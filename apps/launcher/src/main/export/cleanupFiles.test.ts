import type { StorageLocation } from '@nextlevel/shared';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import type { DeleteLaterGame } from '../library/GameExportReader.ts';
import { collectCleanupFiles } from './cleanupFiles.ts';

const roots: string[] = [];
afterEach(async () => {
  for (const root of roots.splice(0)) await rm(root, { recursive: true, force: true });
});

const FOLDER = 'Game Gear';

async function setup() {
  const root = await mkdtemp(join(tmpdir(), 'nl-cleanup-'));
  roots.push(root);
  const location = (id: string, priority: number, managed = false): StorageLocation => ({
    id: `00000000-0000-7000-8000-00000000000${String(priority)}`,
    name: id,
    path: join(root, id),
    priority,
    ...(managed ? { managed: true } : {}),
  });
  // List order is search order (orderedLocations renumbers priority from it).
  const locations = [location('A', 1), location('B', 2), location('C', 3, true)];
  /** Writes a file under a location's system folder; returns its full path. */
  const put = async (loc: 'A' | 'B' | 'C', relPath: string, content = 'x') => {
    const path = join(root, loc, FOLDER, ...relPath.split('/'));
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, content);
    return path;
  };
  const collect = (games: DeleteLaterGame[]) =>
    collectCleanupFiles(games, { locations, folderName: () => FOLDER });
  return { root, put, collect };
}

const game = (relPath: string, extra: Partial<DeleteLaterGame> = {}): DeleteLaterGame => ({
  title: relPath,
  systemId: 'gamegear',
  system: 'Sega Game Gear',
  relPath,
  discGroup: null,
  ...extra,
});

describe('collectCleanupFiles', () => {
  it('FR-LIB-20: a game is found in every location', async () => {
    const { put, collect } = await setup();
    const inA = await put('A', '! Translated/x.gg', 'abc');
    const inB = await put('B', '! Translated/x.gg', 'abcdef');

    const [result] = await collect([game('! Translated/x.gg')]);

    expect(result?.files).toEqual([
      { path: inA, location: 'A', size: 3, folder: false },
      { path: inB, location: 'B', size: 6, folder: false },
    ]);
    expect(result?.notes).toEqual([]);
    expect(result?.title).toBe('! Translated/x.gg');
    expect(result?.system).toBe('Sega Game Gear');
  });

  it('FR-LIB-20: a file in no location is left out', async () => {
    const { collect } = await setup();
    const [result] = await collect([game('gone.gg')]);
    expect(result?.files).toEqual([]);
  });

  it('FR-LIB-20: a cue brings its bins, an m3u its cues and their bins', async () => {
    const { put, collect } = await setup();
    const m3u = await put('A', 'g.m3u', 'g (Disc 1).cue\r\n');
    const cue = await put('A', 'g (Disc 1).cue', 'FILE "g (Disc 1).bin" BINARY\r\n');
    const bin = await put('A', 'g (Disc 1).bin');

    const [result] = await collect([game('g.m3u')]);

    expect(result?.files.map((file) => file.path)).toEqual([m3u, cue, bin]);
  });

  it('FR-LIB-20: a disc set brings its other discs', async () => {
    const { put, collect } = await setup();
    const disc1 = await put('A', 'Saga (USA) (Disc 1).chd');
    const disc2 = await put('A', 'Saga (USA) (Disc 2).chd');
    await put('A', 'Saga (Japan) (Disc 2).chd');

    const [result] = await collect([game('Saga (USA) (Disc 1).chd', { discGroup: 'Saga (USA)' })]);

    expect(result?.files.map((file) => file.path)).toEqual([disc1, disc2]);
  });

  it('FR-LIB-20: a playlist entry outside the system folder is a note, not a file', async () => {
    const { root, put, collect } = await setup();
    const cue = await put('A', 'x.cue', 'FILE "..\\..\\elsewhere.bin" BINARY\r\n');
    await writeFile(join(root, 'elsewhere.bin'), 'x');

    const [result] = await collect([game('x.cue')]);

    expect(result?.files.map((file) => file.path)).toEqual([cue]);
    expect(result?.notes).toHaveLength(1);
    expect(result?.notes[0]).toContain(join(root, 'elsewhere.bin'));
  });

  it('FR-LIB-20: a file reached twice is listed once', async () => {
    const { put, collect } = await setup();
    await put('A', 'one.cue', 'FILE "shared.bin" BINARY\r\n');
    await put('A', 'two.cue', 'FILE "SHARED.BIN" BINARY\r\n');
    const bin = await put('A', 'shared.bin');

    const result = await collect([game('one.cue'), game('two.cue')]);

    const all = result.flatMap((entry) => entry.files.map((file) => file.path.toLowerCase()));
    expect(all.filter((path) => path === bin.toLowerCase())).toHaveLength(1);
    expect(all).toHaveLength(3);
  });

  it('FR-LIB-20: Catalog copies are notes', async () => {
    const { put, collect } = await setup();
    const inA = await put('A', 'x.gg');
    const inC = await put('C', 'x.gg');

    const [result] = await collect([game('x.gg')]);

    expect(result?.files.map((file) => file.path)).toEqual([inA]);
    expect(result?.notes).toEqual([`installed from Catalog, use Uninstall: ${inC}`]);
  });

  it('FR-LIB-20: a game folder is one folder entry', async () => {
    const { root, put, collect } = await setup();
    await put('A', 'Quest/game.exe');
    await put('A', 'Quest/data/level1.dat');

    const [result] = await collect([game('Quest')]);

    expect(result?.files).toEqual([
      { path: join(root, 'A', FOLDER, 'Quest'), location: 'A', size: 0, folder: true },
    ]);
  });
});
