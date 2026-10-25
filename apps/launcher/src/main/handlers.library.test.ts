import { defaultSettings, type IpcChannel, type IpcEvent } from '@nextlevel/shared';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { memorySecrets } from './secrets/testing.ts';
import { DISABLED_AUTH } from './auth/authHandlers.ts';
import { createHandlers, type MainDeps } from './handlers.ts';
import { createIpcRouter } from './ipc/router.ts';
import { CollectionRepository } from './library/CollectionRepository.ts';
import { SmartFilterRepository } from './library/SmartFilterRepository.ts';
import type { BatchScrapeService } from './scraper/batch/BatchScrapeService.ts';
import type { ScrapeService } from './scraper/ScrapeService.ts';
import type { ImportService } from './import/ImportService.ts';
import { MenuRepository } from './menus/MenuRepository.ts';
import { FrontendService } from './frontend/FrontendService.ts';
import { LaunchService } from './launch/LaunchService.ts';
import { GameRepository } from './library/GameRepository.ts';
import { LaunchRepository } from './library/LaunchRepository.ts';
import { MediaRepository } from './library/MediaRepository.ts';
import { seedGames, tempLibrary } from './library/testing.ts';
import { ScanService } from './scan/ScanService.ts';
import { system } from './scan/testing.ts';
import { inProcessWalker } from './scan/walker.ts';
import { SettingsService } from './settings/SettingsService.ts';
import { settingsFixture } from './settings/testing.ts';

const cleanups: Array<() => Promise<void>> = [];
afterEach(async () => {
  for (const cleanup of cleanups.splice(0)) await cleanup();
});

const CATALOG = [system('nintendo-64'), system('sega-genesis')];

async function setup(withLibrary: boolean) {
  const events: Array<{ event: IpcEvent; payload: unknown }> = [];
  const revealed: string[] = [];
  const fixture = await settingsFixture();
  cleanups.push(fixture.cleanup);
  const settings = new SettingsService(fixture.deps);
  await settings.load();
  let library: MainDeps['library'] = null;
  let db: Awaited<ReturnType<typeof tempLibrary>>['db'] | null = null;
  if (withLibrary) {
    const temp = await tempLibrary();
    cleanups.push(temp.cleanup);
    db = temp.db;
    const launches = new LaunchRepository(temp.db);
    const media = new MediaRepository(temp.db);
    const scan = new ScanService({
      repo: temp.repo,
      media,
      settings,
      catalog: () => CATALOG,
      createWalker: inProcessWalker,
      folderExists: () => Promise.resolve(false),
      clock: () => new Date(Date.UTC(2026, 9, 21)),
      emit: () => undefined,
      log: { error: () => undefined },
      newId: () => 'scan-1',
    });
    const collections = new CollectionRepository(temp.db, () => new Date(Date.UTC(2026, 9, 21)));
    const menus = new MenuRepository(
      temp.db,
      () => new Date(Date.UTC(2026, 9, 21)),
      () => 'm-1',
    );
    const smartFilters = new SmartFilterRepository(temp.db, () => new Date(Date.UTC(2026, 9, 21)));
    library = {
      repo: temp.repo,
      media,
      frontend: new FrontendService({
        db: temp.db,
        catalog: () => CATALOG,
        settings: defaultSettings,
        collections,
        menus,
        smartFilters,
      }),
      scan,
      games: new GameRepository(temp.db, (row) => join('X:', 'roms', row.systemId, row.relPath)),
      collections,
      launches,
      launch: new LaunchService({
        settings: defaultSettings,
        system: () => undefined,
        launches,
        spawn: () => Promise.reject(new Error('no spawn in this test')),
        exists: () => false,
        clock: () => new Date(Date.UTC(2026, 9, 21)),
        emit: () => undefined,
        window: { minimize: () => undefined, restore: () => undefined },
        extractor: { extract: () => Promise.resolve() },
        tempDir: temp.dir,
        baseEnv: {},
        log: { warn: () => undefined, error: () => undefined },
      }),
      menus,
      smartFilters,
      // These tests never reach the import channels.
      importer: {} as ImportService,
      scrape: {} as ScrapeService,
      batch: {} as BatchScrapeService,
    };
  }
  const deps: MainDeps = {
    auth: DISABLED_AUTH,
    settings,
    artIndex: { index: () => Promise.reject(new Error('no art index in this test')) },
    appVersion: () => '1.0.0',
    quit: vi.fn(),
    paths: { data: fixture.dir, logs: join(fixture.dir, 'logs') },
    openPath: vi.fn(() => Promise.resolve('')),
    setOpenAtLogin: vi.fn(),
    log: { warn: vi.fn() },
    catalog: () => CATALOG,
    pickFolder: vi.fn(() => Promise.resolve(null)),
    pickFile: vi.fn(() => Promise.resolve(null)),
    presets: () => [],
    library,
    clock: () => new Date(Date.UTC(2026, 9, 21)),
    newId: () => '0199f000-0000-7000-8000-000000000001',
    secrets: memorySecrets(),
    scraperAccount: () => Promise.reject(new Error('no scraper in this test')),
    scraperSystems: () => Promise.reject(new Error('no scraper in this test')),
    emit: (event, payload) => {
      events.push({ event, payload });
    },
    revealFile: (path) => {
      revealed.push(path);
    },
    pathExists: (path) => path === join('X:', 'roms'),
  };
  const seed = (
    ...args: Parameters<typeof seedGames> extends [unknown, ...infer Rest] ? Rest : never
  ) => {
    if (!db) throw new Error('no library');
    return seedGames(db, ...args);
  };
  return {
    seed,
    events,
    revealed,
    router: createIpcRouter(createHandlers(deps), { error: () => undefined }),
    settings,
    library,
  };
}

describe('library handlers', () => {
  it('FR-LIB-3: scan channels fail with LIBRARY_UNAVAILABLE when the library could not open', async () => {
    const { router } = await setup(false);
    for (const channel of ['scan.status', 'scan.cancel', 'systems.list'] as const) {
      expect(await router.handle(channel, undefined)).toMatchObject({
        ok: false,
        error: { code: 'LIBRARY_UNAVAILABLE' },
      });
    }
    expect(await router.handle('scan.start', {})).toMatchObject({
      ok: false,
      error: { code: 'LIBRARY_UNAVAILABLE' },
    });
  });

  it('FR-LIB-3: systems.list merges catalog, enabled flag and game counts', async () => {
    const { router, settings, library } = await setup(true);
    await settings.save(
      { ...defaultSettings(), systems: { 'sega-genesis': { enabled: true } } },
      0,
    );
    library?.repo.applySystemDiff(
      'nintendo-64',
      {
        added: [{ relPath: 'Demo.zip', locationId: 'a', size: 1, mtime: 1, discGroup: null }],
        present: [],
        moved: [],
        restored: [],
        missing: [],
        unchanged: 0,
      },
      new Date(),
    );
    expect(await router.handle('systems.list', undefined)).toEqual({
      ok: true,
      value: [
        { id: 'nintendo-64', enabled: false, games: 1, missing: 0, review: 0 },
        { id: 'sega-genesis', enabled: true, games: 0, missing: 0, review: 0 },
      ],
    });
  });

  it('FR-LIB-3: scan.start runs a scan and scan.status reports it', async () => {
    const { router, library } = await setup(true);
    expect(await router.handle('scan.start', { systemIds: ['nintendo-64'] })).toMatchObject({
      ok: true,
      value: { running: true },
    });
    await library?.scan.whenIdle();
    expect(await router.handle('scan.status', undefined)).toMatchObject({
      ok: true,
      value: { running: false, last: { outcome: 'completed' } },
    });
  });
});

const LIBRARY_CHANNELS: Array<[IpcChannel, unknown]> = [
  [
    'library.games.list',
    { scope: { kind: 'system', systemId: 'nintendo-64' }, offset: 0, limit: 10 },
  ],
  ['library.games.get', { gameId: 1 }],
  ['library.games.updateMetadata', { gameId: 1, changes: { title: 'X' } }],
  ['library.games.setFlags', { gameIds: [1], flags: { favorite: true } }],
  ['library.games.relink', { missingGameId: 1, replacementGameId: 2 }],
  ['library.games.reveal', { gameId: 1 }],
  ['library.search', { text: 'zelda' }],
  ['collections.list', undefined],
  ['collections.create', { name: 'Picks' }],
  ['collections.update', { id: 1, name: 'Best' }],
  ['collections.delete', { id: 1 }],
  ['collections.addGames', { id: 1, gameIds: [1] }],
  ['collections.removeGames', { id: 1, gameIds: [1] }],
  ['collections.reorder', { id: 1, gameId: 1, swapWithGameId: 2 }],
  ['collections.move', { id: 1, gameIds: [1], beforeGameId: null }],
  ['collections.gameIds', { id: 1 }],
  ['smartFilters.list', undefined],
  ['menus.list', undefined],
  ['menus.draft', undefined],
  ['frontend.resolveMenu', { draft: { title: 'X', nodes: [] } }],
];

describe('game library handlers', () => {
  it('FR-LIB-6: library channels fail with LIBRARY_UNAVAILABLE when the library could not open', async () => {
    const { router } = await setup(false);
    for (const [channel, input] of LIBRARY_CHANNELS) {
      expect(await router.handle(channel, input), channel).toMatchObject({
        ok: false,
        error: { code: 'LIBRARY_UNAVAILABLE' },
      });
    }
  });

  it('FR-LIB-8: collections.move drags games before another member', async () => {
    const { router, seed } = await setup(true);
    const [a = 0, b = 0] = seed('nintendo-64', ['Alpha', 'Bravo']);
    await router.handle('collections.create', { name: 'Picks' });
    await router.handle('collections.addGames', { id: 1, gameIds: [a, b] });
    expect(
      await router.handle('collections.move', { id: 1, gameIds: [b], beforeGameId: a }),
    ).toEqual({ ok: true, value: undefined });
    const listed = await router.handle('library.games.list', {
      scope: { kind: 'collection', collectionId: 1 },
      tab: 'all',
      offset: 0,
      limit: 10,
    });
    const page = listed as { ok: true; value: { games: Array<{ title: string }> } };
    expect(page.value.games.map((game) => game.title)).toEqual(['Bravo', 'Alpha']);
    expect(await router.handle('collections.gameIds', { id: 1 })).toEqual({
      ok: true,
      value: [b, a],
    });
  });

  it('FR-LIB-7: setFlags emits library.changed with the systems and games', async () => {
    const { router, seed, events } = await setup(true);
    const [a = 0] = seed('nintendo-64', ['Alpha']);
    expect(
      await router.handle('library.games.setFlags', { gameIds: [a], flags: { hidden: true } }),
    ).toEqual({ ok: true, value: undefined });
    expect(events).toEqual([
      { event: 'library.changed', payload: { systems: ['nintendo-64'], gameIds: [a] } },
    ]);
    await router.handle('library.games.updateMetadata', { gameId: a, changes: { title: 'B' } });
    expect(events).toHaveLength(2);
  });

  it('FR-LIB-6: reveal opens the stored file, never a path from the renderer', async () => {
    const { router, seed, revealed } = await setup(true);
    const [here = 0, gone = 0] = seed('nintendo-64', [
      { title: 'Here', relPath: 'Here.z64' },
      { title: 'Gone', relPath: 'USA/Gone.z64', missing: true },
    ]);
    expect(
      await router.handle('library.games.reveal', { gameId: here, path: 'C:\\Windows' }),
    ).toMatchObject({ ok: false, error: { code: 'VALIDATION_FAILED' } });
    await router.handle('library.games.reveal', { gameId: here });
    await router.handle('library.games.reveal', { gameId: gone });
    expect(revealed).toEqual([join('X:', 'roms', 'nintendo-64', 'Here.z64'), join('X:', 'roms')]);
  });

  it('FR-LIB-8: collection channels create, fill and list collections', async () => {
    const { router, seed } = await setup(true);
    const [a = 0] = seed('nintendo-64', ['Alpha']);
    const created = await router.handle('collections.create', { name: ' Picks ' });
    expect(created).toMatchObject({ ok: true, value: { name: 'Picks', games: 0 } });
    expect(await router.handle('collections.create', { name: 'picks' })).toMatchObject({
      ok: false,
      error: { code: 'NAME_TAKEN' },
    });
    await router.handle('collections.addGames', { id: 1, gameIds: [a] });
    expect(await router.handle('collections.list', undefined)).toEqual({
      ok: true,
      value: [{ id: 1, name: 'Picks', sort: 'manual', games: 1 }],
    });
  });

  it('FR-MENU-2: collection changes a menu can show announce menus.changed', async () => {
    const { router, seed, events } = await setup(true);
    const [a = 0] = seed('nintendo-64', ['Alpha']);
    const menuEvents = () => events.filter((entry) => entry.event === 'menus.changed').length;
    // The generated menu lists every collection (FR-MENU-3).
    await router.handle('collections.create', { name: 'Picks' });
    expect(menuEvents()).toBe(1);
    await router.handle('collections.update', { id: 1, name: 'Best' });
    expect(menuEvents()).toBe(2);
    await router.handle('collections.addGames', { id: 1, gameIds: [a] });
    await router.handle('collections.removeGames', { id: 1, gameIds: [a] });
    await router.handle('collections.reorder', { id: 1, gameId: a, swapWithGameId: a });
    expect(menuEvents()).toBe(4);
    await router.handle('collections.update', { id: 99, name: 'None' });
    expect(menuEvents()).toBe(4);
    await router.handle('collections.delete', { id: 1 });
    expect(events.at(-1)).toEqual({ event: 'menus.changed', payload: {} });
  });
});
