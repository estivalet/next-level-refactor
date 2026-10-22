// Ported from NextLevelOS src/themes/engine/useFilterLayout.ts @ 3d530b7.
import { useEffect } from 'react';
import { useThemeNavigation } from './useThemeNavigation.ts';

/**
 * Declares how this theme shows a system's filters: `true` = entries in the systems menu,
 * `false` = tabs in the system's game list. The engine's stack survives theme switches, so levels
 * built the other way are rebuilt on the same system and filter. Every theme calls this.
 */
export function useFilterLayout(filtersInMenu: boolean): void {
  const { state, setFilterLayout } = useThemeNavigation();
  const ready = state.status === 'ready';
  useEffect(() => {
    if (ready) setFilterLayout(filtersInMenu);
  }, [ready, filtersInMenu, setFilterLayout]);
}
