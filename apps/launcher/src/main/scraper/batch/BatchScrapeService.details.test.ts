import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { seedGames, tempLibrary } from '../../library/testing.ts';
import { candidates, HASH, makeSetup, NOW, RULES } from './batchTestSetup.ts';

let library: Awaited<ReturnType<typeof tempLibrary>>;
beforeEach(async () => {
  library = await tempLibrary();
});
afterEach(async () => {
  await library.cleanup();
});

const setup = makeSetup(() => library);
const outcomes = (items: Array<{ gameId: number; outcome: string }>) =>
  Object.fromEntries(items.map((item) => [item.gameId, item.outcome]));

describe('BatchScrapeService details (FR-SCR-8)', () => {
  it('FR-SCR-8: every handled game gets an item with outcome and provider', async () => {
    const [hash = 0, two = 0, none = 0] = seedGames(library.db, 'snes', ['Hash', 'Two', 'None']);
    const { service } = setup({ Hash: [HASH], Two: [candidates(95, 70)], None: [candidates()] });
    await service.begin({ systemIds: ['snes'] }, RULES);
    await service.idle();
    const items = service.items({ limit: 100 }).items;
    expect(outcomes(items)).toEqual({ [hash]: 'applied', [two]: 'review', [none]: 'notFound' });
    expect(items.every((item) => item.provider === 'screenscraper')).toBe(true);
  });

  it('FR-SCR-8: a game with nothing to fill is listed as skipped with no provider', async () => {
    const [locked = 0] = seedGames(library.db, 'snes', ['Locked']);
    const { service, games } = setup({ Locked: [HASH] });
    // Only a locked field chosen: the game is in scope but receives nothing.
    games.updateMetadata(locked, { developer: null }, new Date(NOW));
    await service.begin(
      { systemIds: ['snes'] },
      { ...RULES, onlyMissing: false, kinds: [], fields: ['developer'] },
    );
    await service.idle();
    expect(service.items({ limit: 100 }).items).toMatchObject([
      { gameId: locked, outcome: 'skipped', provider: null, error: null },
    ]);
  });

  it('FR-SCR-8: an unexpected error is recorded failed with its code', async () => {
    const [bad = 0] = seedGames(library.db, 'snes', ['Bad']);
    const { service } = setup({ Bad: ['NOT_FOUND'] });
    await service.begin({ systemIds: ['snes'] }, RULES);
    await service.idle();
    expect(service.items({ limit: 100, outcome: 'failed' }).items).toMatchObject([
      { gameId: bad, outcome: 'failed', error: 'NOT_FOUND' },
    ]);
  });

  it('FR-SCR-8: a quota pause writes no item for the retried game', async () => {
    seedGames(library.db, 'snes', ['One', 'Two']);
    const { service } = setup(
      { One: [HASH], Two: ['SCRAPER_QUOTA'] },
      { exhaustedUntil: '2026-10-25T22:00:00.000Z' },
    );
    await service.begin({ systemIds: ['snes'] }, RULES);
    await service.idle();
    expect(service.status()).toMatchObject({ state: 'paused', done: 1 });
    expect(service.details()?.listed).toBe(1);
  });

  it('FR-SCR-8: details() returns scope, rules, startedAt and listed; null when idle', async () => {
    seedGames(library.db, 'snes', ['One']);
    const { service } = setup({ One: [HASH] });
    expect(service.details()).toBeNull();
    await service.begin({ systemIds: ['snes'] }, RULES);
    await service.idle();
    const startedAt = new Date(NOW).toISOString();
    expect(service.details()).toMatchObject({
      scope: { systemIds: ['snes'] },
      rules: RULES,
      startedAt,
      listed: 1,
      status: { state: 'finished', startedAt, resumedAt: null },
    });
  });

  it('FR-SCR-8: details() still answers for a cancelled job', async () => {
    seedGames(library.db, 'snes', ['One', 'Two']);
    const { service } = setup({ One: [HASH], Two: ['SCRAPER_CREDENTIALS'] });
    await service.begin({ systemIds: ['snes'] }, RULES);
    await service.idle();
    service.cancel();
    expect(service.details()).toMatchObject({ status: { state: 'finished' }, listed: 1 });
    expect(service.items({ limit: 100 }).items).toHaveLength(1);
  });

  it('FR-SCR-8: items() is empty with no job', () => {
    const { service } = setup({});
    expect(service.items({ limit: 100 })).toEqual({ items: [], next: null });
  });

  it('US-C8: restore() marks the job resumed; begin() does not', async () => {
    seedGames(library.db, 'snes', ['One', 'Two']);
    const first = setup({ One: [HASH], Two: ['SCRAPER_CREDENTIALS'] });
    await first.service.begin({ systemIds: ['snes'] }, RULES);
    await first.service.idle();
    expect(first.service.status().resumedAt).toBeNull();
    first.service.dispose();
    const restarted = first.make();
    restarted.restore();
    await restarted.idle();
    expect(restarted.status()).toMatchObject({
      state: 'paused',
      resumedAt: new Date(NOW).toISOString(),
      startedAt: new Date(NOW).toISOString(),
    });
  });
});
