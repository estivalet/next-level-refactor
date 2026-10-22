// Ported from NextLevelOS src/themes/engine/ThemeEngineProvider.tsx @ 3d530b7: data comes from a
// ThemeHost (FR-THM-6) instead of /data/*.json and window.electronAPI.
import type { MenuNode } from '@nextlevel/shared';
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useReducer,
  useRef,
  type ReactNode,
} from 'react';
import type { ThemeHost } from '../host/ThemeHost.ts';
import { reshapeFilterLevels, resolveLevel } from './levelModel.ts';
import { initialEngineState, navReducer } from './navReducer.ts';
import type { EnterOptions, Level } from './types.ts';
import {
  ThemeEngineContext,
  ThemeHostContext,
  type ThemeNavigation,
} from './useThemeNavigation.ts';
import { useGameActions } from './useGameActions.ts';
import { useGamesLoader } from './useGamesLoader.ts';
import { useHostEvents } from './useHostEvents.ts';

const message = (error: unknown) => (error instanceof Error ? error.message : String(error));

export function ThemeEngineProvider({
  host,
  onExit,
  children,
}: {
  host: ThemeHost;
  onExit: () => void;
  children: ReactNode;
}) {
  const [state, dispatch] = useReducer(navReducer, undefined, initialEngineState);
  // Callbacks read the latest state without being recreated on every change.
  const stateRef = useRef(state);
  useLayoutEffect(() => {
    stateRef.current = state;
  });

  const loadMenu = useCallback(() => {
    host.getMenu().then(
      (menu) => {
        dispatch({ type: 'menu-loaded', items: menu.items, title: menu.title });
      },
      (error: unknown) => {
        dispatch({ type: 'menu-failed', error: message(error) });
      },
    );
  }, [host]);
  useEffect(loadMenu, [loadMenu]);

  const { load: loadGames, cancel: cancelLoad } = useGamesLoader(host, stateRef, dispatch);

  const currentLevel = state.stack[state.stack.length - 1] ?? null;
  const ancestors = useMemo(
    () =>
      state.stack
        .slice(0, -1)
        .map((level) => level.node)
        .filter((node): node is MenuNode => node != null),
    [state.stack],
  );
  const focusedNode =
    currentLevel?.kind === 'menu' ? (currentLevel.items[state.focusIndex] ?? null) : null;
  const focusedGame =
    currentLevel?.kind === 'games' ? (currentLevel.games[state.focusIndex] ?? null) : null;

  const push = useCallback(
    (level: Level, action: (level: Level) => void) => {
      action(level);
      if (level.kind === 'games') loadGames(level);
      else cancelLoad();
    },
    [loadGames, cancelLoad],
  );

  const enter = useCallback(
    (index: number, opts?: EnterOptions) => {
      const { stack } = stateRef.current;
      const top = stack[stack.length - 1];
      const node = top?.kind === 'menu' ? top.items[index] : undefined;
      if (!top || !node) return;
      const parents = [...stack.map((level) => level.node)].filter((n): n is MenuNode => n != null);
      push(resolveLevel(node, parents, opts), (level) => {
        dispatch({ type: 'push', level });
      });
    },
    [push],
  );

  const selectRoot = useCallback(
    (index: number) => {
      const root = stateRef.current.stack[0];
      const node = root?.kind === 'menu' ? root.items[index] : undefined;
      if (!node) return;
      push(resolveLevel(node, []), (level) => {
        dispatch({ type: 'select-root', index, level });
      });
    },
    [push],
  );

  const back = useCallback(() => {
    if (stateRef.current.stack.length <= 1) {
      onExit();
      return;
    }
    cancelLoad();
    dispatch({ type: 'back' });
  }, [onExit, cancelLoad]);

  const home = useCallback(() => {
    cancelLoad();
    dispatch({ type: 'home' });
  }, [cancelLoad]);
  const setFocus = useCallback((index: number) => {
    dispatch({ type: 'set-focus', index });
  }, []);
  const setFilterTab = useCallback((filterTab: string | undefined) => {
    dispatch({ type: 'set-filter-tab', filterTab });
  }, []);
  const setFilterLayout = useCallback(
    (filtersInMenu: boolean) => {
      const { stack, focusIndex } = stateRef.current;
      const next = reshapeFilterLevels(stack, focusIndex, filtersInMenu);
      if (!next) return;
      dispatch({ type: 'replace-stack', stack: next.stack, focusIndex: next.focusIndex });
      const top = next.stack[next.stack.length - 1];
      if (top?.kind === 'games' && top.loading) loadGames(top);
    },
    [loadGames],
  );

  const { launch, updateGameFlags } = useGameActions(host, dispatch);
  useHostEvents(host, stateRef, loadGames, dispatch);

  const value = useMemo<ThemeNavigation>(
    () => ({
      state,
      currentLevel,
      focusedNode,
      focusedGame,
      ancestors,
      enter,
      selectRoot,
      back,
      setFocus,
      home,
      launch,
      updateGameFlags,
      retry: loadMenu,
      setFilterLayout,
      setFilterTab,
    }),
    [
      state,
      currentLevel,
      focusedNode,
      focusedGame,
      ancestors,
      enter,
      selectRoot,
      back,
      setFocus,
      home,
      launch,
      updateGameFlags,
      loadMenu,
      setFilterLayout,
      setFilterTab,
    ],
  );

  return (
    <ThemeHostContext.Provider value={host}>
      <ThemeEngineContext.Provider value={value}>{children}</ThemeEngineContext.Provider>
    </ThemeHostContext.Provider>
  );
}
