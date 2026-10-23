import type { ThemeGame } from '@nextlevel/shared';

const cache = new WeakMap<readonly ThemeGame[], Map<number, number>>();

/**
 * Game id → index in a list, built once per list (lists are compared by identity), so a theme can
 * look up the settled game on a 10k-game level without scanning it on every move.
 */
export function gameIndexOf(games: readonly ThemeGame[]): ReadonlyMap<number, number> {
  let index = cache.get(games);
  if (!index) {
    index = new Map(games.map((game, i) => [game.id, i]));
    cache.set(games, index);
  }
  return index;
}

export function gameById(games: readonly ThemeGame[], id: number): ThemeGame | undefined {
  const at = gameIndexOf(games).get(id);
  return at === undefined ? undefined : games[at];
}
