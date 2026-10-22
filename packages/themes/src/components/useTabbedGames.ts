// Ported from NextLevelOS src/themes/components/useTabbedGames.ts @ 3d530b7.
import type { ThemeGame } from '@nextlevel/shared';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { displayIndexOf, engineIndexOf } from '../engine/filteredFocus.ts';
import { countTabs, DEFAULT_GAME_TABS, type GameTab } from './gameTabs.ts';
import { useInListSearch } from './useInListSearch.ts';

function initialTabId(
  tabs: readonly GameTab[],
  focused: ThemeGame | undefined,
  defaultTabId?: string,
): string {
  const first = tabs.find((tab) => tab.id === defaultTabId) ?? tabs[0];
  if (!first) return '';
  if (!focused || first.predicate(focused)) return first.id;
  return (tabs.find((tab) => tab.predicate(focused)) ?? first).id;
}

/**
 * Tabs and in-list search over a games level, with focus kept in the engine's unfiltered index
 * space. When the focused game drops out of the view (tab switch, search, a flag toggle), focus
 * moves to the game now at the last known view position.
 */
export function useTabbedGames({
  games,
  engineFocus,
  setEngineFocus,
  tabs = DEFAULT_GAME_TABS,
  defaultTabId,
  resetKey,
}: {
  games: readonly ThemeGame[];
  engineFocus: number;
  setEngineFocus: (index: number) => void;
  tabs?: readonly GameTab[] | undefined;
  /** The tab to open on (else the first). */
  defaultTabId?: string | undefined;
  resetKey?: unknown;
}) {
  const [activeTabId, setActiveTabId] = useState(() =>
    initialTabId(tabs, games[engineFocus], defaultTabId),
  );
  const lastPos = useRef(0);

  const gamesRef = useRef(games);
  gamesRef.current = games;
  const focusRef = useRef(engineFocus);
  focusRef.current = engineFocus;
  const mounted = useRef(false);
  useEffect(() => {
    // The first render already chose its tab.
    if (!mounted.current) {
      mounted.current = true;
      return;
    }
    lastPos.current = 0;
    setActiveTabId(initialTabId(tabs, gamesRef.current[focusRef.current], defaultTabId));
  }, [resetKey, tabs, defaultTabId]);

  const activeTab = tabs.find((tab) => tab.id === activeTabId) ?? tabs[0];
  const tabGames = useMemo(
    () => (activeTab ? games.filter(activeTab.predicate) : games),
    [games, activeTab],
  );
  const search = useInListSearch(tabGames);
  const display = search.filtered;
  const counts = useMemo(() => countTabs(games, tabs), [games, tabs]);

  const displayFocus = displayIndexOf(games, display, engineFocus);
  if (displayFocus >= 0) lastPos.current = displayFocus;

  // A layout effect lands at commit, before the next key press: otherwise a back pressed right
  // after a tab opens without the focused game could leave the level first, and this correction
  // would then move focus on the parent menu.
  useLayoutEffect(() => {
    if (displayFocus !== -1 || display.length === 0) return;
    const pos = Math.min(lastPos.current, display.length - 1);
    const target = engineIndexOf(games, display, pos);
    if (target >= 0) setEngineFocus(target);
  }, [displayFocus, display, games, setEngineFocus]);

  const setDisplayFocus = useCallback(
    (index: number) => {
      const target = engineIndexOf(games, display, index);
      if (target >= 0) setEngineFocus(target);
    },
    [games, display, setEngineFocus],
  );

  const selectTab = useCallback((id: string) => {
    lastPos.current = 0;
    setActiveTabId(id);
  }, []);

  const cycleTab = useCallback(
    (dir: 1 | -1) => {
      const i = tabs.findIndex((tab) => tab.id === activeTab?.id);
      const next = tabs[(i + dir + tabs.length) % tabs.length];
      if (next) selectTab(next.id);
    },
    [tabs, activeTab, selectTab],
  );

  const { setQuery: rawSetQuery } = search;
  const setQuery = useCallback(
    (query: string) => {
      lastPos.current = 0;
      rawSetQuery(query);
    },
    [rawSetQuery],
  );

  return {
    tabs,
    activeTabId: activeTab?.id ?? '',
    selectTab,
    cycleTab,
    counts,
    display,
    displayFocus,
    setDisplayFocus,
    search: { ...search, setQuery },
  };
}
