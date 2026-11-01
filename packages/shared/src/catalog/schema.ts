import { z } from 'zod';

// System catalog (data model §3). Ids are permanent slugs (ADR-011); display names, folder names
// and art keys are attributes. Manufacturer and year are optional: the seed fills them only where
// reliably known.

export const SYSTEM_ID = /^[a-z0-9]+(-[a-z0-9]+)*$/;
export const EXTENSION = /^[a-z0-9]+$/;

export const SYSTEM_KINDS = [
  'console',
  'handheld',
  'arcade',
  'computer',
  'pinball',
  'engine',
  'other',
] as const;

export const SystemDefinitionSchema = z.object({
  id: z.string().regex(SYSTEM_ID),
  name: z.string().min(1),
  shortName: z.string().min(1).optional(),
  manufacturer: z.string().min(1).optional(),
  releaseYear: z.number().int().min(1950).max(2100).optional(),
  kind: z.enum(SYSTEM_KINDS),
  extensions: z.array(z.string().regex(EXTENSION)).min(1),
  defaultFolderName: z.string().min(1),
  multiDisc: z.boolean().optional(),
  scraper: z.object({ screenscraperId: z.number().int().positive().optional() }),
  /** Emulator preset profile ids, best first (filled in M3). */
  presetProfiles: z.array(z.string()),
  /** Earlier names, used by the NextLevelOS importer. */
  aliases: z.array(z.string()),
});

export type SystemDefinition = z.output<typeof SystemDefinitionSchema>;

export const SystemCatalogSchema = z.object({
  /** Where the data came from, e.g. "nextlevelos@6c9ed27 + es-de v3.2.0". */
  source: z.string().min(1),
  systems: z.array(SystemDefinitionSchema),
});

export type SystemCatalog = z.output<typeof SystemCatalogSchema>;

/** A ready-made launch profile; adding the preset's emulator copies it into settings (FR-EMU-7). */
export const PresetProfileSchema = z.object({
  /** `retroarch:<core>`, `mame:<system-id>[:<medium>]` or `<preset>:default`. */
  id: z.string().regex(/^[a-z0-9-]+:[a-z0-9_.-]+(:[a-z0-9]+)?$/),
  name: z.string().min(1),
  systems: z.array(z.string().regex(SYSTEM_ID)).min(1),
  args: z.array(z.string()),
  cwd: z.string().optional(),
  core: z.string().optional(),
  archives: z.enum(['pass', 'extract']),
  /** Environment templates the profile starts with (e.g. openMSX's home). */
  env: z.record(z.string(), z.string()).optional(),
});

export const EmulatorPresetSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/),
  name: z.string().min(1),
  /** File names that identify the emulator, used to suggest the preset (case-insensitive). */
  executableNames: z.array(z.string().min(1)).min(1),
  homepage: z.url(),
  profiles: z.array(PresetProfileSchema).min(1),
});

export type PresetProfile = z.output<typeof PresetProfileSchema>;
export type EmulatorPreset = z.output<typeof EmulatorPresetSchema>;

export const PresetCatalogSchema = z.object({
  source: z.string().min(1),
  presets: z.array(EmulatorPresetSchema),
});

export type PresetCatalog = z.output<typeof PresetCatalogSchema>;
