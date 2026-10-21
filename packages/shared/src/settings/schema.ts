import { z } from 'zod';

// Launcher settings (data model §2). Sections arrive with the milestones that use them; every
// field has a default, so `{ "schemaVersion": 1 }` is a complete file. Plain objects strip
// unknown keys (a typo is dropped, not fatal); wrong types fail with the field's path.

export const CURRENT_SCHEMA_VERSION = 1;

export const LANGUAGES = ['en', 'pt-BR'] as const;
export type Language = (typeof LANGUAGES)[number];

/** Form metadata attached with `.meta()`; fields without it are not shown in Settings. */
export type FieldMeta = {
  labelKey: string;
  helpKey?: string;
};

function field(path: string): FieldMeta {
  return { labelKey: `settings.fields.${path}.label`, helpKey: `settings.fields.${path}.help` };
}

export const GeneralSchema = z.object({
  language: z.enum(LANGUAGES).default('en').meta(field('general.language')),
  startWithWindows: z.boolean().default(false).meta(field('general.startWithWindows')),
  /** ISO time the first-run wizard finished; null sends the user to the wizard (M9). */
  setupCompletedAt: z.iso.datetime().nullable().default(null),
});

export const SettingsSchema = z.object({
  schemaVersion: z.literal(CURRENT_SCHEMA_VERSION),
  general: GeneralSchema.prefault({}),
  experimental: z.record(z.string(), z.boolean()).default({}),
});

export type Settings = z.output<typeof SettingsSchema>;

/** A complete settings object with every default filled in. */
export function defaultSettings(): Settings {
  return SettingsSchema.parse({ schemaVersion: CURRENT_SCHEMA_VERSION });
}

/** The form metadata of a schema field, or undefined when the field is not user-editable. */
export function fieldMeta(schema: z.ZodType): FieldMeta | undefined {
  const meta = schema.meta();
  if (!meta || typeof meta['labelKey'] !== 'string') return undefined;
  const helpKey = meta['helpKey'];
  return typeof helpKey === 'string'
    ? { labelKey: meta['labelKey'], helpKey }
    : { labelKey: meta['labelKey'] };
}
