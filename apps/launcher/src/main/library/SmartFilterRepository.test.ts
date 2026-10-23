import type { SmartFilterQueryInput } from '@nextlevel/shared';
import { SmartFilterQuerySchema } from '@nextlevel/shared';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { v7 as uuidv7 } from 'uuid';
import { MenuRepository } from '../menus/MenuRepository.ts';
import { GameRepository } from './GameRepository.ts';
import { SmartFilterRepository } from './SmartFilterRepository.ts';
import { appErrorOf, seedGames, tempLibrary } from './testing.ts';

const NOW = new Date(Date.UTC(2026, 9, 21, 12, 0, 0));
const BUILT_INS = { favorites: 'Favorites', recent: 'Recently played', mostPlayed: 'Most played' };

let library: Awaited<ReturnType<typeof tempLibrary>>;
let filters: SmartFilterRepository;
beforeEach(async () => {
  library = await tempLibrary();
  filters = new SmartFilterRepository(library.db, () => NOW);
});
afterEach(async () => {
  await library.cleanup();
});

const q = (input: SmartFilterQueryInput) => SmartFilterQuerySchema.parse(input);

function titles(input: SmartFilterQueryInput): string[] {
  const { id } = filters.create(`f-${String(Math.random())}`, q(input));
  const ids = filters.gameIds(id);
  const byId = new Map(
    (
      library.db.$client.prepare('select game_id as id, title from game_metadata').all() as Array<{
        id: number;
        title: string;
      }>
    ).map((row) => [row.id, row.title]),
  );
  return ids.map((gameId) => byId.get(gameId) ?? '?');
}

describe('SmartFilterRepository', () => {
  it('FR-LIB-9: a summary counts the menus that show the filter', () => {
    const shown = filters.create('Shown', q({}));
    filters.create('Unused', q({}));
    const menus = new MenuRepository(library.db, () => NOW, uuidv7);
    const node = () => ({
      id: uuidv7(),
      type: 'smartFilter' as const,
      refId: String(shown.id),
      name: 'Shown',
      displayName: null,
      shortName: null,
      filterTabs: true,
      visible: true,
      children: [],
    });
    menus.create('A', [node(), node()]);
    menus.create('B', [node()]);
    expect(filters.list().map((f) => [f.name, f.menus])).toEqual([
      ['Shown', 2],
      ['Unused', 0],
    ]);
  });

  it('FR-LIB-9: favorites only returns favorite games, hidden ones included', () => {
    seedGames(library.db, 'snes', [
      { title: 'Alpha', favorite: true },
      { title: 'Beta' },
      { title: 'Gamma', favorite: true, hidden: true },
    ]);
    expect(titles({ favorite: true })).toEqual(['Alpha', 'Gamma']);
  });

  it('FR-LIB-9: never played includes games without a state row', () => {
    seedGames(library.db, 'snes', [{ title: 'Alpha', playCount: 2 }, { title: 'Beta' }]);
    expect(titles({ played: 'never' })).toEqual(['Beta']);
    expect(titles({ played: 'played' })).toEqual(['Alpha']);
  });

  it('FR-LIB-9: genre matches a part of the text, and % is a literal', () => {
    seedGames(library.db, 'snes', [
      { title: 'Alpha', genre: "Shoot 'em up" },
      { title: 'Beta', genre: 'Puzzle' },
      { title: 'Gamma', genre: '100% Fun' },
    ]);
    expect(titles({ genre: 'SHOOT' })).toEqual(['Alpha']);
    expect(titles({ genre: '%' })).toEqual(['Gamma']);
    expect(titles({ genre: '_' })).toEqual([]);
  });

  it('FR-LIB-9: minimum players reads the largest number in the players text', () => {
    seedGames(library.db, 'snes', [
      { title: 'Alpha', players: '1-4' },
      { title: 'Beta', players: '1' },
      { title: 'Gamma' },
    ]);
    expect(titles({ minPlayers: 2 })).toEqual(['Alpha']);
  });

  it('FR-LIB-9: played within N days counts back from now', () => {
    seedGames(library.db, 'snes', [
      { title: 'Alpha', playCount: 1, lastPlayedAt: '2026-10-20T10:00:00.000Z' },
      { title: 'Beta', playCount: 1, lastPlayedAt: '2026-10-01T10:00:00.000Z' },
    ]);
    expect(titles({ playedWithinDays: 7 })).toEqual(['Alpha']);
  });

  it('FR-LIB-9: systems, filters and years narrow; sort and limit order the result', () => {
    seedGames(library.db, 'snes', [
      { title: 'Alpha', year: 1991, playCount: 1, filters: ['homebrew'] },
      { title: 'Beta', year: 1995, playCount: 9 },
      { title: 'Gamma', year: 1993, playCount: 5, filters: ['hack'] },
    ]);
    seedGames(library.db, 'nes', [{ title: 'Delta', year: 1990, playCount: 7 }]);
    expect(titles({ systems: ['snes'], sort: 'playCount', limit: 2 })).toEqual(['Beta', 'Gamma']);
    expect(titles({ filters: ['hack', 'homebrew'] })).toEqual(['Alpha', 'Gamma']);
    expect(titles({ yearFrom: 1991, yearTo: 1993, sort: 'year' })).toEqual(['Alpha', 'Gamma']);
  });

  it('FR-LIB-9: missing games never match', () => {
    seedGames(library.db, 'snes', [{ title: 'Alpha', favorite: true, missing: true }]);
    expect(titles({ favorite: true })).toEqual([]);
  });

  it('FR-LIB-9: list shows each filter with its game count; names are unique ignoring case', () => {
    seedGames(library.db, 'snes', [{ title: 'Alpha', favorite: true }, 'Beta']);
    const favs = filters.create('Favs', q({ favorite: true }));
    expect(filters.list()).toEqual([
      { id: favs.id, name: 'Favs', query: q({ favorite: true }), games: 1, menus: 0 },
    ]);
    expect(appErrorOf(() => filters.create('FAVS', q({}))).code).toBe('NAME_TAKEN');
    expect(filters.update(favs.id, { name: 'Loved' }).name).toBe('Loved');
    filters.delete(favs.id);
    expect(filters.list()).toEqual([]);
    expect(
      appErrorOf(() => {
        filters.delete(favs.id);
      }).code,
    ).toBe('NOT_FOUND');
  });

  it('D10: built-ins are seeded once, even after they are deleted', () => {
    filters.seedBuiltIns(BUILT_INS);
    expect(filters.list().map((filter) => filter.name)).toEqual([
      'Favorites',
      'Most played',
      'Recently played',
    ]);
    const recent = filters.list().find((filter) => filter.name === 'Recently played');
    expect(recent?.query).toEqual(q({ played: 'played', sort: 'lastPlayed', limit: 50 }));
    for (const filter of filters.list()) filters.delete(filter.id);
    filters.seedBuiltIns(BUILT_INS);
    expect(filters.list()).toEqual([]);
  });

  it('FR-LIB-9: the Library lists a smart filter in its order, with tabs on top', () => {
    seedGames(library.db, 'snes', [
      { title: 'Alpha', playCount: 1, lastPlayedAt: '2026-10-10T10:00:00.000Z' },
      { title: 'Beta', playCount: 1, lastPlayedAt: '2026-10-20T10:00:00.000Z', favorite: true },
      { title: 'Gamma', playCount: 1, lastPlayedAt: '2026-10-15T10:00:00.000Z', hidden: true },
    ]);
    const recent = filters.create('Recent', q({ played: 'played', sort: 'lastPlayed' }));
    const games = new GameRepository(
      library.db,
      (row) => row.relPath,
      () => NOW,
    );
    const list = (tab: 'all' | 'favorites' | 'hidden') =>
      games
        .list({
          scope: { kind: 'smartFilter', smartFilterId: recent.id },
          tab,
          offset: 0,
          limit: 10,
        })
        .games.map((game) => game.title);
    expect(list('all')).toEqual(['Beta', 'Alpha']);
    expect(list('favorites')).toEqual(['Beta']);
    expect(list('hidden')).toEqual(['Gamma']);
  });
});
