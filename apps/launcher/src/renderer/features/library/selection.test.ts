import { describe, expect, it } from 'vitest';
import { EMPTY_SELECTION, select } from './selection.ts';

// Row i holds game id 100 + i.
const idAt = (index: number) => (index >= 0 && index < 10 ? 100 + index : undefined);
const ids = (selection: { ids: ReadonlySet<number> }) => [...selection.ids].sort();

describe('selection', () => {
  it('FR-LIB-8: bulk selection supports toggle and shift-range', () => {
    let selection = select(EMPTY_SELECTION, 2, 'single', idAt);
    expect(ids(selection)).toEqual([102]);
    selection = select(selection, 5, 'range', idAt);
    expect(ids(selection)).toEqual([102, 103, 104, 105]);
    selection = select(selection, 4, 'toggle', idAt);
    expect(ids(selection)).toEqual([102, 103, 105]);
    expect(selection.anchor).toBe(4);
    selection = select(selection, 1, 'range', idAt);
    expect(ids(selection)).toEqual([101, 102, 103, 104]);
    selection = select(selection, 7, 'single', idAt);
    expect(ids(selection)).toEqual([107]);
  });

  it('FR-LIB-8: a range without an anchor selects one row; unknown rows are skipped', () => {
    expect(ids(select(EMPTY_SELECTION, 3, 'range', idAt))).toEqual([103]);
    expect(ids(select(EMPTY_SELECTION, 42, 'single', idAt))).toEqual([]);
  });
});
