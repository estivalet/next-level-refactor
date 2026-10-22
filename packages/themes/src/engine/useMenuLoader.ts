import { useCallback, useEffect, useRef, type Dispatch, type RefObject } from 'react';
import type { ThemeHost } from '../host/ThemeHost.ts';
import { navReducer } from './navReducer.ts';
import type { GamesLevel } from './useGamesLoader.ts';
import type { EngineState, NavAction } from './types.ts';

const message = (error: unknown) => (error instanceof Error ? error.message : String(error));

/**
 * Loads the host's menu on mount (and on retry), and reloads it when the host says it changed
 * (US-D5): the open path is kept by node id and a surviving games level is refreshed. Only the
 * newest request may land, so a slow first load can't undo a later reload; a failed reload keeps
 * the menu on screen, or shows the error when no menu arrived yet. A reload never cancels a games
 * load: the ref may not show a level the user just opened, and a games answer for a level that
 * was popped is dropped by the reducer anyway.
 */
export function useMenuLoader(
  host: ThemeHost,
  stateRef: RefObject<EngineState>,
  dispatch: Dispatch<NavAction>,
  loadGames: (level: GamesLevel, opts?: { refresh?: boolean }) => void,
) {
  const token = useRef(0);

  const loadMenu = useCallback(() => {
    const mine = ++token.current;
    host.getMenu().then(
      (menu) => {
        if (token.current === mine) {
          dispatch({ type: 'menu-loaded', items: menu.items, title: menu.title });
        }
      },
      (error: unknown) => {
        if (token.current === mine) dispatch({ type: 'menu-failed', error: message(error) });
      },
    );
  }, [host, dispatch]);
  useEffect(loadMenu, [loadMenu]);

  const reloadMenu = useCallback(() => {
    const mine = ++token.current;
    host.getMenu().then(
      (menu) => {
        if (token.current !== mine) return;
        const action = { type: 'menu-reloaded', items: menu.items, title: menu.title } as const;
        const next = navReducer(stateRef.current, action);
        dispatch(action);
        const top = next.stack[next.stack.length - 1];
        if (top?.kind === 'games') loadGames(top, top.loading ? {} : { refresh: true });
      },
      (error: unknown) => {
        if (token.current === mine && stateRef.current.status !== 'ready') {
          dispatch({ type: 'menu-failed', error: message(error) });
        }
      },
    );
  }, [host, stateRef, dispatch, loadGames]);

  return { loadMenu, reloadMenu };
}
