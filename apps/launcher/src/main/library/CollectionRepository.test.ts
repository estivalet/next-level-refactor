import type { GameListQuery } from '@nextlevel/shared';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { CollectionRepository } from './CollectionRepository.ts';
import { GameRepository } from './GameRepository.ts';
import { appErrorOf, seedGames, tempLibrary } from './testing.ts';

const NOW = new Date(Date.UTC(2026, 9, 21, 12, 0, 0));

let library: Awaited<ReturnType<typeof tempLibrary>>;
let collections: CollectionRepository;
let games: GameRepository;
beforeEach(async () => {
  library = await tempLibrary();
  collections = new CollectionRepository(library.db, () => NOW);
  games = new GameRepository(library.db, (row) => row.relPath);
});
afterEach(async () => {
  await library.cleanup();
});

const listed = (collectionId: number, overrides: Partial<GameListQuery> = {}) =>
  games
    .list({
      scope: { kind: 'collection', collectionId },
      tab: 'all',
      offset: 0,
      limit: 100,
      ...overrides,
    })
    .games.map((game) => game.title);

describe('CollectionRepository', () => {
  it('FR-LIB-8: create, rename and delete a collection; names are unique ignoring case', () => {
    const picks = collections.create('Picks');
    expect(picks).toEqual({ id: picks.id, name: 'Picks', sort: 'manual', games: 0 });
    collections.create('arcade');
    expect(appErrorOf(() => collections.create('PICKS')).code).toBe('NAME_TAKEN');
    expect(appErrorOf(() => collections.update(picks.id, { name: 'Arcade' })).code).toBe(
      'NAME_TAKEN',
    );
    expect(collections.update(picks.id, { name: 'Best' }).name).toBe('Best');
    expect(collections.list().map((c) => c.name)).toEqual(['arcade', 'Best']);
    collections.delete(picks.id);
    expect(collections.list().map((c) => c.name)).toEqual(['arcade']);
    expect(
      appErrorOf(() => {
        collections.delete(picks.id);
      }).code,
    ).toBe('NOT_FOUND');
    expect(appErrorOf(() => collections.update(picks.id, { sort: 'year' })).code).toBe('NOT_FOUND');
    expect(appErrorOf(() => listed(picks.id)).code).toBe('NOT_FOUND');
  });

  it('FR-LIB-8: games from any system are added in order and listed by position', () => {
    const [b = 0, a = 0] = seedGames(library.db, 'nintendo-64', ['Bravo', 'Alpha']);
    const [c = 0] = seedGames(library.db, 'snes', ['Charlie']);
    const { id } = collections.create('Picks');
    collections.addGames(id, [c, b]);
    const summary = collections.addGames(id, [b, a]);
    expect(summary.games).toBe(3);
    expect(listed(id)).toEqual(['Charlie', 'Bravo', 'Alpha']);
    expect(collections.membership(a)).toEqual([id]);
    expect(appErrorOf(() => collections.addGames(id, [999])).code).toBe('NOT_FOUND');
    expect(collections.list()[0]?.games).toBe(3);
  });

  it('FR-LIB-8: a collection orders manually, by title or by year', () => {
    const ids = seedGames(library.db, 'snes', [
      { title: 'Charlie', year: 1990 },
      { title: 'Alpha', year: 1995 },
      { title: 'Bravo' },
    ]);
    const [charlie = 0, alpha = 0, bravo = 0] = ids;
    const { id } = collections.create('Picks');
    collections.addGames(id, ids);
    collections.reorder(id, bravo, alpha);
    expect(listed(id)).toEqual(['Charlie', 'Bravo', 'Alpha']);
    collections.update(id, { sort: 'title' });
    expect(listed(id)).toEqual(['Alpha', 'Bravo', 'Charlie']);
    expect(collections.update(id, { sort: 'year' }).sort).toBe('year');
    expect(listed(id)).toEqual(['Charlie', 'Alpha', 'Bravo']);
    collections.removeGames(id, [alpha]);
    collections.update(id, { sort: 'manual' });
    expect(listed(id)).toEqual(['Charlie', 'Bravo']);
    collections.reorder(id, charlie, bravo);
    expect(listed(id)).toEqual(['Bravo', 'Charlie']);
  });

  it('FR-LIB-8: moving swaps with the neighbour shown, even past hidden members', () => {
    const [b = 0, a = 0, c = 0] = seedGames(library.db, 'snes', [
      'Bravo',
      { title: 'Alpha', hidden: true },
      'Charlie',
    ]);
    const { id } = collections.create('Picks');
    collections.addGames(id, [b, a, c]);
    expect(listed(id)).toEqual(['Bravo', 'Charlie']);
    collections.reorder(id, b, c);
    expect(listed(id)).toEqual(['Charlie', 'Bravo']);
    expect(listed(id, { tab: 'hidden' })).toEqual(['Alpha']);
    expect(
      appErrorOf(() => {
        collections.reorder(id, b, 999);
      }).code,
    ).toBe('NOT_FOUND');
  });

  it('FR-LIB-8: deleting a collection or a game removes the memberships', () => {
    const [kept = 0, gone = 0] = seedGames(library.db, 'snes', [
      { title: 'Kept', missing: true },
      'Gone',
    ]);
    const first = collections.create('First');
    const second = collections.create('Second');
    collections.addGames(first.id, [kept, gone]);
    collections.addGames(second.id, [kept]);
    library.db.$client.prepare('delete from games where id = ?').run(gone);
    expect(collections.list().map((c) => [c.name, c.games])).toEqual([
      ['First', 1],
      ['Second', 1],
    ]);
    const rows = games.list({
      scope: { kind: 'collection', collectionId: first.id },
      tab: 'all',
      offset: 0,
      limit: 10,
    }).games;
    expect(rows.map((row) => [row.title, row.missing])).toEqual([['Kept', true]]);
    collections.delete(first.id);
    expect(collections.membership(kept)).toEqual([second.id]);
  });
});
