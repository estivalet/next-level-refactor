// Ported from NextLevelOS src/themes/engine/gridMath.ts @ 3d530b7.
export type GridDir = 'left' | 'right' | 'up' | 'down';

/**
 * Next focus index in a row-major grid of `count` items laid out in `columns`.
 * Left/right step linearly (so they wrap across rows) and stop at the ends;
 * up/down move a whole row, stay put on the first/last row, and clamp into a
 * partial last row.
 */
export function moveInGrid(index: number, count: number, columns: number, dir: GridDir): number {
  if (count <= 0) return 0;
  const cols = Math.max(1, Math.floor(columns));
  const i = Math.max(0, Math.min(index, count - 1));
  switch (dir) {
    case 'left':
      return Math.max(0, i - 1);
    case 'right':
      return Math.min(count - 1, i + 1);
    case 'up':
      return i - cols >= 0 ? i - cols : i;
    case 'down': {
      if (i + cols < count) return i + cols;
      const lastRowStart = Math.floor((count - 1) / cols) * cols;
      return i < lastRowStart ? count - 1 : i;
    }
  }
}
