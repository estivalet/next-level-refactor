import type { BatchRules } from '@nextlevel/shared';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { seedGames, tempLibrary } from '../../library/testing.ts';
import { JobItems } from './jobItems.ts';
import { JobStore } from './jobStore.ts';

let library: Awaited<ReturnType<typeof tempLibrary>>;
beforeEach(async () => {
  library = await tempLibrary();
});
afterEach(async () => {
  await library.cleanup();
});

const RULES: BatchRules = {
  onlyMissing: true,
  kinds: ['box-front'],
  fields: ['genre'],
  regions: ['us'],
  launchbox: false,
};

const at = (minute: number) => `2026-11-19T10:${String(minute).padStart(2, '0')}:00.000Z`;

function setup(titles: string[]) {
  const gameIds = seedGames(library.db, 'switch', titles);
  const job = new JobStore(library.db).create({ systemIds: ['switch'] }, RULES, 5, new Date());
  return { items: new JobItems(library.db), jobId: job.id, gameIds };
}

const base = { provider: 'screenscraper' as const, error: null };

describe('JobItems (FR-SCR-8)', () => {
  it('FR-SCR-8: record upserts per (job, game) and count counts rows', () => {
    const { items, jobId, gameIds } = setup(['A']);
    const gameId = gameIds[0] ?? 0;
    items.record(jobId, { ...base, gameId, outcome: 'review', handledAt: at(1) });
    items.record(jobId, { ...base, gameId, outcome: 'applied', handledAt: at(2) });
    expect(items.count(jobId)).toBe(1);
    expect(items.page(jobId, { limit: 100 }).items).toMatchObject([
      { gameId, outcome: 'applied', handledAt: at(2) },
    ]);
  });

  it('FR-SCR-8: page is newest first, filters by outcome and joins title/systemId', () => {
    const { items, jobId, gameIds } = setup(['A', 'B', 'C']);
    const [a = 0, b = 0, c = 0] = gameIds;
    items.record(jobId, { ...base, gameId: a, outcome: 'applied', handledAt: at(1) });
    items.record(jobId, {
      provider: 'screenscraper',
      gameId: b,
      outcome: 'failed',
      error: 'INTERNAL',
      handledAt: at(2),
    });
    items.record(jobId, {
      provider: null,
      error: null,
      gameId: c,
      outcome: 'skipped',
      handledAt: at(3),
    });
    expect(items.page(jobId, { limit: 100 }).items.map((item) => item.gameId)).toEqual([c, b, a]);
    expect(items.page(jobId, { limit: 100, outcome: 'failed' })).toEqual({
      items: [
        {
          gameId: b,
          title: 'B',
          systemId: 'switch',
          outcome: 'failed',
          provider: 'screenscraper',
          error: 'INTERNAL',
          handledAt: at(2),
        },
      ],
      next: null,
    });
  });

  it('FR-SCR-8: keyset paging never repeats a game, even with equal handledAt', () => {
    const { items, jobId, gameIds } = setup(['A', 'B', 'C', 'D', 'E']);
    gameIds.forEach((gameId, index) => {
      items.record(jobId, {
        ...base,
        gameId,
        outcome: 'applied',
        handledAt: index < 3 ? at(1) : at(index),
      });
    });
    const seen: number[] = [];
    let page = items.page(jobId, { limit: 2 });
    for (;;) {
      seen.push(...page.items.map((item) => item.gameId));
      if (!page.next) break;
      page = items.page(jobId, { limit: 2, cursor: page.next });
    }
    expect(seen).toHaveLength(5);
    expect(new Set(seen).size).toBe(5);
  });

  it('FR-SCR-8: items of another job are not listed', () => {
    const { items, jobId, gameIds } = setup(['A']);
    const other = new JobStore(library.db).create({ systemIds: ['n64'] }, RULES, 1, new Date());
    items.record(other.id, {
      ...base,
      gameId: gameIds[0] ?? 0,
      outcome: 'applied',
      handledAt: at(1),
    });
    expect(items.count(jobId)).toBe(0);
    expect(items.page(jobId, { limit: 100 }).items).toEqual([]);
  });

  it('FR-SCR-8: a deleted game drops out of the list through the cascade', () => {
    const { items, jobId, gameIds } = setup(['A']);
    const gameId = gameIds[0] ?? 0;
    items.record(jobId, { ...base, gameId, outcome: 'applied', handledAt: at(1) });
    library.db.$client.prepare('delete from games where id = ?').run(gameId);
    expect(items.count(jobId)).toBe(0);
    expect(items.page(jobId, { limit: 100 }).items).toEqual([]);
  });

  it('FR-SCR-8: recording a game that no longer exists is skipped, not an error', () => {
    const { items, jobId, gameIds } = setup(['A']);
    const gameId = gameIds[0] ?? 0;
    library.db.$client.prepare('delete from games where id = ?').run(gameId);
    expect(() => {
      items.record(jobId, { ...base, gameId, outcome: 'applied', handledAt: at(1) });
    }).not.toThrow();
    expect(items.count(jobId)).toBe(0);
  });
});
