import { existsSync } from 'node:fs';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { appErrorOfAsync, seedGames } from '../library/testing.ts';
import { installWorld, LOCAL_ID, MANAGED_ID } from './installWorld.ts';

const closers: Array<() => Promise<void>> = [];
afterEach(async () => {
  for (const close of closers.splice(0).reverse()) await close();
});

const ROM = Buffer.from('NEXTLEVEL TEST FIXTURE star hopper v1\n'.repeat(20));

const GAME =
  'select id, source, catalog_item_id as catalogItemId, rel_path as relPath, location_id as locationId from games';

describe('installing catalog games (FR-CAT-3, US-E2, D45)', () => {
  it('US-E2: an installed item appears in its system with metadata and art', async () => {
    const w = await installWorld(closers);
    w.art.set('https://api.test/v1/files/art-token', Buffer.from('png bytes'));
    const item = w.item({
      year: 2024,
      genre: 'Shooter',
      developer: 'Pixel Moth',
      description: 'A small space shooter.',
      players: 2,
      media: [{ kind: 'box-front', url: 'https://api.test/v1/files/art-token' }],
    });
    const files = await w.download(item, { 'Star Hopper.nes': ROM });
    const { gameId } = await w.installer.install(item, files);
    const target = join(w.managed.path, w.nesFolder, 'star-hopper', 'Star Hopper.nes');
    expect(await readFile(target)).toEqual(ROM);
    expect(existsSync(files[0]?.path ?? '')).toBe(false);
    expect(w.row(`${GAME} where id = ?`, gameId)).toEqual({
      id: gameId,
      source: 'catalog',
      catalogItemId: 'i1',
      relPath: 'star-hopper/Star Hopper.nes',
      locationId: MANAGED_ID,
    });
    expect(
      w.row('select title, year, genre, developer, players, description from game_metadata'),
    ).toEqual({
      title: 'Star Hopper',
      year: 2024,
      genre: 'Shooter',
      developer: 'Pixel Moth',
      players: '2',
      description: 'A small space shooter.',
    });
    const art = w.row("select path from game_media where kind = 'box-front'") as
      { path: string } | undefined;
    expect(art && (await readFile(art.path))).toEqual(Buffer.from('png bytes'));
    expect(
      w.row(
        'select catalog_item_id as itemId, version, files, location_id as locationId, state from catalog_installs',
      ),
    ).toEqual({
      itemId: 'i1',
      version: 1,
      files: JSON.stringify([`${w.nesFolder}/star-hopper/Star Hopper.nes`]),
      locationId: MANAGED_ID,
      state: 'current',
    });
    expect(w.changed).toContainEqual({ systems: ['nintendo-nes'], gameIds: [gameId] });
  });

  it('Review Focus 2: an item whose filename escapes the item folder is refused and nothing is written', async () => {
    const w = await installWorld(closers);
    for (const item of [
      w.item({
        files: [{ id: 'f1', filename: '..\\evil.nes', size: 3, sha256: 'a', role: 'rom' }],
      }),
      w.item({
        files: [{ id: 'f1', filename: 'C:\\evil.nes', size: 3, sha256: 'a', role: 'rom' }],
      }),
      w.item({ files: [{ id: 'f1', filename: 'CON.nes', size: 3, sha256: 'a', role: 'rom' }] }),
      w.item({ slug: '../escape' }),
      w.item({ slug: 'ok', systemId: '../nintendo-nes' }),
    ]) {
      const files = await w.download(item, {});
      const error = await appErrorOfAsync(() => w.installer.install(item, files));
      expect(error.code).toBe('VALIDATION_FAILED');
    }
    expect(existsSync(w.managed.path)).toBe(false);
    expect(w.rows('select id from games')).toEqual([]);
  });

  it('a rescan keeps source catalog', async () => {
    const w = await installWorld(closers);
    const item = w.item();
    const { gameId } = await w.installer.install(item, await w.download(item, {}));
    const existing = w.repo.listSystemGames('nintendo-nes');
    const found = existing.map((game) => ({
      relPath: game.relPath,
      locationId: MANAGED_ID,
      size: game.size + 1,
      mtime: game.mtime + 1,
      discGroup: null,
    }));
    w.repo.applySystemDiff(
      'nintendo-nes',
      {
        added: [],
        present: found.map((game, i) => ({ id: existing[i]?.id ?? 0, game })),
        moved: [],
        restored: [],
        missing: [],
        unchanged: 0,
      },
      new Date('2026-10-29T11:00:00.000Z'),
    );
    expect(w.row(`${GAME} where id = ?`, gameId)).toMatchObject({
      source: 'catalog',
      catalogItemId: 'i1',
    });
  });

  it('an update replaces changed files, removes dropped ones and keeps favorites, play stats and locked fields', async () => {
    const w = await installWorld(closers);
    const v1 = w.item({
      files: [
        { id: 'f1', filename: 'Star Hopper.nes', size: 1, sha256: 'a', role: 'rom' },
        { id: 'f2', filename: 'manual.txt', size: 1, sha256: 'a', role: 'extra' },
      ],
    });
    const { gameId } = await w.installer.install(
      v1,
      await w.download(v1, { 'Star Hopper.nes': ROM }),
    );
    w.db.$client
      .prepare(
        'insert into game_user_state (game_id, favorite, play_count, play_seconds) values (?, 1, 7, 300)',
      )
      .run(gameId);
    w.db.$client
      .prepare(
        `update game_metadata set title = 'My Hopper', locked_fields = '["title"]' where game_id = ?`,
      )
      .run(gameId);
    const v2 = w.item({
      version: 2,
      genre: 'Arcade',
      files: [{ id: 'f3', filename: 'Star Hopper.nes', size: 1, sha256: 'a', role: 'rom' }],
    });
    const newRom = Buffer.from('NEXTLEVEL TEST FIXTURE star hopper v2\n');
    const again = await w.installer.install(
      v2,
      await w.download(v2, { 'Star Hopper.nes': newRom }),
    );
    expect(again.gameId).toBe(gameId);
    const folder = join(w.managed.path, w.nesFolder, 'star-hopper');
    expect(await readdir(folder)).toEqual(['Star Hopper.nes']);
    expect(await readFile(join(folder, 'Star Hopper.nes'))).toEqual(newRom);
    expect(w.row('select favorite, play_count as playCount from game_user_state')).toEqual({
      favorite: 1,
      playCount: 7,
    });
    expect(w.row('select title, genre from game_metadata')).toEqual({
      title: 'My Hopper',
      genre: 'Arcade',
    });
    expect(w.row('select version from catalog_installs')).toEqual({ version: 2 });
  });
});

describe('uninstalling catalog games (FR-CAT-5, US-E3, Review Focus 4)', () => {
  it('US-E3 / FR-CAT-5: uninstall removes files and the library entry', async () => {
    const w = await installWorld(closers);
    const item = w.item();
    await w.installer.install(item, await w.download(item, {}));
    await w.installer.uninstall('i1', false);
    expect(existsSync(join(w.managed.path, w.nesFolder, 'star-hopper'))).toBe(false);
    expect(w.rows('select id from games')).toEqual([]);
    expect(w.rows('select game_id from catalog_installs')).toEqual([]);
  });

  it('uninstall of a favorite or collection member without confirm is CONFLICT inCollections', async () => {
    const w = await installWorld(closers);
    const item = w.item();
    const { gameId } = await w.installer.install(item, await w.download(item, {}));
    w.db.$client
      .prepare('insert into game_user_state (game_id, favorite) values (?, 1)')
      .run(gameId);
    const error = await appErrorOfAsync(() => w.installer.uninstall('i1', false));
    expect(error).toMatchObject({ code: 'CONFLICT', details: { reason: 'inCollections' } });
    expect(w.rows('select id from games')).toHaveLength(1);
    w.db.$client.prepare('update game_user_state set favorite = 0').run();
    w.db.$client
      .prepare("insert into collections (name, created_at) values ('Best', '2026-10-29')")
      .run();
    w.db.$client
      .prepare('insert into collection_games (collection_id, game_id, position) values (1, ?, 0)')
      .run(gameId);
    expect((await appErrorOfAsync(() => w.installer.uninstall('i1', false))).code).toBe('CONFLICT');
    await w.installer.uninstall('i1', true);
    expect(w.rows('select id from games')).toEqual([]);
  });

  it('uninstall leaves a local game with the same rel path in another location', async () => {
    const w = await installWorld(closers);
    const localFolder = join(w.local.path, w.nesFolder, 'star-hopper');
    await mkdir(localFolder, { recursive: true });
    const localRom = join(localFolder, 'Star Hopper.nes');
    await writeFile(localRom, Buffer.from('my own copy'));
    const [localId] = seedGames(w.db, 'nintendo-nes', [
      { title: 'Star Hopper', relPath: 'star-hopper/Star Hopper.nes', locationId: LOCAL_ID },
    ]);
    const item = w.item();
    const { gameId } = await w.installer.install(item, await w.download(item, {}));
    expect(gameId).toBe(localId);
    await w.installer.uninstall('i1', false);
    expect(await readFile(localRom)).toEqual(Buffer.from('my own copy'));
    expect(w.row(`${GAME} where id = ?`, localId)).toEqual({
      id: localId,
      source: 'local',
      catalogItemId: null,
      relPath: 'star-hopper/Star Hopper.nes',
      locationId: LOCAL_ID,
    });
    expect(w.rows('select game_id from catalog_installs')).toEqual([]);
  });

  it('an item that is not installed is NOT_FOUND', async () => {
    const w = await installWorld(closers);
    expect((await appErrorOfAsync(() => w.installer.uninstall('nope', true))).code).toBe(
      'NOT_FOUND',
    );
  });
});
