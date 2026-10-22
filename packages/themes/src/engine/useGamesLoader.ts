import { useCallback, useRef, type Dispatch, type RefObject } from 'react';
import type { ThemeHost } from '../host/ThemeHost.ts';
import type { EngineState, Level, NavAction } from './types.ts';

export type GamesLevel = Extract<Level, { kind: 'games' }>;

const message = (error: unknown) => (error instanceof Error ? error.message : String(error));

/**
 * Loads game levels from the host. Only the newest request may patch the stack (`cancel` drops
 * any in flight). A `refresh` keeps focus on whatever game is focused when the answer arrives,
 * so scrolling during a reload is never undone.
 */
export function useGamesLoader(
  host: ThemeHost,
  stateRef: RefObject<EngineState>,
  dispatch: Dispatch<NavAction>,
) {
  const token = useRef(0);

  const load = useCallback(
    (level: GamesLevel, opts: { refresh?: boolean } = {}) => {
      const mine = ++token.current;
      host.getGames(level.node.id).then(
        (games) => {
          if (token.current !== mine) return;
          const { stack, focusIndex } = stateRef.current;
          const top = stack[stack.length - 1];
          const focusedId = top?.kind === 'games' ? top.games[focusIndex]?.id : undefined;
          dispatch({ type: 'patch-games', games });
          if (!opts.refresh || focusedId === undefined) return;
          const at = games.findIndex((game) => game.id === focusedId);
          dispatch({ type: 'set-focus', index: at >= 0 ? at : focusIndex });
        },
        (error: unknown) => {
          if (token.current === mine)
            dispatch({ type: 'patch-games-error', error: message(error) });
        },
      );
    },
    [host, stateRef, dispatch],
  );

  const cancel = useCallback(() => {
    token.current += 1;
  }, []);

  return { load, cancel };
}
