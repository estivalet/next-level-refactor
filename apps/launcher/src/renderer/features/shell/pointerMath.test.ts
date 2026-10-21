import { describe, expect, it } from 'vitest';
import { dragTo, resizeTo } from './pointerMath.ts';

describe('pointerMath', () => {
  it('FR-SHELL-2: dragTo moves the window by the pointer delta', () => {
    expect(dragTo({ x: 100, y: 100 }, { x: 10, y: 10 }, { x: 60, y: 5 })).toEqual({
      x: 150,
      y: 95,
    });
  });

  it('FR-SHELL-2: resizeTo grows the window by the pointer delta', () => {
    expect(resizeTo({ width: 600, height: 400 }, { x: 10, y: 10 }, { x: 60, y: 5 })).toEqual({
      width: 650,
      height: 395,
    });
  });
});
