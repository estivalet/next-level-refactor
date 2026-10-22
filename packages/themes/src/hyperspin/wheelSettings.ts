// Ported from NextLevelOS src/themes/hyperspin/wheelSettings.ts @ 3d530b7: instead of console
// warnings, the fields that fell back come back in `warnings` (Settings validates the same
// ranges, FR-THM-4).

/** HyperSpin's `settings.wheel`, after validation. */
export interface WheelSettings {
  /** Wheel column width: a CSS length in %, px or vw. */
  width: string;
  /** Slot height in px. */
  itemHeight: number;
  /** Center-to-center distance in item heights (< 1 overlaps). */
  spacing: number;
  /** Scale of the focused item. */
  focusScale: number;
  /** Scale lost per step away from the center. */
  shrink: number;
  /** Smallest scale. */
  minScale: number;
  /** Px the focused item moves left, toward the stage. */
  focusOffset: number;
  /** Arc radius in item heights (larger = flatter). */
  curve: number;
  /** Logo padding: top, right, bottom, left (px). */
  padding: [number, number, number, number];
  /** Pointer image height in px. */
  pointerHeight: number;
}

export const DEFAULT_WHEEL_SETTINGS: WheelSettings = {
  width: '34%',
  itemHeight: 96,
  spacing: 1,
  focusScale: 1.12,
  shrink: 0.03,
  minScale: 0.8,
  focusOffset: 0,
  curve: 9,
  padding: [6, 56, 6, 28],
  pointerHeight: 220,
};

export type WheelNumericKey = Exclude<keyof WheelSettings, 'width' | 'padding'>;

export const WHEEL_RANGES: Record<WheelNumericKey, readonly [number, number]> = {
  itemHeight: [24, 400],
  spacing: [0.3, 2],
  focusScale: [0.5, 3],
  shrink: [0, 0.5],
  minScale: [0.1, 1],
  focusOffset: [-400, 400],
  curve: [1, 100],
  pointerHeight: [16, 1200],
};

export const WHEEL_PADDING_MAX = 400;
export const WHEEL_WIDTH_RE = /^\d+(\.\d+)?(%|px|vw)$/;

/** The validated settings and the keys whose value was dropped (wrong, out of range, unknown). */
export interface ParsedWheel {
  value: WheelSettings;
  warnings: string[];
}

const isNumber = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const isObject = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === 'object' && !Array.isArray(v);
const isNumericKey = (key: string): key is WheelNumericKey => key in WHEEL_RANGES;

const defaults = (): WheelSettings => ({
  ...DEFAULT_WHEEL_SETTINGS,
  padding: [...DEFAULT_WHEEL_SETTINGS.padding],
});

/**
 * Validates `settings.wheel`. Missing keys take their default; an invalid value takes its default
 * and is reported; unknown keys are reported so a typo is visible. Never throws.
 */
export function parseWheelSettings(raw: unknown): ParsedWheel {
  const value = defaults();
  const warnings: string[] = [];
  if (raw === undefined) return { value, warnings };
  if (!isObject(raw)) return { value, warnings: ['wheel'] };
  for (const [key, v] of Object.entries(raw)) {
    if (key === 'width') {
      if (typeof v === 'string' && WHEEL_WIDTH_RE.test(v)) value.width = v;
      else warnings.push(key);
    } else if (key === 'padding') {
      if (
        Array.isArray(v) &&
        v.length === 4 &&
        v.every((n) => isNumber(n) && n >= 0 && n <= WHEEL_PADDING_MAX)
      ) {
        const [top, right, bottom, left] = v as number[];
        value.padding = [top ?? 0, right ?? 0, bottom ?? 0, left ?? 0];
      } else {
        warnings.push(key);
      }
    } else if (isNumericKey(key)) {
      const [min, max] = WHEEL_RANGES[key];
      if (isNumber(v) && v >= min && v <= max) value[key] = v;
      else warnings.push(key);
    } else {
      warnings.push(key);
    }
  }
  return { value, warnings };
}

/**
 * Wheel settings for menu (category / system) levels: `settings.wheel` with `settings.menuWheel`
 * on top, key by key, then validated like `wheel`. System art is often a different shape from
 * game logos, so menus usually want a taller item. A non-object `menuWheel` is ignored and
 * reported.
 */
export function parseMenuWheelSettings(wheel: unknown, menuWheel: unknown): ParsedWheel {
  if (menuWheel === undefined) return parseWheelSettings(wheel);
  if (!isObject(menuWheel)) {
    const parsed = parseWheelSettings(wheel);
    return { ...parsed, warnings: [...parsed.warnings, 'menuWheel'] };
  }
  return parseWheelSettings(isObject(wheel) ? { ...wheel, ...menuWheel } : menuWheel);
}
