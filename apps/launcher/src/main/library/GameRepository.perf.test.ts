import { performance } from 'node:perf_hooks';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { GameRepository } from './GameRepository.ts';
import { perfBudget, seedManyGames, tempLibrary } from './testing.ts';

let library: Awaited<ReturnType<typeof tempLibrary>>;
let games: GameRepository;
beforeAll(async () => {
  library = await tempLibrary();
  games = new GameRepository(library.db, (row) => row.relPath);
  seedManyGames(library.db, 'big-system', 10_000);
  // 190k more across 19 systems: 200k games in all.
  for (let i = 0; i < 19; i += 1) seedManyGames(library.db, `system-${String(i)}`, 10_000);
  // A third of the big system is tagged `hack`, a fifth is Action: narrowing has work to do.
  library.db.$client.exec(`insert into game_filters (game_id, filter)
    select id, 'hack' from games where system_id = 'big-system' and id % 3 = 0;
    update game_metadata set genre = 'Action' where game_id in
      (select id from games where system_id = 'big-system' and id % 5 = 0);`);
}, 180_000);
afterAll(async () => {
  await library.cleanup();
});

/** The slowest of several runs, after one warm-up run. */
function slowest(run: () => unknown, times = 3) {
  run();
  let worst = 0;
  for (let i = 0; i < times; i += 1) {
    const start = performance.now();
    run();
    worst = Math.max(worst, performance.now() - start);
  }
  return worst;
}

describe('library performance', () => {
  it('NFR-PERF-2: the first page of a 10k-game system loads in ≤ 300 ms', () => {
    const page = () =>
      games.list({
        scope: { kind: 'system', systemId: 'big-system' },
        tab: 'all',
        offset: 0,
        limit: 200,
      });
    expect(page().total).toBe(10_000);
    expect(slowest(page)).toBeLessThanOrEqual(perfBudget(300));
  });

  it('NFR-PERF-2: a narrowed page and the facets of a 10k-game system stay in budget', () => {
    const scope = { kind: 'system', systemId: 'big-system' } as const;
    const page = () =>
      games.list({ scope, tab: 'all', filter: 'hack', genre: 'Action', offset: 0, limit: 200 });
    expect(page().total).toBeGreaterThan(0);
    expect(slowest(page)).toBeLessThanOrEqual(perfBudget(300));
    expect(slowest(() => games.facets(scope, 'all'))).toBeLessThanOrEqual(perfBudget(300));
  });

  it('NFR-PERF-3: search over 200k games answers in ≤ 150 ms', () => {
    expect(games.search('zelda').more).toBe(true);
    for (const text of ['ze', 'dragon', 'super mega']) {
      expect(
        slowest(() => games.search(text)),
        text,
      ).toBeLessThanOrEqual(perfBudget(150));
    }
  });
});
