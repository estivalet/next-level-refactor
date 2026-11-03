import {
  AppErrorException,
  BatchRulesSchema,
  ERROR_CODES,
  type BatchRules,
  type ScrapeApplyInput,
  type ScrapeSearchResult,
} from '@nextlevel/shared';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { GameRepository } from '../../library/GameRepository.ts';
import { JobStore } from './jobStore.ts';
import { MediaRepository } from '../../library/MediaRepository.ts';
import { ScrapeRepository } from '../../library/ScrapeRepository.ts';
import { seedGames, tempLibrary } from '../../library/testing.ts';
import { BatchScrapeService } from './BatchScrapeService.ts';

const NOW = Date.UTC(2026, 10, 2, 12);
const RULES: BatchRules = {
  onlyMissing: true,
  kinds: ['box-front', 'logo-clear', 'fanart'],
  fields: ['year'],
  regions: ['us'],
  launchbox: true,
};

const found = (...similarities: number[]): ScrapeSearchResult => ({
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

let library: Awaited<ReturnType<typeof tempLibrary>>;
beforeEach(async () => {
  library = await tempLibrary();
});
afterEach(async () => {
  await library.cleanup();
});

/** Per title: what each source finds and which kinds its apply writes. */
interface Source {
  found: ScrapeSearchResult | 'LAUNCHBOX_INDEX_MISSING';
  writes?: ScrapeApplyInput['kinds'];
}

function setup(
  ss: Record<string, Source>,
  lb: Record<string, Source>,
  opts: { indexReady?: () => boolean } = {},
) {
  const games = new GameRepository(library.db, (row) => row.relPath);
  const media = new MediaRepository(library.db);
  const scrapes = new ScrapeRepository(library.db);
  const applied: Array<{ provider: string; input: ScrapeApplyInput }> = [];
  const busy: boolean[] = [];
  const source = (provider: 'screenscraper' | 'launchbox', table: Record<string, Source>) => ({
    search: ({ gameId }: { gameId: number }) => {
      const entry = table[games.get(gameId).title];
      if (provider === 'launchbox' && opts.indexReady && !opts.indexReady()) {
        return Promise.reject(
          new AppErrorException({
            code: 'LAUNCHBOX_INDEX_MISSING',
            message: ERROR_CODES.LAUNCHBOX_INDEX_MISSING,
          }),
        );
      }
      return Promise.resolve(
        entry && entry.found !== 'LAUNCHBOX_INDEX_MISSING' ? entry.found : found(),
      );
    },
    apply: (input: ScrapeApplyInput, o: { candidates: number }) => {
      applied.push({ provider, input });
      const writes = (table[games.get(input.gameId).title]?.writes ?? input.kinds).filter((kind) =>
        input.kinds.includes(kind),
      );
      for (const kind of writes) {
        media.upsert({ gameId: input.gameId, kind, path: `C:/m/${kind}.png`, size: 1, version: 1 });
      }
      scrapes.set(input.gameId, {
        provider,
        status: 'scraped',
        providerGameId: input.providerGameId,
        candidates: o.candidates,
        error: null,
        scrapedAt: new Date(NOW).toISOString(),
      });
      return Promise.resolve({ written: writes, failed: [], game: games.get(input.gameId) });
    },
  });
  const service = new BatchScrapeService({
    db: library.db,
    scraper: source('screenscraper', ss),
    launchbox: {
      scraper: source('launchbox', lb),
      setBusy: (value) => {
        busy.push(value);
      },
    },
    games,
    media,
    scrapes,
    quota: () => ({ exhaustedUntil: null }),
    blocked: () => false,
    screenscraperId: () => 4,
    emit: () => undefined,
    log: { error: () => undefined },
    clock: () => new Date(NOW),
    sleep: () => Promise.resolve(),
    setTimer: () => () => undefined,
  });
  return { service, applied, busy, scrapes };
}

describe('batch scrape fills from LaunchBox after ScreenScraper (FR-SCR-6)', () => {
  it('ScreenScraper not found + one LaunchBox candidate ≥ 90 → applied from LaunchBox', async () => {
    const [id = 0] = seedGames(library.db, 'microsoft-xbox-360', ['Ace Driver Collection']);
    const { service, applied, scrapes } = setup(
      { 'Ace Driver Collection': { found: found() } },
      { 'Ace Driver Collection': { found: found(95) } },
    );
    await service.begin({ systemIds: ['microsoft-xbox-360'] }, RULES);
    await service.idle();
    expect(applied.map((a) => a.provider)).toEqual(['launchbox']);
    expect(applied[0]?.input).toMatchObject({ gameId: id, provider: 'launchbox' });
    expect(service.status()).toMatchObject({ applied: 1, launchbox: 1, notFound: 0, done: 1 });
    expect(scrapes.get(id)).toMatchObject({ provider: 'launchbox', status: 'scraped' });
  });

  it('LaunchBox fills only what ScreenScraper left missing, even when overwriting', async () => {
    seedGames(library.db, 'snes', ['Racer']);
    const { service, applied } = setup(
      { Racer: { found: found(95), writes: ['box-front', 'logo-clear'] } },
      { Racer: { found: found(99) } },
    );
    await service.begin({ systemIds: ['snes'] }, { ...RULES, onlyMissing: false });
    await service.idle();
    expect(applied.map((a) => [a.provider, a.input.kinds, a.input.fields])).toEqual([
      ['screenscraper', ['box-front', 'logo-clear', 'fanart'], ['year']],
      ['launchbox', ['fanart'], ['year']],
    ]);
    expect(service.status()).toMatchObject({ applied: 1, launchbox: 1 });
  });

  it('several LaunchBox candidates → Needs review from LaunchBox, counted once', async () => {
    const [id = 0] = seedGames(library.db, 'snes', ['Racer']);
    const { service, applied, scrapes } = setup(
      { Racer: { found: found() } },
      { Racer: { found: found(80, 75) } },
    );
    await service.begin({ systemIds: ['snes'] }, RULES);
    await service.idle();
    expect(applied).toEqual([]);
    expect(service.status()).toMatchObject({ review: 1, notFound: 0, launchbox: 0, done: 1 });
    expect(scrapes.get(id)).toMatchObject({ provider: 'launchbox', status: 'review' });
  });

  it('a missing LaunchBox database pauses once; resume continues the same game', async () => {
    seedGames(library.db, 'snes', ['Racer']);
    let ready = false;
    const { service, applied } = setup(
      { Racer: { found: found() } },
      { Racer: { found: found(95) } },
      { indexReady: () => ready },
    );
    await service.begin({ systemIds: ['snes'] }, RULES);
    await service.idle();
    expect(service.status()).toMatchObject({ state: 'paused', pausedReason: 'launchbox', done: 0 });
    ready = true;
    await service.resume();
    await service.idle();
    expect(applied.map((a) => a.provider)).toEqual(['launchbox']);
    expect(service.status()).toMatchObject({ state: 'finished', applied: 1, launchbox: 1 });
  });

  it('the LaunchBox index is held busy only while a job runs', async () => {
    seedGames(library.db, 'snes', ['Racer']);
    const { service, busy } = setup({ Racer: { found: found(95) } }, {});
    await service.begin({ systemIds: ['snes'] }, RULES);
    await service.idle();
    expect(busy).toEqual([true, false]);
  });

  it('without the rule, LaunchBox is never asked', async () => {
    seedGames(library.db, 'snes', ['Racer']);
    const { service, applied, busy } = setup(
      { Racer: { found: found() } },
      { Racer: { found: found(99) } },
    );
    await service.begin({ systemIds: ['snes'] }, { ...RULES, launchbox: false });
    await service.idle();
    expect(applied).toEqual([]);
    expect(busy).toEqual([]);
    expect(service.status()).toMatchObject({ notFound: 1, launchbox: 0 });
  });

  it('a job saved before the rule existed reads it as off', () => {
    library.db.$client
      .prepare(
        `insert into scrape_jobs (scope, rules, status, total, created_at, updated_at)
         values (?, ?, 'paused', 1, 'x', 'x')`,
      )
      .run(
        JSON.stringify({ systemIds: ['snes'] }),
        JSON.stringify({ onlyMissing: true, kinds: [], fields: [], regions: ['us'] }),
      );
    expect(new JobStore(library.db).active()?.rules.launchbox).toBe(false);
    expect(
      BatchRulesSchema.parse({ onlyMissing: true, kinds: [], fields: [], regions: ['us'] })
        .launchbox,
    ).toBe(false);
  });
});
