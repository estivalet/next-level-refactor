import { useEffect, type Dispatch, type RefObject } from 'react';
import type { ThemeHost } from '../host/ThemeHost.ts';
import type { GamesLevel } from './useGamesLoader.ts';
import type { EngineState, NavAction } from './types.ts';

/**
 * Keeps the open level in step with the host (FR-THM-6, US-C2): a library change that touches the
 * open level's systems or games re-fetches it (even mid-load, so a scan's late write is not
 * missed) and keeps focus on the same game; a finished launch focuses that game; a menu change
 * reloads the menu (US-D5).
 */
export function useHostEvents(
  host: ThemeHost,
  stateRef: RefObject<EngineState>,
  loadGames: (level: GamesLevel, opts?: { refresh?: boolean }) => void,
  dispatch: Dispatch<NavAction>,
  reloadMenu: () => void,
) {
  useEffect(
    () =>
      host.onEvent((event) => {
        if (event.type === 'menu-changed') {
          reloadMenu();
          return;
        }
        const { stack } = stateRef.current;
        const top = stack[stack.length - 1];
        if (top?.kind !== 'games') return;
        if (event.type === 'library-changed') {
          if (affects(top, event)) loadGames(top, { refresh: true });
        } else if (event.type === 'launch-finished') {
          const at = top.games.findIndex((game) => game.id === event.gameId);
          if (at >= 0) dispatch({ type: 'set-focus', index: at });
        }
      }),
    [host, stateRef, loadGames, dispatch, reloadMenu],
  );
}

/**
 * Whether a library change can touch this level. `systems` decides when main sends it (a game the
 * level doesn't show yet, e.g. one just relinked, still counts); otherwise `gameIds` does.
 */
function affects(level: GamesLevel, event: { systems?: string[]; gameIds?: number[] }): boolean {
  const { systems, gameIds } = event;
  if (systems) {
    const touched = new Set(systems);
    // A collection level that is still empty can't tell its systems: reload to be safe.
    if (level.systemId === null && level.games.length === 0) return true;
    return (
      (level.systemId !== null && touched.has(level.systemId)) ||
      level.games.some((game) => touched.has(game.systemId))
    );
  }
  if (gameIds && level.games.length > 0) {
    return level.games.some((game) => gameIds.includes(game.id));
  }
  return true;
}
