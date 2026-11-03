import {
  AppErrorException,
  defaultSettings,
  ERROR_CODES,
  type ErrorCode,
  type GeminiBatchRules,
} from '@nextlevel/shared';
import { afterEach, describe, expect, it } from 'vitest';
import { GameRepository } from '../library/GameRepository.ts';
import { MediaRepository } from '../library/MediaRepository.ts';
import { ScrapeRepository } from '../library/ScrapeRepository.ts';
import { seedGames, tempLibrary } from '../library/testing.ts';
import { MediaWriter } from '../scraper/MediaWriter.ts';
import { JobStore } from '../scraper/batch/jobStore.ts';
import { AnswerStore } from './AnswerStore.ts';
import { GeminiBatchService, type AnswerSource, type SourceReply } from './GeminiBatchService.ts';
import { GeminiService } from './GeminiService.ts';
import type { PromptGame } from './prompt.ts';

const cleanups: Array<() => Promise<void> | void> = [];
afterEach(async () => {
  for (const cleanup of cleanups.splice(0).reverse()) await cleanup();
});

const NOW = new Date('2026-12-10T15:00:00.000Z');
const RULES: GeminiBatchRules = { fields: ['year'], mode: 'auto', route: 'api' };
const fail = (code: ErrorCode) => new AppErrorException({ code, message: ERROR_CODES[code] });
const yearOf = (gameId: number, year = 1980) => ({ gameId, year: { known: true, value: year } });

type Reply = (games: PromptGame[]) => SourceReply | Error;

async function setup(count: number, replies: Reply[] = []) {
  const library = await tempLibrary();
  cleanups.push(library.cleanup);
  const ids = seedGames(
    library.db,
    'coleco-telstar',
    Array.from({ length: count }, (_, i) => `Game ${String(i + 1).padStart(2, '0')}`),
  );
  const asked: number[][] = [];
  const source: AnswerSource = {
    next: (games) => {
      asked.push(games.map((game) => game.gameId));
      const reply = (
        replies.shift() ??
        ((g) => ({
          items: new Map(g.map((game) => [game.gameId, yearOf(game.gameId)])),
          sources: [],
          grounded: false,
        }))
      )(games);
      return reply instanceof Error ? Promise.reject(reply) : Promise.resolve(reply);
    },
  };
  const settings = defaultSettings();
  const games = new GameRepository(library.db, (row) => row.relPath);
  const gemini = new GeminiService({
    client: { ask: () => Promise.reject(new Error('not used')) },
    answers: new AnswerStore(library.db),
    games,
    media: new MediaRepository(library.db),
    scrapes: new ScrapeRepository(library.db),
    writer: new MediaWriter({ toPng: (bytes) => bytes }),
    transaction: (fn) => {
      library.db.$client.transaction(fn)();
    },
    settings: () => settings,
    systemName: () => 'Coleco Telstar',
    emit: () => undefined,
    clock: () => NOW,
  });
  const timers: Array<{ ms: number; run: () => void }> = [];
  const make = () =>
    new GeminiBatchService({
      db: library.db,
      gemini,
      sources: { api: source, web: source },
      games,
      blocked: () => false,
      emit: () => undefined,
      log: { error: () => undefined },
      clock: () => NOW,
      sleep: () => Promise.resolve(),
      setTimer: (ms, run) => {
        timers.push({ ms, run });
        return () => undefined;
      },
    });
  const service = make();
  return { library, service, make, ids, asked, games, timers };
}

describe('GeminiBatchService (FR-SCR-7)', () => {
  it('FR-SCR-7: asks 10 games per request and records each answer', async () => {
    const { service, asked, ids, games } = await setup(12);
    await service.start({ systemIds: ['coleco-telstar'] }, RULES);
    await service.idle();
    expect(asked.map((chunk) => chunk.length)).toEqual([10, 2]);
    expect(service.status()).toMatchObject({ state: 'finished', total: 12, done: 12, applied: 12 });
    expect(games.get(ids[0] ?? 0).year).toBe(1980);
  });

  it('FR-SCR-7: games whose requested fields are all filled are never asked', async () => {
    const { service, asked, ids, library } = await setup(3);
    library.db.$client
      .prepare('update game_metadata set year = 1977 where game_id = ?')
      .run(ids[1]);
    await service.start({ systemIds: ['coleco-telstar'] }, RULES);
    await service.idle();
    expect(asked).toEqual([[ids[0], ids[2]]]);
  });

  it('FR-SCR-7: Review Focus 1 — a missing, unknown or repeated id: first wins, missing is notFound', async () => {
    const { service, ids, games } = await setup(3, [
      () => ({
        items: new Map<number, unknown>([
          [ids[0] ?? 0, yearOf(ids[0] ?? 0, 1977)],
          [99, yearOf(99)],
          [ids[2] ?? 0, yearOf(ids[2] ?? 0, 1979)],
        ]),
        sources: [],
        grounded: false,
      }),
    ]);
    await service.start({ systemIds: ['coleco-telstar'] }, RULES);
    await service.idle();
    expect(service.status()).toMatchObject({ applied: 2, notFound: 1, done: 3 });
    expect(games.get(ids[1] ?? 0).year).toBeNull();
    expect(games.get(ids[2] ?? 0).year).toBe(1979);
  });

  it('FR-SCR-7: Review mode stores answers for Needs review instead of writing', async () => {
    const { service, ids, games } = await setup(1);
    await service.start({ systemIds: ['coleco-telstar'] }, { ...RULES, mode: 'review' });
    await service.idle();
    expect(service.status()).toMatchObject({ review: 1, applied: 0 });
    expect(games.get(ids[0] ?? 0).year).toBeNull();
    expect(games.get(ids[0] ?? 0).scrape).toMatchObject({ provider: 'gemini', status: 'review' });
  });

  it('FR-SCR-7: Review Focus 4 — the daily limit keeps the cursor and pauses until the LA midnight', async () => {
    const { service, asked, timers, make } = await setup(12, [
      (games) => ({
        items: new Map(games.map((g) => [g.gameId, yearOf(g.gameId)])),
        sources: [],
        grounded: false,
      }),
      () => fail('GEMINI_QUOTA'),
    ]);
    await service.start({ systemIds: ['coleco-telstar'] }, RULES);
    await service.idle();
    expect(service.status()).toMatchObject({
      state: 'paused',
      pausedReason: 'gemini-quota',
      resumeAt: '2026-12-11T08:00:00.000Z',
      done: 10,
    });
    expect(timers.at(-1)?.ms).toBe(17 * 60 * 60 * 1000);
    // A restart before the reset waits; the timer resumes with the same two games.
    const again = make();
    again.restore();
    expect(again.status()).toMatchObject({ state: 'paused', pausedReason: 'gemini-quota' });
    timers.at(-1)?.run();
    await again.idle();
    expect(asked.at(-1)).toHaveLength(2);
    expect(again.status()).toMatchObject({ state: 'finished', done: 12 });
  });

  it('FR-SCR-7: network errors pause after 3 tries; a bad reply fails its games and goes on', async () => {
    const network = await setup(1, [
      () => fail('GEMINI_NETWORK'),
      () => fail('GEMINI_NETWORK'),
      () => fail('GEMINI_NETWORK'),
    ]);
    await network.service.start({ systemIds: ['coleco-telstar'] }, RULES);
    await network.service.idle();
    expect(network.service.status()).toMatchObject({ state: 'paused', pausedReason: 'network' });

    const bad = await setup(11, [() => fail('GEMINI_BAD_REPLY')]);
    await bad.service.start({ systemIds: ['coleco-telstar'] }, RULES);
    await bad.service.idle();
    expect(bad.service.status()).toMatchObject({ state: 'finished', failed: 10, applied: 1 });
  });

  it('FR-SCR-7: a rejected key pauses as credentials', async () => {
    const { service } = await setup(1, [() => fail('GEMINI_KEY_REJECTED')]);
    await service.start({ systemIds: ['coleco-telstar'] }, RULES);
    await service.idle();
    expect(service.status()).toMatchObject({ state: 'paused', pausedReason: 'credentials' });
  });

  it('FR-SCR-7: pause and cancel stop after the current request', async () => {
    const { service } = await setup(25);
    await service.start({ systemIds: ['coleco-telstar'] }, RULES);
    service.pause();
    await service.idle();
    expect(service.status()).toMatchObject({ state: 'paused', pausedReason: 'user', done: 10 });
    await service.resume();
    service.cancel();
    await service.idle();
    expect(service.status()).toMatchObject({ state: 'finished', done: 20 });
  });

  it('FR-SCR-7: a scrape job and a Gemini job never see each other', async () => {
    const { service, library } = await setup(12, [() => fail('GEMINI_QUOTA')]);
    const scrapeJobs = new JobStore(library.db);
    scrapeJobs.create(
      { systemIds: ['coleco-telstar'] },
      { onlyMissing: true, kinds: [], fields: ['year'], regions: ['wor'], launchbox: false },
      5,
      NOW,
    );
    await service.start({ systemIds: ['coleco-telstar'] }, RULES);
    await service.idle();
    expect(scrapeJobs.active()?.total).toBe(5);
    expect(service.status().total).toBe(12);
  });

  it('FR-SCR-7: start is BUSY while a Gemini job runs or is paused', async () => {
    const { service } = await setup(12, [() => fail('GEMINI_QUOTA')]);
    await service.start({ systemIds: ['coleco-telstar'] }, RULES);
    await service.idle();
    await expect(service.start({ systemIds: ['coleco-telstar'] }, RULES)).rejects.toMatchObject({
      error: { code: 'BUSY' },
    });
  });
});
