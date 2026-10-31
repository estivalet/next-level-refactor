// Cases ported from NextLevelOS src/themes/engine/gameCount.test.ts @ 3d530b7.
import { describe, expect, it } from 'vitest';
import { countGames } from './gameCount.ts';
import { game } from './testNodes.ts';

describe('countGames (FR-THM-1)', () => {
  it('excludes hidden games and honors a filter', () => {
    const games = [
      game(1, { filters: ['homebrew'] }),
      game(2),
      game(3, { hidden: true, filters: ['homebrew'] }),
    ];
    expect(countGames(games)).toBe(2);
    expect(countGames(games, 'homebrew')).toBe(1);
  });

  it('counts the favorite filter from the favorite flag', () => {
    const games = [game(1, { favorite: true }), game(2), game(3, { favorite: true, hidden: true })];
    expect(countGames(games, 'favorite')).toBe(1);
  });
});
