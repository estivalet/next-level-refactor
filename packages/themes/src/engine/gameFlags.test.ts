// Cases ported from NextLevelOS src/themes/engine/gameFlags.test.ts @ 3d530b7.
import { describe, expect, it } from 'vitest';
import { applyFlags, hasFilter, isFavorite, isHidden } from './gameFlags.ts';
import { game } from './testNodes.ts';

describe('gameFlags (FR-LIB-7)', () => {
  it('reads favorite and hidden', () => {
    expect(isFavorite(game(1, { favorite: true }))).toBe(true);
    expect(isFavorite(game(1))).toBe(false);
    expect(isHidden(game(1, { hidden: true }))).toBe(true);
  });

  it('hasFilter reads tags, and the favorite flag for the favorite filter', () => {
    expect(hasFilter(game(1, { filters: ['hack'] }), 'hack')).toBe(true);
    expect(hasFilter(game(1), 'hack')).toBe(false);
    expect(hasFilter(game(1, { favorite: true }), 'favorite')).toBe(true);
    expect(hasFilter(game(1), 'favorite')).toBe(false);
  });

  it('applyFlags applies only the given keys, without mutating', () => {
    const base = game(1, { favorite: true });
    const next = applyFlags(base, { hidden: true });
    expect(next).toMatchObject({ favorite: true, hidden: true });
    expect(base.hidden).toBe(false);
    expect(applyFlags(base, { favorite: false }).favorite).toBe(false);
  });
});
