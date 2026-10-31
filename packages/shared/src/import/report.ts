import { z } from 'zod';

// The NextLevelOS import report (FR-IMP-2, IA F6): what a dry run found, what maps, what doesn't
// and why. Reasons are codes; Settings renders them through `import.reason.<code>`.

export const IMPORT_AREAS = [
  'storage',
  'system',
  'emulator',
  'menu',
  'game',
  'collection',
  'theme',
  'scraper',
  'config',
] as const;

/** Reasons for what was not imported, or not as it was. */
export const IMPORT_UNMAPPED_REASONS = [
  'unknownSystem',
  'noGamelist',
  'notAGamelist',
  'customCommand',
  'untypedEntry',
  'themeOverride',
  'folderEntry',
  'unknownCollectionSystem',
  'duplicateEntry',
  'nameConflict',
  'hookSetting',
  'dropped',
  'scrapeInM6',
  'perGameEmulator',
  'invalidFile',
  'invalidEntry',
  'absoluteRompath',
  'retroarchNotFound',
  'collectionLaunchFields',
  'unknownTheme',
  'notInMenu',
] as const;

/** Reasons for what was imported (the report's "mapped" list). */
export const IMPORT_MAPPED_REASONS = [
  'favoriteFilterTab',
  'filterTabs',
  'nestedFilterTab',
  'filterRenamed',
  'discSet',
  'storageAdded',
  'systemEnabled',
  'folderName',
  'extensions',
  'themeArt',
  'screenscraperId',
  'emulatorAdded',
  'launchOverride',
  'arcadeInfo',
  'artFolder',
  'replacesImport',
] as const;

export const IMPORT_REASONS = [...IMPORT_UNMAPPED_REASONS, ...IMPORT_MAPPED_REASONS] as const;

export type ImportArea = (typeof IMPORT_AREAS)[number];
export type ImportReason = (typeof IMPORT_REASONS)[number];

export const ImportItemSchema = z.object({
  area: z.enum(IMPORT_AREAS),
  /** What the item is about: a system name, a file, a config key. */
  key: z.string(),
  reason: z.enum(IMPORT_REASONS),
  /** Extra text shown as is (a custom command, the name used instead). */
  detail: z.string().optional(),
  /** How many entries this item stands for, when it groups several. */
  count: z.number().int().min(1).optional(),
});

export type ImportItem = z.output<typeof ImportItemSchema>;

const count = z.number().int().min(0);

/** What a dry run expects per system: entries with a file, entries that go missing, new files. */
export const ImportSystemCountsSchema = z.object({
  systemId: z.string(),
  entries: count,
  withFile: count,
  missing: count,
  newFiles: count,
});

export const ImportReportSchema = z.object({
  source: z.string(),
  /** Fingerprint of the files read; apply refuses when the folder changed since (CONFLICT). */
  token: z.string(),
  counts: z.object({
    systems: count,
    menus: count,
    menuNodes: count,
    gamelists: count,
    games: count,
    collections: count,
    collectionEntries: count,
  }),
  systems: z.array(ImportSystemCountsSchema),
  mapped: z.array(ImportItemSchema),
  unmapped: z.array(ImportItemSchema),
  willReplace: z.array(ImportItemSchema),
});

export type ImportReport = z.output<typeof ImportReportSchema>;
export type ImportSystemCounts = z.output<typeof ImportSystemCountsSchema>;

export const IMPORT_STAGES = ['settings', 'scan', 'games', 'collections', 'menus'] as const;

export type ImportStage = (typeof IMPORT_STAGES)[number];

export const ImportProgressSchema = z.object({
  stage: z.enum(IMPORT_STAGES),
  done: count,
  total: count,
});

export type ImportProgress = z.output<typeof ImportProgressSchema>;

export const ImportSummarySchema = z.object({
  games: z.object({ matched: count, inserted: count, missing: count }),
  collections: count,
  menus: count,
  /** The settings backup made before the import changed settings; null when nothing changed. */
  settingsBackupId: z.string().nullable(),
  durationMs: count,
});

export type ImportSummary = z.output<typeof ImportSummarySchema>;
