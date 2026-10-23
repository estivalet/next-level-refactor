// Ported from NextLevelOS src/themes/hyperspin/letterJump.ts @ 3d530b7.
import type { ThemeGame } from '@nextlevel/shared';

/** First letter of a title (A–Z), or `#` for digits, symbols and empty titles. */
export function letterKey(title: string): string {
  const c = title.trim().charAt(0).toUpperCase();
  return c >= 'A' && c <= 'Z' ? c : '#';
}

/**
 * HyperSpin letter skip over a list in display order. Runs are consecutive items with the same
 * `letterKey`. Forward: first item of the next run (wrapping to 0). Backward: start of the
 * current run, or of the previous run when already there (wrapping to the last run).
 */
export function letterJump(titles: readonly string[], index: number, dir: 1 | -1): number {
  return letterJumpKeys(titles.map(letterKey), index, dir);
}

/** `letterJump` over keys already computed (see `letterKeysOf`). */
export function letterJumpKeys(keys: readonly string[], index: number, dir: 1 | -1): number {
  const n = keys.length;
  if (n === 0) return 0;
  const i = Math.max(0, Math.min(index, n - 1));
  const runStart = (j: number) => {
    let s = j;
    while (s > 0 && keys[s - 1] === keys[j]) s--;
    return s;
  };
  if (dir === 1) {
    let j = i + 1;
    while (j < n && keys[j] === keys[i]) j++;
    return j < n ? j : 0;
  }
  const s = runStart(i);
  if (s !== i) return s;
  return s === 0 ? runStart(n - 1) : runStart(s - 1);
}

/**
 * Letter keys per games list, computed once per list (a 10k-game wheel jumps without re-reading
 * every title). Lists are compared by identity; a new list gets new keys.
 */
export function memoizedLetterKeys(normalize: (title: string) => string) {
  const cache = new WeakMap<readonly ThemeGame[], string[]>();
  return (games: readonly ThemeGame[]): string[] => {
    let keys = cache.get(games);
    if (!keys) {
      keys = games.map((game) => normalize(game.title));
      cache.set(games, keys);
    }
    return keys;
  };
}

export const letterKeysOf = memoizedLetterKeys(letterKey);

/** A uniformly random index in [0, n) other than `current` (when n ≥ 2). */
export function randomOtherIndex(n: number, current: number, rand: () => number): number {
  if (n <= 1) return 0;
  let r = Math.min(n - 2, Math.floor(rand() * (n - 1)));
  if (r >= current) r += 1;
  return r;
}
