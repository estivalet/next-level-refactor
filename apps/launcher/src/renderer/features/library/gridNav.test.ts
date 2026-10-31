import { describe, expect, it } from 'vitest';
import { gridMove } from './gridNav.ts';

describe('gridMove', () => {
  it('D62: arrows wrap across rows and clamp at the ends', () => {
    expect(gridMove(3, 'ArrowRight', 4, 10)).toBe(4);
    expect(gridMove(4, 'ArrowLeft', 4, 10)).toBe(3);
    expect(gridMove(0, 'ArrowLeft', 4, 10)).toBe(0);
    expect(gridMove(9, 'ArrowRight', 4, 10)).toBe(9);
    // Review Focus 3: down from a row above the partial last row lands on the last game.
    expect(gridMove(7, 'ArrowDown', 4, 10)).toBe(9);
    expect(gridMove(5, 'ArrowDown', 4, 10)).toBe(9);
    expect(gridMove(1, 'ArrowDown', 4, 10)).toBe(5);
    expect(gridMove(1, 'ArrowUp', 4, 10)).toBe(1);
    expect(gridMove(9, 'ArrowUp', 4, 10)).toBe(5);
    expect(gridMove(9, 'End', 4, 10)).toBe(9);
    expect(gridMove(6, 'Home', 4, 10)).toBe(0);
    expect(gridMove(0, 'PageDown', 2, 20)).toBe(6);
    expect(gridMove(19, 'PageUp', 2, 20)).toBe(13);
  });

  it('D62: other keys are not moves; nothing focused starts at the first game', () => {
    expect(gridMove(3, 'Enter', 4, 10)).toBeNull();
    expect(gridMove(-1, 'ArrowRight', 4, 10)).toBe(0);
    expect(gridMove(-1, 'ArrowDown', 4, 10)).toBe(0);
  });
});
