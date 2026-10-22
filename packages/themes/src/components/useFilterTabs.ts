// Ported from NextLevelOS src/themes/components/useFilterTabs.ts @ 3d530b7: a wrong value comes
// back as an i18n warning key instead of a console message, and counting a filter-only system as
// its games is useGameCount's `filtersAsGames` (no stripped copies of menu items).
import { useCallback, useMemo, useState } from 'react';
import type { EnterOptions } from '../engine/types.ts';
import { useFilterLayout } from '../engine/useFilterLayout.ts';
import { useThemeNavigation } from '../engine/useThemeNavigation.ts';
import { buildFilterTabs } from './gameTabs.ts';

const FLATTEN: EnterOptions = { flattenFilters: true };

/**
 * `settings.filtersInMenu` (FR-THM-4): a boolean, else `fallback` with a warning key when the
 * value has the wrong type. true = a system's filters are entries in the systems menu; false =
 * they are tabs in its game list.
 */
export function parseFiltersInMenu(
  value: unknown,
  fallback: boolean,
): { value: boolean; warning?: string } {
  if (typeof value === 'boolean') return { value };
  if (value === undefined) return { value: fallback };
  return { value: fallback, warning: 'themes.settings.filtersInMenuInvalid' };
}

/**
 * Where a system's filters live, for themes with the `filtersInMenu` option:
 * - `enterItem(i)` enters menu item i, flattened (filters as game-list tabs) unless
 *   `filtersInMenu`.
 * - `tabs` / `defaultTabId` feed `useGamesLevelController`: the level's filter tabs when it
 *   carries them, opening on the remembered filter; else undefined (the default tabs).
 * - `filtersAsGames` feeds `useGameCount`: with filters in the game list, a filter-only system
 *   counts as its games.
 */
export function useFilterTabs({ filtersInMenu }: { filtersInMenu: boolean }) {
  const nav = useThemeNavigation();
  const { enter } = nav;
  useFilterLayout(filtersInMenu);
  const enterItem = useCallback(
    (index: number) => {
      if (filtersInMenu) enter(index);
      else enter(index, FLATTEN);
    },
    [enter, filtersInMenu],
  );

  const level = nav.currentLevel;
  const filterTabs = level?.kind === 'games' ? level.filterTabs : undefined;
  const filterTab = level?.kind === 'games' ? level.filterTab : undefined;
  // Open on the level's remembered filter, read once per tab set: later tab changes update
  // `filterTab` but must not re-select the tab.
  const [opened, setOpened] = useState({ filterTabs, filterTab });
  if (opened.filterTabs !== filterTabs) setOpened({ filterTabs, filterTab });
  const openTab = opened.filterTabs === filterTabs ? opened.filterTab : filterTab;
  const flat = useMemo(() => {
    if (!filterTabs) return null;
    const built = buildFilterTabs(filterTabs);
    const preferred = openTab && `filter:${openTab}`;
    return preferred && built.tabs.some((tab) => tab.id === preferred)
      ? { ...built, defaultTabId: preferred }
      : built;
  }, [filterTabs, openTab]);

  return {
    enterItem,
    tabs: flat?.tabs,
    defaultTabId: flat?.defaultTabId,
    filtersAsGames: !filtersInMenu,
  };
}
