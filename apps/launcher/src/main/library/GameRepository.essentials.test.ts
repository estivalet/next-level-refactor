import type { GameListQuery } from '@nextlevel/shared';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { CollectionRepository } from './CollectionRepository.ts';
import { GameRepository } from './GameRepository.ts';
import { seedGames, tempLibrary } from './testing.ts';

let library: Awaited<ReturnType<typeof tempLibrary>>;
let games: GameRepository;
beforeEach(async () => {
  library = await tempLibrary();
  games = new GameRepository(library.db, (row) => `X:/${row.systemId}/${row.relPath}`);
});
afterEach(async () => {
  await library.cleanup();
});

const SNES = { kind: 'system', systemId: 'snes' } as const;
const titles = (overrides: Partial<GameListQuery> = {}) =>
  games
    .list({ scope: SNES, tab: 'all', offset: 0, limit: 100, ...overrides })
    .games.map((game) => game.title);

/** Mario and Zelda are in "SNES Essentials", Zelda also in "Top essentials"; Party only in "Party". */
function seed() {
  const [mario = 0, zelda = 0, party = 0] = seedGames(library.db, 'snes', [
    'Mario',
    'Zelda',
    'Party',
    'Loose',
  ]);
  const collections = new CollectionRepository(library.db, () => new Date());
  collections.addGames(collections.create('SNES Essentials').id, [mario, zelda]);
  collections.addGames(collections.create('Top essentials').id, [zelda]);
  collections.addGames(collections.create('Party').id, [party]);
}

describe('Essentials only (D63)', () => {
  it('D63: essentials narrows a system list to games in an Essentials collection', () => {
    seed();
    expect(titles({ essentials: true })).toEqual(['Mario', 'Zelda']);
    expect(titles()).toEqual(['Loose', 'Mario', 'Party', 'Zelda']);
  });

  it("D63: facets count the scope's Essentials games once each", () => {
    seed();
    expect(games.facets(SNES, 'all').essentials).toBe(2);
    expect(games.facets({ kind: 'system', systemId: 'nes' }, 'all').essentials).toBe(0);
  });
});
