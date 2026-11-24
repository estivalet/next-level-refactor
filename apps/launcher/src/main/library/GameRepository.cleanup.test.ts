import type { GameScope, GameTab } from '@nextlevel/shared';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { GameRepository } from './GameRepository.ts';
import { seedGames, tempLibrary } from './testing.ts';

let library: Awaited<ReturnType<typeof tempLibrary>>;
let games: GameRepository;
beforeEach(async () => {
  library = await tempLibrary();
  games = new GameRepository(library.db, (row) => row.relPath);
});
afterEach(async () => {
  await library.cleanup();
});

const system: GameScope = { kind: 'system', systemId: 'gamegear' };
const listed = (tab: GameTab, scope: GameScope = system, filter?: string) =>
  games
    .list({ scope, tab, offset: 0, limit: 100, ...(filter ? { filter } : {}) })
    .games.map((game) => game.id)
    .sort((a, b) => a - b);

describe('Delete later (FR-LIB-19)', () => {
  it('FR-LIB-19: setFlags marks and unmarks Delete later', () => {
    const [a = 0, b = 0] = seedGames(library.db, 'gamegear', ['Alpha', 'Beta', 'Gamma']);
    games.setFlags([a, b], { deleteLater: true });
    const page = games.list({ scope: system, tab: 'deleteLater', offset: 0, limit: 100 });
    expect(page.games.map((game) => [game.id, game.deleteLater])).toEqual([
      [a, true],
      [b, true],
    ]);
    games.setFlags([b], { deleteLater: false });
    expect(listed('deleteLater')).toEqual([a]);
    expect(games.get(a).deleteLater).toBe(true);
  });

  it('US-C13: Delete later keeps hidden games and drops missing ones', () => {
    const [hidden = 0, missing = 0] = seedGames(library.db, 'gamegear', [
      { title: 'Hidden one', hidden: true },
      { title: 'Gone one', missing: true },
    ]);
    games.setFlags([hidden, missing], { deleteLater: true });
    expect(listed('deleteLater')).toEqual([hidden]);
    expect(games.facets(system, 'all').tabs.deleteLater).toBe(1);
  });

  it('FR-LIB-19: list rows carry relPath', () => {
    seedGames(library.db, 'gamegear', [
      { title: 'Coca-Cola Kid', relPath: '! Translated/Coca-Cola Kid [T-En by A].gg' },
    ]);
    const [row] = games.list({ scope: system, tab: 'all', offset: 0, limit: 10 }).games;
    expect(row?.relPath).toBe('! Translated/Coca-Cola Kid [T-En by A].gg');
  });
});
