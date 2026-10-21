import { describe, expect, it } from 'vitest';
import { PAGE_SIZE, pagesForRange } from './pages.ts';

describe('pagesForRange', () => {
  it('NFR-PERF-2: only the pages under the viewport are requested', () => {
    expect(PAGE_SIZE).toBe(200);
    expect(pagesForRange(0, 30)).toEqual([0]);
    expect(pagesForRange(195, 210)).toEqual([0, 1]);
    expect(pagesForRange(9990, 9999)).toEqual([49]);
    expect(pagesForRange(0, -1)).toEqual([0]);
    expect(pagesForRange(399, 400, 200)).toEqual([1, 2]);
  });
});
