// Ported from NextLevelOS src/themes/engine/gameFlags.ts @ 3d530b7: games carry real favorite and
// hidden flags now (no `favorite` filter tag), and are identified by id.
import type { ThemeGame } from '@nextlevel/shared';

export interface GameFlagsPatch {
  favorite?: boolean;
  hidden?: boolean;
}

export const isFavorite = (game: ThemeGame): boolean => game.favorite;
export const isHidden = (game: ThemeGame): boolean => game.hidden;

/** A copy of `game` with only the given flags changed. */
export function applyFlags(game: ThemeGame, patch: GameFlagsPatch): ThemeGame {
  return {
    ...game,
    ...(patch.favorite === undefined ? {} : { favorite: patch.favorite }),
    ...(patch.hidden === undefined ? {} : { hidden: patch.hidden }),
  };
}
