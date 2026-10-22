import { useEffect, type Dispatch, type RefObject } from 'react';
import type { ThemeHost } from '../host/ThemeHost.ts';
import type { EngineState, Level, NavAction } from './types.ts';

/**
 * Keeps the open level in step with the host (FR-THM-6, US-C2): a library change re-fetches the
 * open game list and keeps focus on the same game; a finished launch focuses that game.
 */
export function useHostEvents(
  host: ThemeHost,
  stateRef: RefObject<EngineState>,
  loadGames: (level: Extract<Level, { kind: 'games' }>, keepFocusOn?: number) => void,
  dispatch: Dispatch<NavAction>,
) {
  useEffect(
    () =>
      host.onEvent((event) => {
        const { stack, focusIndex } = stateRef.current;
        const top = stack[stack.length - 1];
        if (top?.kind !== 'games' || top.loading) return;
        if (event.type === 'library-changed') {
          const ids = event.gameIds;
          if (ids && !top.games.some((game) => ids.includes(game.id))) return;
          const focused = top.games[focusIndex];
          loadGames(top, focused?.id ?? -1);
        } else if (event.type === 'launch-finished') {
          const at = top.games.findIndex((game) => game.id === event.gameId);
          if (at >= 0) dispatch({ type: 'set-focus', index: at });
        }
      }),
    [host, stateRef, loadGames, dispatch],
  );
}
