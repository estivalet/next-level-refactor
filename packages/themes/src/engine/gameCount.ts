// Ported from NextLevelOS src/themes/engine/gameCount.ts @ 3d530b7 (the cached JSON fetch is gone:
// counts come from levels the host already loaded).
import type { ThemeGame } from '@nextlevel/shared';

/** Visible games: not hidden, and carrying `filter` when one is given. */
export function countGames(games: readonly ThemeGame[], filter?: string): number {
  let count = 0;
  for (const game of games) {
    if (game.hidden) continue;
    if (filter && !game.filters.includes(filter)) continue;
    count += 1;
  }
  return count;
}
