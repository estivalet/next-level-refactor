import { SmartFilterQuerySchema } from '@nextlevel/shared';
import { performance } from 'node:perf_hooks';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { SmartFilterRepository } from './SmartFilterRepository.ts';
import { perfBudget, seedManyGames, tempLibrary } from './testing.ts';

const NOW = new Date(Date.UTC(2026, 9, 21, 12, 0, 0));

let library: Awaited<ReturnType<typeof tempLibrary>>;
let filters: SmartFilterRepository;
beforeAll(async () => {
  library = await tempLibrary();
  filters = new SmartFilterRepository(library.db, () => NOW);
  for (let i = 0; i < 20; i += 1) seedManyGames(library.db, `system-${String(i)}`, 10_000);
  // Every 10th game was played, on a different day.
  library.db.$client
    .prepare(
      `insert into game_user_state (game_id, play_count, last_played_at)
       select id, id % 7 + 1, strftime('%Y-%m-%dT%H:%M:%fZ', '2026-01-01', '+' || (id % 290) || ' days')
       from games where id % 10 = 0`,
    )
    .run();
}, 180_000);
afterAll(async () => {
  await library.cleanup();
});

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

describe('smart filter performance', () => {
  it('FR-LIB-9: a played-games filter over 200k games sorted by last played answers in ≤ 300 ms', () => {
    const recent = filters.create(
      'Recent',
      SmartFilterQuerySchema.parse({ played: 'played', sort: 'lastPlayed' }),
    );
    expect(recent.games).toBe(20_000);
    expect(slowest(() => filters.gameIds(recent.id))).toBeLessThanOrEqual(perfBudget(300));
  });
});
