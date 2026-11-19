import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { appErrorOf, seedGames, tempLibrary } from '../../library/testing.ts';
import { candidates, counts, HASH, makeSetup, NOW, RULES } from './batchTestSetup.ts';

let library: Awaited<ReturnType<typeof tempLibrary>>;
beforeEach(async () => {
  library = await tempLibrary();
});
afterEach(async () => {
  await library.cleanup();
});

const setup = makeSetup(() => library);

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
    const { service, scrapes } = setup({ Bad: ['NOT_FOUND'], Good: [HASH] });
    await service.begin({ systemIds: ['snes'] }, RULES);
    await service.idle();
    expect(counts(service.status())).toEqual([2, 1, 0, 0, 1]);
    expect(scrapes.get(bad)).toMatchObject({ status: 'failed', error: 'NOT_FOUND' });
  });

  it('review: a quota refusal during the downloads pauses; the game is redone on resume', async () => {
    seedGames(library.db, 'snes', ['One', 'Two']);
    const { service, applied } = setup(
      { One: [HASH], Two: [HASH] },
      { applyStep: { Two: 'SCRAPER_QUOTA' }, exhaustedUntil: '2026-10-25T22:00:00.000Z' },
    );
    await service.begin({ systemIds: ['snes'] }, RULES);
    await service.idle();
    expect(service.status()).toMatchObject({
      state: 'paused',
      pausedReason: 'quota',
      done: 1,
      failed: 0,
    });
    expect(applied).toHaveLength(2);
  });

  it('review: a system without a ScreenScraper id is refused at start, not failed game by game', async () => {
    seedGames(library.db, 'snes', ['One']);
    const [n64 = 0] = seedGames(library.db, 'n64', ['Two']);
    const { service } = setup({}, { noSystem: ['n64'] });
    await expect(service.begin({ systemIds: ['snes', 'n64'] }, RULES)).rejects.toMatchObject({
      error: { code: 'NO_SCRAPER_SYSTEM', details: { systemIds: ['n64'] } },
    });
    await expect(service.begin({ gameIds: [n64] }, RULES)).rejects.toMatchObject({
      error: { code: 'NO_SCRAPER_SYSTEM' },
    });
    expect(service.status().state).toBe('idle');
  });

  it('review: a locked empty field is not a gap; a game with nothing to write is never searched', async () => {
    const [locked = 0] = seedGames(library.db, 'snes', [{ title: 'Locked', genre: 'X' }]);
    const first = setup({ Locked: [HASH] });
    first.games.updateMetadata(locked, { developer: null }, new Date(NOW));
    for (const kind of ['box-front', 'logo-clear'] as const) {
      first.media.upsert({ gameId: locked, kind, path: `C:/${kind}.png`, size: 1, version: 1 });
    }
    await first.service.begin({ systemIds: ['snes'] }, { ...RULES, fields: ['developer'] });
    await first.service.idle();
    expect(first.service.status()).toMatchObject({ state: 'finished', total: 0, done: 0 });
    const again = setup({ Locked: [HASH] });
    await again.service.begin(
      { systemIds: ['snes'] },
      { ...RULES, onlyMissing: false, kinds: [], fields: ['developer'] },
    );
    await again.service.idle();
    expect(again.searched).toEqual([]);
    expect(again.service.status()).toMatchObject({ state: 'finished', done: 1, applied: 0 });
    expect(first.searched).toEqual([]);
  });

  it('review: every art write failing counts failed; three such games in a row pause (media)', async () => {
    seedGames(library.db, 'snes', ['A', 'B', 'C', 'D']);
    const { service } = setup(
      { A: [HASH], B: [HASH], C: [HASH], D: [HASH] },
      { applyStep: { A: 'writeFail', B: 'writeFail', C: 'writeFail', D: 'writeFail' } },
    );
    await service.begin({ systemIds: ['snes'] }, RULES);
    await service.idle();
    expect(service.status()).toMatchObject({
      state: 'paused',
      pausedReason: 'media',
      done: 3,
      failed: 3,
      applied: 0,
    });
  });

  it('review: cancel wins over a quota pause hit by the current game', async () => {
    seedGames(library.db, 'snes', ['One']);
    const hooks = { cancel: () => undefined as unknown };
    const { service, advance, searched } = setup(
      { One: ['SCRAPER_QUOTA', HASH] },
      { exhaustedUntil: '2026-10-25T22:00:00.000Z', onSearch: () => hooks.cancel() },
    );
    hooks.cancel = () => service.cancel();
    await service.begin({ systemIds: ['snes'] }, RULES);
    await service.idle();
    expect(service.status().state).toBe('finished');
    advance(24 * 3600 * 1000);
    await service.idle();
    expect(searched).toHaveLength(1);
  });

  it('review: a library write failing in the error path never wedges the loop', async () => {
    seedGames(library.db, 'snes', ['One', 'Two']);
    const { service, logged, searched } = setup(
      { One: [HASH], Two: [HASH] },
      {
        onSearch: (n) => {
          if (n === 1) library.db.$client.exec('alter table scrape_jobs rename to broken');
        },
      },
    );
    await service.begin({ systemIds: ['snes'] }, RULES);
    await service.idle();
    expect(logged.length).toBeGreaterThan(0);
    library.db.$client.exec('alter table broken rename to scrape_jobs');
    await service.resume();
    await service.idle();
    expect(searched.length).toBeGreaterThan(1);
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

describe('BatchScrapeService status and shutdown (FR-SCR-2)', () => {
  it('US-C6: the status names the systems of a system scope, null for a selection', async () => {
    const [one = 0] = seedGames(library.db, 'snes', ['One']);
    const { service } = setup({ One: [HASH] });
    await service.begin({ systemIds: ['snes', 'snes'] }, RULES);
    expect(service.status().systemIds).toEqual(['snes']);
    await service.idle();
    expect(service.status()).toMatchObject({ state: 'finished', systemIds: ['snes'] });
    await service.begin({ gameIds: [one] }, RULES);
    expect(service.status().systemIds).toBeNull();
    await service.idle();
  });

  it('after dispose, resume and a due quota timer start no run', async () => {
    seedGames(library.db, 'snes', ['First', 'Second']);
    const until = '2026-10-25T22:00:00.000Z';
    const { service, searched, advance } = setup(
      { First: [HASH], Second: ['SCRAPER_QUOTA', HASH] },
      { exhaustedUntil: until },
    );
    await service.begin({ systemIds: ['snes'] }, RULES);
    await service.idle();
    expect(service.status()).toMatchObject({ state: 'paused', pausedReason: 'quota' });
    service.dispose();
    advance(Date.parse(until) - NOW);
    await service.resume();
    await service.idle();
    expect(service.status()).toMatchObject({ state: 'paused', done: 1 });
    expect(searched).toHaveLength(2);
  });
});
