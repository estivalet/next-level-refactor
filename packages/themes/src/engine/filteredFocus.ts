// Ported from NextLevelOS src/themes/engine/filteredFocus.ts @ 3d530b7.
/**
 * The engine's `focusIndex` always indexes a level's *unfiltered* list. Themes
 * that show a filtered view (tabs, search) translate through these. Filters
 * keep object identity, so `indexOf` is the mapping.
 */
export function displayIndexOf<T>(
  all: readonly T[],
  display: readonly T[],
  engineIndex: number,
): number {
  const item = all[engineIndex];
  return item === undefined ? -1 : display.indexOf(item);
}

export function engineIndexOf<T>(
  all: readonly T[],
  display: readonly T[],
  displayIndex: number,
): number {
  const item = display[displayIndex];
  return item === undefined ? -1 : all.indexOf(item);
}
