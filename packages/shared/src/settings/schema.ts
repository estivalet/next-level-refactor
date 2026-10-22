import { z } from 'zod';
import { checkProfiles, EmulatorProfileSchema, EmulatorSchema } from './emulators.ts';
import { THEME_ID, ThemeOptionsSchema } from '../frontend/schema.ts';
import { checkInput, InputSettingsSchema } from './input.ts';
import { checkThemeSettings } from '../frontend/themeSettings.ts';

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

const ThemeIdSchema = z.string().regex(THEME_ID);

/** Where the launcher opens after setup (FR-THM-5, owner decision D1). */
export const BootTargetSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('lastTheme') }),
  z.object({ kind: z.literal('theme'), themeId: ThemeIdSchema }),
  z.object({ kind: z.literal('desktop') }),
]);

export type BootTarget = z.output<typeof BootTargetSchema>;

export const GeneralSchema = z.object({
  language: z.enum(LANGUAGES).default('en').meta(field('general.language')),
  /** Edited by its own control in Settings → General (a choice plus a theme). */
  bootTarget: BootTargetSchema.default({ kind: 'lastTheme' }),
  startWithWindows: z.boolean().default(false).meta(field('general.startWithWindows')),
  /** ISO time the first-run wizard finished; null sends the user to the wizard (M9). */
  setupCompletedAt: z.iso.datetime().nullable().default(null),
});

/** Compares Windows paths: case-insensitive, either slash, no trailing separator. */
export function normalizePath(path: string): string {
  return path.trim().toLowerCase().replace(/\//g, '\\').replace(/\\+$/, '');
}

const ABSOLUTE_PATH = /^([a-zA-Z]:[\\/]|\\\\[^\\]+\\)/;

export const StorageLocationSchema = z.object({
  id: z.uuid(),
  name: z.string().trim().min(1).max(40),
  path: z.string().trim().min(3),
  /** 1 = searched first; renumbered from the list order on save. */
  priority: z.number().int().min(1),
});

export type StorageLocation = z.output<typeof StorageLocationSchema>;

const LocationsSchema = z.array(StorageLocationSchema).superRefine((locations, ctx) => {
  const paths = new Set<string>();
  const names = new Set<string>();
  locations.forEach((location, index) => {
    const path = normalizePath(location.path);
    if (!ABSOLUTE_PATH.test(location.path)) {
      ctx.addIssue({ code: 'custom', path: [index, 'path'], message: 'notAbsolute' });
    } else if (paths.has(path)) {
      ctx.addIssue({ code: 'custom', path: [index, 'path'], message: 'duplicatePath' });
    }
    const name = location.name.toLowerCase();
    if (names.has(name)) {
      ctx.addIssue({ code: 'custom', path: [index, 'name'], message: 'duplicateName' });
    }
    paths.add(path);
    names.add(name);
  });
});

/** An optional absolute folder (art, theme packs); null = not set. */
const OptionalFolderSchema = z
  .string()
  .trim()
  .refine((path) => ABSOLUTE_PATH.test(path), { message: 'notAbsolute' })
  .nullable()
  .default(null);

/** Storage locations in list order, with priority renumbered 1..n (FR-LIB-1). */
export function orderedLocations(locations: readonly StorageLocation[]): StorageLocation[] {
  return locations.map((location, index) => ({ ...location, priority: index + 1 }));
}

export const SystemSettingsSchema = z.object({
  enabled: z.boolean().default(false),
  /** Overrides the catalog's defaultFolderName (FR-LIB-2). */
  folderName: z
    .string()
    .trim()
    .min(1)
    .max(120)
    .regex(/^[^<>:"/\\|?*]+$/)
    .optional(),
  /** Overrides the catalog's extensions (FR-LIB-2). */
  extensions: z
    .array(z.string().regex(/^[a-z0-9]+$/))
    .min(1)
    .optional(),
  /** FR-EMU-4: the profile Play uses; a deleted profile falls through to the first match. */
  defaultProfileId: z.uuid().optional(),
});

export type SystemSettings = z.output<typeof SystemSettingsSchema>;

export const SettingsSchema = z
  .object({
    schemaVersion: z.literal(CURRENT_SCHEMA_VERSION),
    general: GeneralSchema.prefault({}),
    storage: z
      .object({
        locations: LocationsSchema.default([]),
        /** Shared menu art (FR-THM-2). */
        assetsPath: OptionalFolderSchema,
        /** Theme packs: `<themesPath>/<theme id>/` (FR-THM-2). */
        themesPath: OptionalFolderSchema,
      })
      .prefault({}),
    // Keyed by system id. Unknown ids are kept so a newer catalog's settings survive a downgrade.
    systems: z.record(z.string(), SystemSettingsSchema).default({}),
    emulators: z.array(EmulatorSchema).default([]),
    profiles: z.array(EmulatorProfileSchema).default([]),
    // Theme ids are kept even when unknown (a newer launcher's theme); they fall back to Big Box
    // where they are used.
    themes: z
      .object({
        /** The theme the front-end opens when none was used yet. */
        activeDefault: ThemeIdSchema.default('big-box'),
        /** The theme open last (boot target `lastTheme`). */
        lastUsed: ThemeIdSchema.nullable().default(null),
        /** Per-theme option overrides (data model §2.5). */
        entries: z.record(ThemeIdSchema, ThemeOptionsSchema).default({}),
        /** Navigation sounds of every theme (FR-THM-4, D7): on/off and volume 0–100. */
        sound: z
          .object({
            enabled: z.boolean().default(true),
            volume: z.number().int().min(0).max(100).default(50),
          })
          .prefault({}),
      })
      .prefault({}),
    input: InputSettingsSchema.prefault({}),
    experimental: z.record(z.string(), z.boolean()).default({}),
  })
  .superRefine((settings, ctx) => {
    checkProfiles(settings, ctx);
    checkInput(settings, ctx);
    checkThemeSettings(settings.themes.entries, ctx);
  });

export type Settings = z.output<typeof SettingsSchema>;
/** Theme navigation sounds (D7). */
export type ThemeSound = Settings['themes']['sound'];

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
