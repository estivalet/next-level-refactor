// Cases ported from NextLevelOS src/themes/engine/gridMath.test.ts @ 3d530b7.
import { describe, expect, it } from 'vitest';
import { moveInGrid } from './gridMath.ts';

// 14 items, 6 columns → rows [0-5] [6-11] [12-13]
describe('moveInGrid (FR-THM-1)', () => {
  it('left/right step linearly and wrap across rows', () => {
    expect(moveInGrid(5, 14, 6, 'right')).toBe(6);
    expect(moveInGrid(6, 14, 6, 'left')).toBe(5);
  });
  it('left/right stop at the ends', () => {
    expect(moveInGrid(0, 14, 6, 'left')).toBe(0);
    expect(moveInGrid(13, 14, 6, 'right')).toBe(13);
  });
  it('up/down move by a full row', () => {
    expect(moveInGrid(3, 14, 6, 'down')).toBe(9);
    expect(moveInGrid(9, 14, 6, 'up')).toBe(3);
  });
  it('up on the top row stays put', () => {
    expect(moveInGrid(3, 14, 6, 'up')).toBe(3);
  });
  it('down into a partial last row clamps to the last item', () => {
    expect(moveInGrid(9, 14, 6, 'down')).toBe(13);
  });
  it('down on the last row stays put', () => {
    expect(moveInGrid(12, 14, 6, 'down')).toBe(12);
  });
  it('a single row never moves vertically', () => {
    expect(moveInGrid(2, 4, 6, 'down')).toBe(2);
    expect(moveInGrid(2, 4, 6, 'up')).toBe(2);
  });
  it('empty grid returns 0', () => {
    expect(moveInGrid(0, 0, 6, 'right')).toBe(0);
  });
  it('clamps an out-of-range start index', () => {
    expect(moveInGrid(99, 14, 6, 'left')).toBe(12);
  });
});
