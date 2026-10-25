import type { GameListQuery } from '@nextlevel/shared';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { GameRepository } from './GameRepository.ts';
import { MediaRepository } from './MediaRepository.ts';
import { appErrorOf, seedGames, tempLibrary } from './testing.ts';

let library: Awaited<ReturnType<typeof tempLibrary>>;
let games: GameRepository;
beforeEach(async () => {
  library = await tempLibrary();
  games = new GameRepository(library.db, (row) => `X:/${row.systemId}/${row.relPath}`);
});
afterEach(async () => {
  await library.cleanup();
});

const N64 = { kind: 'system', systemId: 'nintendo-64' } as const;
const query = (overrides: Partial<GameListQuery> = {}): GameListQuery => ({
  scope: N64,
  tab: 'all',
  offset: 0,
  limit: 100,
  ...overrides,
});
const titles = (overrides: Partial<GameListQuery> = {}) =>
  games.list(query(overrides)).games.map((game) => game.title);

describe('GameRepository.list', () => {
  it('FR-LIB-7: the All tab hides hidden games; Hidden and Favorites tabs filter', () => {
    seedGames(library.db, 'nintendo-64', [
      { title: 'Alpha', favorite: true },
      { title: 'Bravo', hidden: true },
      { title: 'Charlie', missing: true },
      'Delta',
      { title: 'Echo', hidden: true, favorite: true, missing: true },
    ]);
    seedGames(library.db, 'sega-genesis', ['Other System']);
    expect(titles()).toEqual(['Alpha', 'Charlie', 'Delta']);
    expect(games.list(query()).total).toBe(3);
    expect(titles({ tab: 'favorites' })).toEqual(['Alpha']);
    expect(titles({ tab: 'hidden' })).toEqual(['Bravo', 'Echo']);
    expect(titles({ tab: 'missing' })).toEqual(['Charlie']);
  });

  it('FR-LIB-4: missing games are listed with their expected path', () => {
    seedGames(library.db, 'nintendo-64', [
      { title: 'Here' },
      { title: 'Gone', missing: true, relPath: 'USA/Gone.z64' },
    ]);
    const rows = games.list(query()).games;
    expect(rows.map((row) => [row.title, row.missing, row.expectedPath])).toEqual([
      ['Gone', true, 'X:/nintendo-64/USA/Gone.z64'],
      ['Here', false, null],
    ]);
  });

  it('FR-LIB-6: lists sort by title, year (nulls last), rating and added', () => {
    seedGames(library.db, 'nintendo-64', [
      { title: 'Bravo', year: 1998, userRating: 2, addedAt: '2026-01-02T00:00:00.000Z' },
      { title: 'alpha', userRating: 5, addedAt: '2026-01-03T00:00:00.000Z' },
      { title: 'Charlie', year: 1996, addedAt: '2026-01-01T00:00:00.000Z' },
    ]);
    expect(titles()).toEqual(['alpha', 'Bravo', 'Charlie']);
    expect(titles({ sort: 'year' })).toEqual(['Charlie', 'Bravo', 'alpha']);
    expect(titles({ sort: 'rating' })).toEqual(['alpha', 'Bravo', 'Charlie']);
    expect(titles({ sort: 'added' })).toEqual(['alpha', 'Bravo', 'Charlie']);
  });

  it('FR-LIB-6: pages slice the sorted list and keep the total', () => {
    seedGames(library.db, 'nintendo-64', ['A1', 'A2', 'A3', 'A4', 'A5']);
    const page = games.list(query({ offset: 2, limit: 2 }));
    expect(page.total).toBe(5);
    expect(page.offset).toBe(2);
    expect(page.games.map((game) => game.title)).toEqual(['A3', 'A4']);
  });

  it('FR-LIB-6: in-list text filters within the system only', () => {
    seedGames(library.db, 'nintendo-64', [
      'Zelda Quest',
      'Racer',
      { title: 'Zelda Hidden', hidden: true },
    ]);
    seedGames(library.db, 'sega-genesis', ['Zelda Elsewhere']);
    expect(titles({ text: 'zel' })).toEqual(['Zelda Quest']);
    expect(games.list(query({ text: 'zel' })).total).toBe(1);
    expect(titles({ text: 'z' })).toEqual(['Racer', 'Zelda Quest']);
  });
});

describe('GameRepository.get', () => {
  it('FR-LIB-6: details carry metadata, user state and file facts', () => {
    const [id] = seedGames(library.db, 'nintendo-64', [
      { title: 'Racer', year: 1999, genre: 'Racing', favorite: true, userRating: 4 },
    ]);
    const details = games.get(id ?? 0);
    expect(details).toMatchObject({
      id,
      systemId: 'nintendo-64',
      title: 'Racer',
      year: 1999,
      genre: 'Racing',
      favorite: true,
      hidden: false,
      userRating: 4,
      missing: false,
      expectedPath: null,
      relPath: 'Racer.zip',
      filters: [],
      lockedFields: [],
      playCount: 0,
      lastPlayedAt: null,
      collectionIds: [],
      scrape: null,
      media: {},
    });
  });

  it('FR-SCR-5: details carry the indexed media kinds with their versions', () => {
    const [id = 0] = seedGames(library.db, 'snes', ['Racer']);
    new MediaRepository(library.db).upsert({
      gameId: id,
      kind: 'box-front',
      path: 'C:/r.png',
      size: 1,
      version: 42,
    });
    expect(games.get(id).media).toEqual({ 'box-front': 42 });
  });

  it('FR-LIB-6: an unknown game is NOT_FOUND', () => {
    expect(appErrorOf(() => games.get(999)).code).toBe('NOT_FOUND');
  });
});

describe('GameRepository.search', () => {
  it('FR-LIB-10: search spans systems, ranks title prefixes first and skips hidden games', () => {
    seedGames(library.db, 'nintendo-64', [
      'The Legend of Zelda',
      { title: 'Zelda Hidden', hidden: true },
    ]);
    seedGames(library.db, 'snes', ['Zelda II', 'Racer']);
    const result = games.search('zelda');
    expect(result.games.map((game) => [game.title, game.systemId])).toEqual([
      ['Zelda II', 'snes'],
      ['The Legend of Zelda', 'nintendo-64'],
    ]);
    expect(result.more).toBe(false);
  });

  it('FR-LIB-10: results stop at the limit and say there are more', () => {
    seedGames(library.db, 'snes', ['Star 1', 'Star 2', 'Star 3']);
    const result = games.search('star', 2);
    expect(result.games).toHaveLength(2);
    expect(result.more).toBe(true);
  });

  it('FR-LIB-10: diacritics fold and short text finds nothing', () => {
    seedGames(library.db, 'snes', ['École Quest']);
    expect(games.search('ecole').games.map((game) => game.title)).toEqual(['École Quest']);
    expect(games.search('e').games).toEqual([]);
    expect(games.search('"*').games).toEqual([]);
  });

  it('FR-LIB-10: systemOf names the systems of the given games', () => {
    const [a] = seedGames(library.db, 'snes', ['A1']);
    const [b, c] = seedGames(library.db, 'nes', ['B1', 'B2']);
    expect(games.systemOf([a ?? 0, b ?? 0, c ?? 0]).sort()).toEqual(['nes', 'snes']);
  });
});
