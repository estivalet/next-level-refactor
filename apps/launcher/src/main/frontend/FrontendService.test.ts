import { defaultSettings, type Settings } from '@nextlevel/shared';
import { afterEach, describe, expect, it } from 'vitest';
import { CollectionRepository } from '../library/CollectionRepository.ts';
import { MediaRepository } from '../library/MediaRepository.ts';
import { appErrorOf, seedGames, tempLibrary } from '../library/testing.ts';
import { system } from '../scan/testing.ts';
import { FrontendService } from './FrontendService.ts';

const cleanups: Array<() => Promise<void>> = [];
afterEach(async () => {
  for (const cleanup of cleanups.splice(0)) await cleanup();
});

const CATALOG = [
  system('snes', { name: 'Super Nintendo', manufacturer: 'Nintendo' }),
  system('n64', { name: 'Nintendo 64', manufacturer: 'Nintendo' }),
  system('genesis', { name: 'Sega Genesis', manufacturer: 'Sega' }),
];

async function setup(
  systems: Settings['systems'] = {
    snes: { enabled: true },
    n64: { enabled: true },
    genesis: { enabled: false },
  },
) {
  const library = await tempLibrary();
  cleanups.push(library.cleanup);
  const settings: Settings = { ...defaultSettings(), systems };
  const collections = new CollectionRepository(library.db, () => new Date(Date.UTC(2026, 9, 21)));
  const media = new MediaRepository(library.db);
  const service = new FrontendService({
    db: library.db,
    catalog: () => CATALOG,
    settings: () => settings,
    collections,
  });
  const tag = (gameId: number, filter: string) => {
    library.db.$client
      .prepare('insert into game_filters (game_id, filter) values (?, ?)')
      .run(gameId, filter);
  };
  return { library, service, collections, media, tag };
}

describe('FrontendService.menu', () => {
  it('FR-MENU-3: enabled systems with present games, grouped by manufacturer', async () => {
    const { library, service, tag } = await setup();
    const [a, b] = seedGames(library.db, 'snes', ['Alpha', 'Beta']);
    seedGames(library.db, 'n64', [{ title: 'Gone', missing: true }]);
    seedGames(library.db, 'genesis', ['Sonic']);
    tag(a ?? 0, 'official');
    tag(b ?? 0, 'homebrew');
    const tree = service.menu();
    expect(tree.items.map((node) => node.id)).toEqual(['m:nintendo']);
    const snes = tree.items[0]?.children[0];
    expect(snes?.id).toBe('s:snes');
    expect(snes?.children.map((node) => node.id)).toEqual([
      's:snes:f:official',
      's:snes:f:homebrew',
    ]);
  });

  it('FR-LIB-8: collections are listed', async () => {
    const { library, service, collections } = await setup();
    seedGames(library.db, 'snes', ['Alpha']);
    collections.create('Picks');
    expect(
      service
        .menu()
        .items.at(-1)
        ?.children.map((node) => node.name),
    ).toEqual(['Picks']);
  });
});

describe('FrontendService.games', () => {
  it('FR-THM-6: a system level has its present games by title, hidden ones flagged', async () => {
    const { library, service, media, tag } = await setup();
    const [zeta, alpha] = seedGames(library.db, 'snes', [
      { title: 'Zeta', year: 1994, favorite: true },
      { title: 'Alpha', hidden: true },
      { title: 'Gone', missing: true },
    ]);
    tag(zeta ?? 0, 'official');
    media.replaceForSystem('snes', [
      { gameId: zeta ?? 0, kind: 'video', path: 'C:\\z.mp4', size: 1 },
      { gameId: zeta ?? 0, kind: 'box-front', path: 'C:\\z.png', size: 1 },
    ]);
    const games = service.games('s:snes');
    expect(games.map((g) => [g.title, g.hidden, g.favorite])).toEqual([
      ['Alpha', true, false],
      ['Zeta', false, true],
    ]);
    expect(games[1]).toMatchObject({
      id: zeta,
      systemId: 'snes',
      year: 1994,
      filters: ['official'],
      playCount: 0,
      lastPlayedAt: null,
      media: ['box-front', 'video'],
    });
    expect(games[0]?.id).toBe(alpha);
    expect(games[0]?.media).toEqual([]);
  });

  it('FR-THM-6: a filter level only has games carrying that filter', async () => {
    const { library, service, tag } = await setup();
    const [a, b] = seedGames(library.db, 'snes', ['Alpha', 'Beta']);
    tag(a ?? 0, 'official');
    tag(b ?? 0, 'homebrew');
    expect(service.games('s:snes:f:homebrew').map((g) => g.title)).toEqual(['Beta']);
  });

  it('FR-LIB-8: a collection level follows the collection order', async () => {
    const { library, service, collections } = await setup();
    const [a, b] = seedGames(library.db, 'snes', ['Alpha', 'Beta']);
    const [c] = seedGames(library.db, 'n64', ['Gamma']);
    const picks = collections.create('Picks');
    collections.addGames(picks.id, [c ?? 0, b ?? 0, a ?? 0]);
    expect(service.games(`c:${String(picks.id)}`).map((g) => g.title)).toEqual([
      'Gamma',
      'Beta',
      'Alpha',
    ]);
  });

  it('FR-THM-6: unknown or non-game nodes are NOT_FOUND', async () => {
    const { service } = await setup();
    for (const id of ['m:nintendo', 's:nope', 'c:99', 'x', 's:snes:f:']) {
      expect(appErrorOf(() => service.games(id)).code, id).toBe('NOT_FOUND');
    }
  });
});
