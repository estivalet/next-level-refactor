// Ported from NextLevelOS src/themes/hyperspin/wheelArc.ts @ 3d530b7.
import type { WheelSlotStyle } from '../components/VerticalWheel.tsx';
import type { WheelSettings } from './wheelSettings.ts';

/**
 * HyperSpin wheel arc: slots `itemHeight × spacing` apart along a section of a circle
 * `curve × itemHeight` in radius, so the column fills the screen top to bottom. The focused slot
 * sits leftmost (pushed a further `focusOffset` px toward the stage), scaled to `focusScale`, and
 * always on top; the others curve right and shrink by `shrink` per step down to `minScale`.
 */
export function hyperspinSlotStyle(distance: number, s: WheelSettings): WheelSlotStyle {
  const a = Math.abs(distance);
  const y = distance * s.itemHeight * s.spacing;
  const r = s.curve * s.itemHeight;
  const dy = Math.min(Math.abs(y), r);
  const bend = r - Math.sqrt(r * r - dy * dy);
  return {
    y,
    x: a === 0 ? bend - s.focusOffset : bend,
    scale: a === 0 ? s.focusScale : Math.max(s.minScale, 1 - s.shrink * a),
    opacity: 1,
    zIndex: 100 - a,
  };
}
