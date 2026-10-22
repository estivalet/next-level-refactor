import { z } from 'zod';

// Per-theme `settings` keys (FR-THM-4, data model §2.5): what Settings edits and saves in
// `settings.themes.entries[id].settings`. Every key is optional (the theme's default applies);
// unknown keys are left alone. Themes without options have no schema.

/** HyperSpin wheel ranges, as in the HyperSpin guide. */
export const HYPERSPIN_WHEEL_RANGES = {
  itemHeight: [24, 400],
  spacing: [0.3, 2],
  focusScale: [0.5, 3],
  shrink: [0, 0.5],
  minScale: [0.1, 1],
  focusOffset: [-400, 400],
  curve: [1, 100],
  pointerHeight: [16, 1200],
} as const satisfies Record<string, readonly [number, number]>;

export type WheelNumericKey = keyof typeof HYPERSPIN_WHEEL_RANGES;

export const WHEEL_PADDING_MAX = 400;
/** A wheel column width: a CSS length in %, px or vw. */
export const WHEEL_WIDTH_RE = /^\d+(\.\d+)?(%|px|vw)$/;

const ranged = ([min, max]: readonly [number, number]) => z.number().min(min).max(max);
const padding = z.number().min(0).max(WHEEL_PADDING_MAX);

/** `settings.wheel` / `settings.menuWheel` of HyperSpin. */
export const WheelOptionsSchema = z.object({
  width: z.string().regex(WHEEL_WIDTH_RE).optional(),
  itemHeight: ranged(HYPERSPIN_WHEEL_RANGES.itemHeight).optional(),
  spacing: ranged(HYPERSPIN_WHEEL_RANGES.spacing).optional(),
  focusScale: ranged(HYPERSPIN_WHEEL_RANGES.focusScale).optional(),
  shrink: ranged(HYPERSPIN_WHEEL_RANGES.shrink).optional(),
  minScale: ranged(HYPERSPIN_WHEEL_RANGES.minScale).optional(),
  focusOffset: ranged(HYPERSPIN_WHEEL_RANGES.focusOffset).optional(),
  curve: ranged(HYPERSPIN_WHEEL_RANGES.curve).optional(),
  padding: z.tuple([padding, padding, padding, padding]).optional(),
  pointerHeight: ranged(HYPERSPIN_WHEEL_RANGES.pointerHeight).optional(),
});

export type WheelOptions = z.output<typeof WheelOptionsSchema>;

export const THEME_SETTINGS_SCHEMAS: Readonly<Record<string, z.ZodObject>> = {
  hyperspin: z.object({
    filtersInMenu: z.boolean().optional(),
    wheel: WheelOptionsSchema.optional(),
    menuWheel: WheelOptionsSchema.optional(),
  }),
  showcase: z.object({ filtersInMenu: z.boolean().optional() }),
};

/** The schema of a theme's `settings`, or undefined for a theme without options. */
export function themeSettingsSchema(themeId: string): z.ZodObject | undefined {
  return Object.hasOwn(THEME_SETTINGS_SCHEMAS, themeId)
    ? THEME_SETTINGS_SCHEMAS[themeId]
    : undefined;
}

/** Adds an issue for every invalid key in the known themes' settings (unknown themes pass). */
export function checkThemeSettings(
  entries: Record<string, { settings?: Record<string, unknown> | undefined }>,
  ctx: z.RefinementCtx,
): void {
  for (const [themeId, entry] of Object.entries(entries)) {
    const schema = themeSettingsSchema(themeId);
    if (!schema || entry.settings === undefined) continue;
    const result = schema.safeParse(entry.settings);
    if (result.success) continue;
    for (const issue of result.error.issues) {
      ctx.addIssue({ ...issue, path: ['themes', 'entries', themeId, 'settings', ...issue.path] });
    }
  }
}
