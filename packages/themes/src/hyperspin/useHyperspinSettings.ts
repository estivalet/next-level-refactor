// HyperSpin's options (FR-THM-4): `wheel`, `menuWheel` and `filtersInMenu`, validated once per
// value. A value that fell back is logged once, naming the keys (Settings shows the same ranges).
import { useEffect, useMemo } from 'react';
import { parseFiltersInMenu } from '../components/useFilterTabs.ts';
import { useThemeSettings } from '../engine/useThemeSettings.ts';
import { parseMenuWheelSettings, parseWheelSettings } from './wheelSettings.ts';

export function useHyperspinSettings() {
  const settings = useThemeSettings();
  const { wheel, menuWheel, filtersInMenu: rawFilters } = settings;
  const games = useMemo(() => parseWheelSettings(wheel), [wheel]);
  const menu = useMemo(() => parseMenuWheelSettings(wheel, menuWheel), [wheel, menuWheel]);
  const filters = useMemo(() => parseFiltersInMenu(rawFilters, true), [rawFilters]);

  const invalid = [
    ...new Set([
      ...games.warnings,
      ...menu.warnings,
      ...(filters.warning ? ['filtersInMenu'] : []),
    ]),
  ].join(', ');
  useEffect(() => {
    if (invalid) console.warn(`[hyperspin settings] invalid values ignored: ${invalid}`);
  }, [invalid]);

  return { gamesWheel: games.value, menuWheel: menu.value, filtersInMenu: filters.value };
}
