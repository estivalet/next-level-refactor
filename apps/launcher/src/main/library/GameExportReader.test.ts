import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { CollectionRepository } from './CollectionRepository.ts';
import { GameExportReader } from './GameExportReader.ts';
import { seedGames, tempLibrary } from './testing.ts';

const cleanups: Array<() => Promise<void>> = [];
afterEach(async () => {
  for (const cleanup of cleanups.splice(0)) await cleanup();
});

async function setup() {
  const temp = await tempLibrary();
  cleanups.push(temp.cleanup);
  const reader = new GameExportReader(
    temp.db,
    (row) => join('X:', 'roms', row.systemId, row.relPath),
    (id) => (id === 'nintendo-64' ? 'Nintendo 64' : id),
  );
  return { ...temp, reader };
}

const N64 = { kind: 'system', systemId: 'nintendo-64' } as const;

describe('GameExportReader', () => {
  it('FR-LIB-11: every game of a system, hidden and missing ones too, by title', async () => {
    const { db, reader } = await setup();
    const [racer] = seedGames(db, 'nintendo-64', [
      {
        title: 'Racer',
        year: 1997,
        genre: 'Racing',
        favorite: true,
        playCount: 2,
        filters: ['hack'],
      },
      { title: 'Adventure', hidden: true },
      { title: 'Zebra', missing: true },
    ]);
    seedGames(db, 'sega-genesis', ['Other']);
    db.$client
      .prepare(
        `update game_metadata set developer = 'Studio', description = 'Fast.', rating = 4
         where game_id = ?`,
      )
      .run(racer);

    const games = reader.read(N64, null);

    expect(games.map((game) => game.title)).toEqual(['Adventure', 'Racer', 'Zebra']);
    expect(games[1]).toEqual({
      title: 'Racer',
      system: 'Nintendo 64',
      year: 1997,
      genre: 'Racing',
      players: null,
      developer: 'Studio',
      publisher: null,
      region: null,
      description: 'Fast.',
      rating: 4,
      userRating: null,
      favorite: true,
      completed: false,
      hidden: false,
      missing: false,
      path: join('X:', 'roms', 'nintendo-64', 'Racer.zip'),
      relPath: 'Racer.zip',
      playCount: 2,
      lastPlayed: null,
      added: '2026-10-21T12:00:00.000Z',
      filters: ['hack'],
    });
    expect(games[0]?.hidden).toBe(true);
    expect(games[2]?.missing).toBe(true);
  });

  it('FR-LIB-11: the shown list keeps its tab, genre and sort', async () => {
    const { db, reader } = await setup();
    seedGames(db, 'nintendo-64', [
      { title: 'Alpha', year: 1999, genre: 'Racing', favorite: true },
      { title: 'Beta', year: 1990, genre: 'Racing', favorite: true },
      { title: 'Gamma', year: 1980, genre: 'Puzzle', favorite: true },
      { title: 'Delta', year: 1985, genre: 'Racing' },
    ]);

    const games = reader.read(N64, { tab: 'favorites', sort: 'year', genre: 'Racing' });

    expect(games.map((game) => game.title)).toEqual(['Beta', 'Alpha']);
  });

  it('FR-LIB-11: a collection exports in its own order across systems', async () => {
    const { db, reader } = await setup();
    const [a] = seedGames(db, 'nintendo-64', ['Alpha']);
    const [b] = seedGames(db, 'sega-genesis', ['Beta']);
    const collections = new CollectionRepository(db, () => new Date(Date.UTC(2026, 9, 21)));
    const { id } = collections.create('Picks');
    collections.update(id, { sort: 'manual' });
    collections.addGames(id, [b ?? 0, a ?? 0]);

    const games = reader.read({ kind: 'collection', collectionId: id }, null);

    expect(games.map((game) => [game.title, game.system])).toEqual([
      ['Beta', 'sega-genesis'],
      ['Alpha', 'Nintendo 64'],
    ]);
  });

  it('FR-LIB-11: NOT_FOUND for a collection that is gone', async () => {
    const { reader } = await setup();
    expect(() => reader.read({ kind: 'collection', collectionId: 99 }, null)).toThrow();
  });
});
