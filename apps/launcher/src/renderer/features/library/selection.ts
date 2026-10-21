/** Selected game ids of a list plus the row a Shift-range starts from. */
export interface Selection {
  anchor: number | null;
  ids: ReadonlySet<number>;
}

export const EMPTY_SELECTION: Selection = { anchor: null, ids: new Set() };

export type SelectMode = 'single' | 'toggle' | 'range';

/**
 * Click (single), Ctrl/⌘-click (toggle) and Shift-click (range) selection over list rows. Rows
 * not loaded yet (`idAt` undefined) are skipped.
 */
export function select(
  selection: Selection,
  index: number,
  mode: SelectMode,
  idAt: (index: number) => number | undefined,
): Selection {
  const id = idAt(index);
  if (mode === 'range' && selection.anchor !== null) {
    const ids = new Set<number>();
    const [from, to] = [Math.min(selection.anchor, index), Math.max(selection.anchor, index)];
    for (let i = from; i <= to; i += 1) {
      const rowId = idAt(i);
      if (rowId !== undefined) ids.add(rowId);
    }
    return { anchor: selection.anchor, ids };
  }
  if (mode === 'toggle') {
    const ids = new Set(selection.ids);
    if (id !== undefined && !ids.delete(id)) ids.add(id);
    return { anchor: index, ids };
  }
  return { anchor: index, ids: new Set(id === undefined ? [] : [id]) };
}

/** The row a list key moves to (arrows, Home, End), or null for other keys or an empty list. */
export function keyStep(key: string, index: number, count: number): number | null {
  if (count === 0) return null;
  if (key === 'Home') return 0;
  if (key === 'End') return count - 1;
  if (key === 'ArrowDown') return Math.min(count - 1, index + 1);
  if (key === 'ArrowUp') return Math.max(0, index - 1);
  return null;
}
