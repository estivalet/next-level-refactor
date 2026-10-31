/** Rows a PageUp / PageDown moves in the grid. */
const PAGE_ROWS = 3;

/**
 * Where a key moves the focus in a grid of `columns` (D62): Left/Right step one game and wrap
 * across rows, Up/Down step a row (Down from above a partial last row lands on the last game;
 * Up on the first row stays), Home/End and PageUp/PageDown. Null for keys that don't move.
 */
export function gridMove(
  index: number,
  key: string,
  columns: number,
  total: number,
): number | null {
  const last = total - 1;
  const clamp = (next: number) => Math.min(last, Math.max(0, next));
  const moves: Record<string, () => number> = {
    ArrowLeft: () => clamp(index - 1),
    ArrowRight: () => clamp(index + 1),
    ArrowUp: () => (index - columns >= 0 ? index - columns : index),
    ArrowDown: () => clamp(index + columns),
    PageUp: () => clamp(index - columns * PAGE_ROWS),
    PageDown: () => clamp(index + columns * PAGE_ROWS),
    Home: () => 0,
    End: () => last,
  };
  const move = moves[key];
  if (!move) return null;
  return index < 0 ? 0 : move();
}
