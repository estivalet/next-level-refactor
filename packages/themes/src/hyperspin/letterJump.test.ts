// Cases ported from NextLevelOS src/themes/hyperspin/letterJump.test.ts @ 3d530b7; the keymap case
// binds input actions (US-C1) and LT/RT keep letter jumps (D5).
import { describe, expect, it } from 'vitest';
import { HYPERSPIN_KEYMAP } from './keymap.ts';
import { vi } from 'vitest';
import type { ThemeGame } from '@nextlevel/shared';
import { FIXTURE_GAMES } from '../host/fixtures.ts';
import {
  letterJump,
  letterJumpKeys,
  letterKey,
  memoizedLetterKeys,
  randomOtherIndex,
} from './letterJump.ts';

describe('letterKey (FR-THM-1)', () => {
  it('uppercases letters and maps everything else to #', () => {
    expect(letterKey('alpha')).toBe('A');
    expect(letterKey('  zed')).toBe('Z');
    expect(letterKey('1942')).toBe('#');
    expect(letterKey('!bang')).toBe('#');
    expect(letterKey('')).toBe('#');
  });
});

// Runs: # (0) | A (1, 2) | B (3, 4)
const TITLES = ['1942', 'Alpha', 'Avenger', 'Beta', 'Bravo'];

describe('letterJump (FR-THM-1)', () => {
  it('forward goes to the first item of the next run, wrapping', () => {
    expect(letterJump(TITLES, 0, 1)).toBe(1);
    expect(letterJump(TITLES, 2, 1)).toBe(3);
    expect(letterJump(TITLES, 4, 1)).toBe(0);
  });

  it('backward from inside a run goes to the start of that run', () => {
    expect(letterJump(TITLES, 4, -1)).toBe(3);
    expect(letterJump(TITLES, 2, -1)).toBe(1);
  });

  it('backward from a run start goes to the previous run, wrapping', () => {
    expect(letterJump(TITLES, 3, -1)).toBe(1);
    expect(letterJump(TITLES, 1, -1)).toBe(0);
    expect(letterJump(TITLES, 0, -1)).toBe(3);
  });

  it('handles a single run and an empty list', () => {
    expect(letterJump(['Aa', 'Ab', 'Ac'], 2, 1)).toBe(0);
    expect(letterJump(['Aa', 'Ab', 'Ac'], 0, -1)).toBe(0);
    expect(letterJump([], 0, 1)).toBe(0);
  });
});

describe('randomOtherIndex (FR-THM-1)', () => {
  it('never returns the current index when there are 2+ items', () => {
    expect(randomOtherIndex(5, 0, () => 0)).toBe(1);
    expect(randomOtherIndex(5, 2, () => 0.5)).toBe(3);
    expect(randomOtherIndex(5, 4, () => 0.999)).toBe(3);
    expect(randomOtherIndex(2, 1, () => 0.7)).toBe(0);
  });

  it('keeps the current index with one item, and returns 0 with none', () => {
    expect(randomOtherIndex(1, 0, () => 0.4)).toBe(0);
    expect(randomOtherIndex(0, 0, () => 0.4)).toBe(0);
  });
});

describe('HYPERSPIN_KEYMAP (US-C1, D5)', () => {
  it('drives the wheel with up/down and letter jumps with left/right and LT/RT', () => {
    expect(HYPERSPIN_KEYMAP).toMatchObject({
      up: 'focus-prev',
      down: 'focus-next',
      left: 'jump-prev',
      right: 'jump-next',
      pageUp: 'jump-prev',
      pageDown: 'jump-next',
      random: 'random',
    });
  });
});

describe('letter keys on big lists (FR-THM-3, NFR-PERF)', () => {
  const base = FIXTURE_GAMES[0] as ThemeGame;
  const games: ThemeGame[] = Array.from({ length: 10_000 }, (_, i) => ({
    ...base,
    id: i + 1,
    title: `${String.fromCharCode(65 + Math.floor(i / 400))} game ${String(i)}`,
  }));

  it('100 letter jumps over 10k games compute each title key once', () => {
    const normalize = vi.fn(letterKey);
    const keysOf = memoizedLetterKeys(normalize);
    let focus = 0;
    for (let i = 0; i < 100; i += 1) focus = letterJumpKeys(keysOf(games), focus, 1);
    expect(normalize).toHaveBeenCalledTimes(10_000);
    // 25 runs of 400: 100 jumps forward go round four times, back to the start.
    expect(focus).toBe(0);
    expect(letterJumpKeys(keysOf(games), 0, 1)).toBe(400);
  });

  it('a new list gets its own keys', () => {
    const keysOf = memoizedLetterKeys(letterKey);
    expect(keysOf(games)).toBe(keysOf(games));
    expect(keysOf(games.slice(0, 3))).toEqual(['A', 'A', 'A']);
  });
});
