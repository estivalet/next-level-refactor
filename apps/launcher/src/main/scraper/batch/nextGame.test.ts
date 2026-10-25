import type { BatchRules } from '@nextlevel/shared';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { MediaRepository } from '../../library/MediaRepository.ts';
import { seedGames, tempLibrary } from '../../library/testing.ts';
import { countGames, nextGame } from './nextGame.ts';

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
};

const ids = (job: Parameters<typeof nextGame>[1]) => {
  const found: number[] = [];
  let cursor = job.cursorGameId;
  for (;;) {
    const next = nextGame(library.db, { ...job, cursorGameId: cursor });
    if (!next) return found;
    found.push(next.gameId);
    cursor = next.gameId;
  }
};

describe('nextGame (FR-SCR-2, D18)', () => {
  it('walks the scope by id after the cursor; other systems are left out', () => {
    const [a = 0, b = 0] = seedGames(library.db, 'snes', ['A', 'B']);
    seedGames(library.db, 'n64', ['C']);
    const job = { scope: { systemIds: ['snes'] }, rules: { ...RULES, onlyMissing: false } };
    expect(ids({ ...job, cursorGameId: null })).toEqual([a, b]);
    expect(ids({ ...job, cursorGameId: a })).toEqual([b]);
    expect(countGames(library.db, job.scope, job.rules)).toBe(2);
  });

  it('a game-id scope keeps only those games, missing ones included', () => {
    const [, b = 0, c = 0] = seedGames(library.db, 'snes', [
      'A',
      'B',
      { title: 'C', missing: true },
    ]);
    const job = { scope: { gameIds: [c, b] }, rules: { ...RULES, onlyMissing: false } };
    expect(ids({ ...job, cursorGameId: null })).toEqual([b, c]);
  });

  it('only missing: a game with every chosen kind and field is skipped', () => {
    const [full = 0, noArt = 0, emptyGenre = 0] = seedGames(library.db, 'snes', [
      { title: 'Full', genre: 'Racing' },
      { title: 'No art', genre: 'Racing' },
      { title: 'Empty genre', genre: '' },
    ]);
    const media = new MediaRepository(library.db);
    for (const gameId of [full, emptyGenre]) {
      media.upsert({
        gameId,
        kind: 'box-front',
        path: `C:/${String(gameId)}.png`,
        size: 1,
        version: 1,
      });
    }
    const job = { scope: { systemIds: ['snes'] }, rules: RULES, cursorGameId: null };
    expect(ids(job)).toEqual([noArt, emptyGenre]);
    expect(countGames(library.db, job.scope, RULES)).toBe(2);
  });

  it('only missing with no kinds and no fields picks nothing', () => {
    seedGames(library.db, 'snes', ['A']);
    const rules = { ...RULES, kinds: [], fields: [] };
    expect(
      nextGame(library.db, { scope: { systemIds: ['snes'] }, rules, cursorGameId: null }),
    ).toBeNull();
  });
});
