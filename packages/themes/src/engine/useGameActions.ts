import type { ThemeGame } from '@nextlevel/shared';
import { useCallback, type Dispatch } from 'react';
import type { ThemeHost } from '../host/ThemeHost.ts';
import { applyFlags, type GameFlagsPatch } from './gameFlags.ts';
import type { NavAction } from './types.ts';

/** Launch and favorite/hidden through the host; flags change at once and roll back on failure. */
export function useGameActions(host: ThemeHost, dispatch: Dispatch<NavAction>) {
  const launch = useCallback((game: ThemeGame) => host.launch(game.id), [host]);

  const updateGameFlags = useCallback(
    async (game: ThemeGame, patch: GameFlagsPatch) => {
      const apply = (flags: { favorite: boolean; hidden: boolean }) => {
        dispatch({ type: 'patch-game', gameId: game.id, patch: flags });
      };
      const next = applyFlags(game, patch);
      apply({ favorite: next.favorite, hidden: next.hidden });
      const saved = await host.setGameFlags(game.id, patch).catch(() => false);
      if (!saved) apply({ favorite: game.favorite, hidden: game.hidden });
      return saved;
    },
    [host, dispatch],
  );

  return { launch, updateGameFlags };
}
