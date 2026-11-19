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
import { GameRepository } from '../../library/GameRepository.ts';
import { MediaRepository } from '../../library/MediaRepository.ts';
import { ScrapeRepository } from '../../library/ScrapeRepository.ts';
import type { tempLibrary } from '../../library/testing.ts';
import { BatchScrapeService } from './BatchScrapeService.ts';

type Library = Awaited<ReturnType<typeof tempLibrary>>;

/** Test fakes for BatchScrapeService (FR-SCR-2, FR-SCR-8). */
export const NOW = Date.UTC(2026, 9, 25, 12);
export const RULES: BatchRules = {
  onlyMissing: true,
  kinds: ['box-front', 'logo-clear'],
  fields: ['genre', 'year'],
  regions: ['us'],
  launchbox: false,
};

export type Step = ScrapeSearchResult | ErrorCode;
export const fail = (code: ErrorCode) =>
  new AppErrorException({ code, message: ERROR_CODES[code] });
export const candidates = (...similarities: number[]): ScrapeSearchResult => ({
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
export const HASH: ScrapeSearchResult = { method: 'hash', candidates: candidates(100).candidates };

/** Scripted searches per game title: each search takes the next step for that game. */
export function makeSetup(lib: () => Library) {
  return function setup(
    script: Record<string, Step[]>,
    opts: {
      blocked?: boolean;
      exhaustedUntil?: string | null;
      failMark?: boolean;
      /** Per title: the apply rejects with this code, or every art write fails. */
      applyStep?: Record<string, ErrorCode | 'writeFail'>;
      /** Systems without a ScreenScraper id. */
      noSystem?: string[];
      /** Runs before each search (e.g. to break the database). */
      onSearch?: (n: number) => void;
    } = {},
  ) {
    const games = new GameRepository(lib().db, (row) => row.relPath);
    const media = new MediaRepository(lib().db);
    const scrapes = new ScrapeRepository(lib().db);
    const applied: Array<{ input: ScrapeApplyInput; candidates: number }> = [];
    const events: Array<{ event: IpcEvent; payload: unknown }> = [];
    const timers: Array<{ at: number; run: () => void }> = [];
    let now = NOW;
    const searched: number[] = [];
    const logged: unknown[] = [];
    const scraper = {
      search: ({ gameId }: { gameId: number }) => {
        searched.push(gameId);
        opts.onSearch?.(searched.length);
        const steps = script[games.get(gameId).title] ?? [];
        const step = steps.length > 1 ? steps.shift() : steps[0];
        if (step === undefined) return Promise.resolve(candidates());
        return typeof step === 'string' ? Promise.reject(fail(step)) : Promise.resolve(step);
      },
      apply: (input: ScrapeApplyInput, o: { candidates: number }) => {
        applied.push({ input, candidates: o.candidates });
        const step = opts.applyStep?.[games.get(input.gameId).title];
        if (step === 'writeFail') {
          return Promise.resolve({
            written: [],
            failed: input.kinds.map((kind) => ({ kind, code: 'write' as const })),
            game: games.get(input.gameId),
          });
        }
        if (step) return Promise.reject(fail(step));
        scrapes.set(input.gameId, {
          provider: 'screenscraper',
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
        db: lib().db,
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
        screenscraperId: (systemId) => (opts.noSystem?.includes(systemId) ? null : 4),
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
  };
}

export const counts = (s: BatchStatus) => [s.done, s.applied, s.review, s.notFound, s.failed];
