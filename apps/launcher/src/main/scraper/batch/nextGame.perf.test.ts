import { performance } from 'node:perf_hooks';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { GameRepository } from '../../library/GameRepository.ts';
import { MediaRepository } from '../../library/MediaRepository.ts';
import { ScrapeRepository } from '../../library/ScrapeRepository.ts';
import { perfBudget, seedManyGames, tempLibrary } from '../../library/testing.ts';
import { BatchScrapeService } from './BatchScrapeService.ts';
import { nextGame } from './nextGame.ts';

let library: Awaited<ReturnType<typeof tempLibrary>>;
beforeAll(async () => {
  library = await tempLibrary();
  for (let i = 0; i < 20; i += 1) seedManyGames(library.db, `system-${String(i)}`, 10_000);
  // Half the library already has a box: only-missing has to skip past them.
  library.db.$client
    .prepare(
      `insert into game_media (game_id, kind, path, size, version)
       select id, 'box-front', 'C:/x/' || id || '.png', 1, 1 from games where id % 2 = 0`,
    )
    .run();
}, 180_000);
afterAll(async () => {
  await library.cleanup();
});

describe('batch performance', () => {
  it('FR-SCR-2: selecting the next batch game over 200k games takes ≤ 50 ms', () => {
    const job = {
      scope: { systemIds: Array.from({ length: 20 }, (_, i) => `system-${String(i)}`) },
      rules: { onlyMissing: true, kinds: ['box-front' as const], fields: [], regions: ['us'] },
      cursorGameId: 100_000,
    };
    nextGame(library.db, job);
    let worst = 0;
    for (let i = 0; i < 5; i += 1) {
      const start = performance.now();
      const next = nextGame(library.db, { ...job, cursorGameId: job.cursorGameId + i * 2 });
      worst = Math.max(worst, performance.now() - start);
      expect(next).not.toBeNull();
    }
    expect(worst).toBeLessThan(perfBudget(50));
  });

  it('FR-SCR-2: one system whose games come last is found fast too', () => {
    const job = {
      scope: { systemIds: ['system-19'] },
      rules: { onlyMissing: true, kinds: ['box-front' as const], fields: [], regions: ['us'] },
      cursorGameId: null,
    };
    nextGame(library.db, job);
    const start = performance.now();
    expect(nextGame(library.db, job)).not.toBeNull();
    expect(performance.now() - start).toBeLessThan(perfBudget(50));
  });

  it('FR-SCR-2: batch bookkeeping per game over 200k games takes ≤ 20 ms', async () => {
    const games = 50;
    let searched = 0;
    let started = 0;
    const service: BatchScrapeService = new BatchScrapeService({
      db: library.db,
      scraper: {
        search: () => {
          searched += 1;
          if (searched === 1) started = performance.now();
          if (searched === games) service.pause();
          return Promise.resolve({ method: 'title', candidates: [] });
        },
        apply: () => Promise.reject(new Error('not used')),
      },
      games: new GameRepository(library.db, (row) => row.relPath),
      media: new MediaRepository(library.db),
      scrapes: new ScrapeRepository(library.db),
      quota: () => ({ exhaustedUntil: null }),
      blocked: () => false,
      screenscraperId: () => 4,
      emit: () => undefined,
      log: { error: () => undefined },
      clock: () => new Date(),
      sleep: () => Promise.resolve(),
      setTimer: () => () => undefined,
    });
    await service.begin(
      { systemIds: ['system-10'] },
      {
        onlyMissing: true,
        kinds: ['box-front'],
        fields: [],
        regions: ['us'],
      },
    );
    await service.idle();
    const perGame = (performance.now() - started) / (games - 1);
    expect(service.status().done).toBe(games);
    expect(perGame).toBeLessThan(perfBudget(20));
  });
});
