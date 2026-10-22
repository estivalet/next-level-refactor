// Cases ported from NextLevelOS src/themes/hyperspin/wheelArc.test.ts @ 3d530b7.
import { describe, expect, it } from 'vitest';
import type { WheelSlotStyle } from '../components/VerticalWheel.tsx';
import { hyperspinSlotStyle } from './wheelArc.ts';
import { DEFAULT_WHEEL_SETTINGS } from './wheelSettings.ts';

const at100 = { ...DEFAULT_WHEEL_SETTINGS, itemHeight: 100 };

/** The formula before wheel settings existed, kept verbatim to pin the defaults. */
function legacy(distance: number, slotHeight: number): WheelSlotStyle {
  const a = Math.abs(distance);
  const y = distance * slotHeight;
  const r = 9 * slotHeight;
  const dy = Math.min(Math.abs(y), r);
  return {
    y,
    x: r - Math.sqrt(r * r - dy * dy),
    scale: a === 0 ? 1.12 : Math.max(0.8, 1 - 0.03 * a),
    opacity: 1,
    zIndex: 100 - a,
  };
}

describe('hyperspinSlotStyle (FR-THM-1)', () => {
  it('puts the focused slot at the center, leftmost and largest', () => {
    const focused = hyperspinSlotStyle(0, at100);
    expect(focused.y).toBe(0);
    expect(focused.x).toBe(0);
    for (let d = 1; d <= 8; d++) {
      expect(hyperspinSlotStyle(d, at100).scale).toBeLessThan(focused.scale);
    }
  });

  it('spaces slots evenly, one slot height apart, symmetric above and below', () => {
    expect(hyperspinSlotStyle(3, at100).y).toBe(300);
    expect(hyperspinSlotStyle(-3, at100).y).toBe(-300);
    expect(hyperspinSlotStyle(-4, at100).x).toBe(hyperspinSlotStyle(4, at100).x);
    expect(hyperspinSlotStyle(-4, at100).scale).toBe(hyperspinSlotStyle(4, at100).scale);
  });

  it('keeps every slot visible, curving right and shrinking gently toward the ends', () => {
    for (let a = 0; a < 8; a++) {
      const near = hyperspinSlotStyle(a, at100);
      const far = hyperspinSlotStyle(a + 1, at100);
      expect(far.opacity).toBe(1);
      expect(far.x).toBeGreaterThan(near.x);
      expect(far.scale).toBeGreaterThanOrEqual(0.8);
      expect(far.zIndex).toBeLessThan(near.zIndex);
    }
  });
});

describe('hyperspinSlotStyle with wheel settings (FR-THM-4)', () => {
  it('the defaults reproduce the original wheel exactly', () => {
    for (let d = -6; d <= 6; d++) {
      expect(hyperspinSlotStyle(d, DEFAULT_WHEEL_SETTINGS)).toEqual(legacy(d, 96));
    }
  });

  it('spacing below 1 packs items closer and the focused item stays on top', () => {
    const packed = { ...DEFAULT_WHEEL_SETTINGS, itemHeight: 100, spacing: 0.6 };
    expect(hyperspinSlotStyle(2, packed).y).toBeCloseTo(120);
    expect(hyperspinSlotStyle(-1, packed).y).toBeCloseTo(-60);
    const top = hyperspinSlotStyle(0, packed).zIndex;
    for (let d = 1; d <= 6; d++) {
      expect(hyperspinSlotStyle(d, packed).zIndex).toBeLessThan(top);
      expect(hyperspinSlotStyle(-d, packed).zIndex).toBeLessThan(top);
    }
  });

  it('focusOffset moves only the focused item, to the left', () => {
    const offset = { ...DEFAULT_WHEEL_SETTINGS, focusOffset: 40 };
    expect(hyperspinSlotStyle(0, offset).x).toBe(-40);
    expect(hyperspinSlotStyle(2, offset).x).toBe(hyperspinSlotStyle(2, DEFAULT_WHEEL_SETTINGS).x);
  });

  it('focusScale, shrink and minScale drive the scale; a larger curve bends less', () => {
    const scaled = { ...DEFAULT_WHEEL_SETTINGS, focusScale: 1.6, shrink: 0.1, minScale: 0.7 };
    expect(hyperspinSlotStyle(0, scaled).scale).toBe(1.6);
    expect(hyperspinSlotStyle(2, scaled).scale).toBeCloseTo(0.8);
    expect(hyperspinSlotStyle(5, scaled).scale).toBe(0.7);
    const flat = { ...DEFAULT_WHEEL_SETTINGS, curve: 40 };
    expect(hyperspinSlotStyle(4, flat).x).toBeLessThan(
      hyperspinSlotStyle(4, DEFAULT_WHEEL_SETTINGS).x,
    );
  });
});
