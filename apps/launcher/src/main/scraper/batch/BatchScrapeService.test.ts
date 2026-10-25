import {
  AppErrorException,
  ERROR_CODES,
  type BatchRules,
  type BatchStatus,
  type ErrorCode,
  type IpcEvent,
  type ScrapeApplyInput,
  type ScrapeSearchResult,
} from '@nextlevel/shared';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { GameRepository } from '../../library/GameRepository.ts';
import { MediaRepository } from '../../library/MediaRepository.ts';
import { ScrapeRepository } from '../../library/ScrapeRepository.ts';
import { appErrorOf, seedGames, tempLibrary } from '../../library/testing.ts';
import { BatchScrapeService } from './BatchScrapeService.ts';

const NOW = Date.UTC(2026, 9, 25, 12);
const RULES: BatchRules = {
  onlyMissing: true,
  kinds: ['box-front', 'logo-clear'],
  fields: ['genre', 'year'],
  regions: ['us'],
};

type Step = ScrapeSearchResult | ErrorCode;
const fail = (code: ErrorCode) => new AppErrorException({ code, message: ERROR_CODES[code] });
const candidates = (...similarities: number[]): ScrapeSearchResult => ({
  method: 'title',
  candidates: similarities.map((similarity, i) => ({
    providerGameId: 900 + i,
    name: `Candidate ${String(i)}`,
    year: null,
    region: null,
    similarity,
    thumb: null,
  })),
});
const HASH: ScrapeSearchResult = { method: 'hash', candidates: candidates(100).candidates };

let library: Awaited<ReturnType<typeof tempLibrary>>;
beforeEach(async () => {
  library = await tempLibrary();
});
afterEach(async () => {
  await library.cleanup();
});

/** Scripted searches per game title: each search takes the next step for that game. */
function setup(
  script: Record<string, Step[]>,
  opts: { blocked?: boolean; exhaustedUntil?: string | null; failMark?: boolean } = {},
) {
  const games = new GameRepository(library.db, (row) => row.relPath);
  const media = new MediaRepository(library.db);
  const scrapes = new ScrapeRepository(library.db);
  const applied: Array<{ input: ScrapeApplyInput; candidates: number }> = [];
  const events: Array<{ event: IpcEvent; payload: unknown }> = [];
  const timers: Array<{ at: number; run: () => void }> = [];
  let now = NOW;
  const searched: number[] = [];
  const logged: unknown[] = [];
  const scraper = {
    search: ({ gameId }: { gameId: number }) => {
      searched.push(gameId);
      const steps = script[games.get(gameId).title] ?? [];
      const step = steps.length > 1 ? steps.shift() : steps[0];
      if (step === undefined) return Promise.resolve(candidates());
      return typeof step === 'string' ? Promise.reject(fail(step)) : Promise.resolve(step);
    },
    apply: (input: ScrapeApplyInput, o: { candidates: number }) => {
      applied.push({ input, candidates: o.candidates });
      scrapes.set(input.gameId, {
        status: 'scraped',
        providerGameId: input.providerGameId,
        candidates: o.candidates,
        error: null,
        scrapedAt: new Date(now).toISOString(),
      });
      return Promise.resolve({ written: input.kinds, failed: [], game: games.get(input.gameId) });
    },
  };
  const make = () =>
    new BatchScrapeService({
      db: library.db,
      scraper,
      games,
      media,
      scrapes: opts.failMark
        ? {
            set: () => {
              throw new Error('disk I/O error');
            },
          }
        : scrapes,
      log: {
        error: (context: object) => {
          logged.push(context);
        },
      },
      quota: () => ({ exhaustedUntil: opts.exhaustedUntil ?? null }),
      blocked: () => opts.blocked ?? false,
      emit: (event, payload) => {
        events.push({ event, payload });
      },
      clock: () => new Date(now),
      sleep: () => Promise.resolve(),
      setTimer: (ms, run) => {
        const timer = { at: now + ms, run };
        timers.push(timer);
        return () => {
          timers.splice(timers.indexOf(timer), 1);
        };
      },
    });
  return {
    service: make(),
    make,
    games,
    media,
    scrapes,
    applied,
    events,
    searched,
    logged,
    advance: (ms: number) => {
      now += ms;
      for (const timer of timers.splice(0)) {
        if (timer.at <= now) timer.run();
        else timers.push(timer);
      }
    },
  };
}

const counts = (s: BatchStatus) => [s.done, s.applied, s.review, s.notFound, s.failed];

describe('BatchScrapeService (FR-SCR-2, D18)', () => {
  it('D18: hash → applied, single ≥ 90 → applied, two → review, none → notFound', async () => {
    const [hash = 0, single = 0, two = 0, none = 0] = seedGames(library.db, 'snes', [
      'Hash',
      'Single',
      'Two',
      'None',
    ]);
    const { service, applied, scrapes } = setup({
      Hash: [HASH],
      Single: [candidates(93)],
      Two: [candidates(95, 70)],
      None: [candidates()],
    });
    await service.begin({ systemIds: ['snes'] }, RULES);
    await service.idle();
    const status = service.status();
    expect(status.state).toBe('finished');
    expect(status.total).toBe(4);
    expect(counts(status)).toEqual([4, 2, 1, 1, 0]);
    expect(applied.map((a) => a.input.gameId)).toEqual([hash, single]);
    expect(scrapes.get(two)).toMatchObject({
      status: 'review',
      candidates: 2,
      providerGameId: null,
    });
    expect(scrapes.get(none)).toMatchObject({ status: 'notFound', candidates: 0 });
  });

  it('D18: a single candidate under 90 goes to review, nothing written', async () => {
    const [id = 0] = seedGames(library.db, 'snes', ['Close']);
    const { service, applied, scrapes } = setup({ Close: [candidates(89)] });
    await service.begin({ systemIds: ['snes'] }, RULES);
    await service.idle();
    expect(applied).toEqual([]);
    expect(scrapes.get(id)).toMatchObject({ status: 'review', candidates: 1 });
  });

  it('D19: batch never writes locked fields; only missing skips art and filled fields', async () => {
    const [id = 0] = seedGames(library.db, 'snes', [{ title: 'Game', year: 1990 }]);
    const { service, applied, games, media } = setup({ Game: [HASH] });
    games.updateMetadata(id, { genre: 'Mine' }, new Date(NOW));
    media.upsert({ gameId: id, kind: 'box-front', path: 'C:/b.png', size: 1, version: 1 });
    await service.begin({ systemIds: ['snes'] }, RULES);
    await service.idle();
    expect(applied[0]?.input).toMatchObject({ kinds: ['logo-clear'], fields: [] });
  });

  it('D19: with only missing off, art and filled fields are rewritten but locked ones never', async () => {
    const [id = 0] = seedGames(library.db, 'snes', [{ title: 'Game', year: 1990 }]);
    const { service, applied, games, media } = setup({ Game: [HASH] });
    games.updateMetadata(id, { genre: 'Mine' }, new Date(NOW));
    media.upsert({ gameId: id, kind: 'box-front', path: 'C:/b.png', size: 1, version: 1 });
    await service.begin({ systemIds: ['snes'] }, { ...RULES, onlyMissing: false });
    await service.idle();
    expect(applied[0]?.input).toMatchObject({
      kinds: ['box-front', 'logo-clear'],
      fields: ['year'],
    });
  });

  it('Review Focus 4: SCRAPER_QUOTA pauses with resumeAt; the game is retried on resume, not failed', async () => {
    const [first = 0, second = 0] = seedGames(library.db, 'snes', ['First', 'Second']);
    const until = '2026-10-25T22:00:00.000Z';
    const { service, searched, advance } = setup(
      { First: [HASH], Second: ['SCRAPER_QUOTA', HASH] },
      { exhaustedUntil: until },
    );
    await service.begin({ systemIds: ['snes'] }, RULES);
    await service.idle();
    expect(service.status()).toMatchObject({
      state: 'paused',
      pausedReason: 'quota',
      resumeAt: until,
      done: 1,
      failed: 0,
    });
    advance(Date.parse(until) - NOW);
    await service.idle();
    expect(service.status()).toMatchObject({ state: 'finished', done: 2, applied: 2, failed: 0 });
    expect(searched).toEqual([first, second, second]);
  });

  it('Review Focus 4: three network failures in a row pause the job; fewer just retry', async () => {
    seedGames(library.db, 'snes', ['Flaky', 'Down']);
    const { service } = setup({
      Flaky: ['SCRAPER_NETWORK', HASH],
      Down: ['SCRAPER_NETWORK', 'SCRAPER_NETWORK', 'SCRAPER_NETWORK', HASH],
    });
    await service.begin({ systemIds: ['snes'] }, RULES);
    await service.idle();
    expect(service.status()).toMatchObject({
      state: 'paused',
      pausedReason: 'network',
      done: 1,
      failed: 0,
    });
    await service.resume();
    await service.idle();
    expect(service.status()).toMatchObject({ state: 'finished', done: 2, applied: 2 });
  });

  it('bad credentials pause the job', async () => {
    seedGames(library.db, 'snes', ['Game']);
    const { service } = setup({ Game: ['SCRAPER_CREDENTIALS'] });
    await service.begin({ systemIds: ['snes'] }, RULES);
    await service.idle();
    expect(service.status()).toMatchObject({ state: 'paused', pausedReason: 'credentials' });
  });

  it('a per-game error counts failed and the batch goes on', async () => {
    const [bad = 0] = seedGames(library.db, 'snes', ['Bad', 'Good']);
    const { service, scrapes } = setup({ Bad: ['NO_SCRAPER_SYSTEM'], Good: [HASH] });
    await service.begin({ systemIds: ['snes'] }, RULES);
    await service.idle();
    expect(counts(service.status())).toEqual([2, 1, 0, 0, 1]);
    expect(scrapes.get(bad)).toMatchObject({ status: 'failed', error: 'NO_SCRAPER_SYSTEM' });
  });

  it('a restart resumes a running job from its cursor; a future quota pause waits', async () => {
    seedGames(library.db, 'snes', ['One', 'Two', 'Three']);
    const until = '2026-10-25T22:00:00.000Z';
    const first = setup(
      { One: [HASH], Two: ['SCRAPER_QUOTA', HASH], Three: [HASH] },
      {
        exhaustedUntil: until,
      },
    );
    await first.service.begin({ systemIds: ['snes'] }, RULES);
    await first.service.idle();
    expect(first.service.status()).toMatchObject({ state: 'paused', done: 1 });

    first.service.dispose();
    const restarted = first.make();
    restarted.restore();
    await restarted.idle();
    expect(restarted.status()).toMatchObject({ state: 'paused', pausedReason: 'quota', done: 1 });
    first.advance(Date.parse(until) - NOW);
    await restarted.idle();
    expect(restarted.status()).toMatchObject({ state: 'finished', done: 3 });
  });

  it('a running job in the database resumes on restore', async () => {
    seedGames(library.db, 'snes', ['One', 'Two']);
    const { make, applied } = setup({ One: [HASH], Two: [HASH] });
    library.db.$client
      .prepare(
        `insert into scrape_jobs (scope, rules, status, cursor_game_id, total, done, applied,
           created_at, updated_at)
         values (?, ?, 'running', 1, 2, 1, 1, 'x', 'x')`,
      )
      .run(JSON.stringify({ systemIds: ['snes'] }), JSON.stringify(RULES));
    const service = make();
    service.restore();
    await service.idle();
    expect(service.status()).toMatchObject({ state: 'finished', done: 2, applied: 2 });
    expect(applied.map((a) => a.input.gameId)).toEqual([2]);
  });

  it('pause and cancel stop after the current game', async () => {
    seedGames(library.db, 'snes', ['One', 'Two', 'Three']);
    const { service } = setup({ One: [HASH], Two: [HASH], Three: [HASH] });
    await service.begin({ systemIds: ['snes'] }, RULES);
    service.pause();
    await service.idle();
    expect(service.status()).toMatchObject({ state: 'paused', pausedReason: 'user', done: 1 });
    await service.resume();
    service.cancel();
    await service.idle();
    expect(service.status()).toMatchObject({ state: 'finished', done: 2 });
  });

  it('start is BUSY while a job runs or is paused, and while a scan runs', async () => {
    seedGames(library.db, 'snes', ['One']);
    const blocked = setup({}, { blocked: true });
    await expect(blocked.service.begin({ systemIds: ['snes'] }, RULES)).rejects.toMatchObject({
      error: { code: 'BUSY' },
    });
    const { service } = setup({ One: ['SCRAPER_CREDENTIALS'] });
    await service.begin({ systemIds: ['snes'] }, RULES);
    await service.idle();
    expect(
      appErrorOf(() => {
        service.assertCanStart();
      }).code,
    ).toBe('BUSY');
  });

  it('every change is announced as scraper.batch.progress', async () => {
    seedGames(library.db, 'snes', ['One']);
    const { service, events } = setup({ One: [HASH] });
    await service.begin({ systemIds: ['snes'] }, RULES);
    await service.idle();
    const progress = events.filter((e) => e.event === 'scraper.batch.progress');
    expect(progress.length).toBeGreaterThan(1);
    expect(progress.at(-1)?.payload).toMatchObject({ state: 'finished', done: 1 });
  });

  it('an unexpected error in the loop is logged and the next run still works', async () => {
    seedGames(library.db, 'snes', ['Two']);
    const { service, logged } = setup({ Two: [candidates(95, 70)] }, { failMark: true });
    await service.begin({ systemIds: ['snes'] }, RULES);
    await service.idle();
    expect(logged).toHaveLength(1);
    expect(service.status()).toMatchObject({ state: 'paused', pausedReason: 'error' });
    await service.resume();
    await service.idle();
    expect(logged).toHaveLength(2);
  });
});
