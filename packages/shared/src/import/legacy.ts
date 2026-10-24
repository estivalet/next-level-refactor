import { z } from 'zod';

// Lenient schemas of the NextLevelOS `public/data` files (FR-IMP-1, data model §6). The importer
// reads years of hand-edited JSON: a field of the wrong type is dropped instead of failing the
// file, list entries that can't be read are skipped, and unknown keys are kept so the report can
// name them. Only the shapes the importer maps are described.

/** An optional field that becomes undefined when it has the wrong type. */
const lenient = <T extends z.ZodType>(schema: T) => schema.optional().catch(undefined);

/** A list that keeps the entries `item` accepts and skips the rest. */
function lenientArray<T extends z.ZodType>(item: T) {
  return z
    .array(z.unknown())
    .catch([])
    .transform((entries) =>
      entries.flatMap((entry) => {
        const parsed = item.safeParse(entry);
        return parsed.success ? [parsed.data as z.output<T>] : [];
      }),
    );
}

/** A string or a list of strings, always read as a list. */
const stringList = z
  .union([z.string().transform((value) => [value]), z.array(z.string())])
  .optional()
  .catch(undefined);

const text = lenient(z.string());

export const LegacyStorageSchema = z.looseObject({
  name: z.string().catch(''),
  path: z.string(),
  priority: lenient(z.number()),
});

export const LegacyConfigSchema = z.looseObject({
  storage: lenientArray(LegacyStorageSchema).default([]),
  scanExtensions: lenient(z.array(z.string())),
  assets: text,
  themesPath: text,
  menu: text,
});

export const LegacyLauncherSchema = z.looseObject({
  command: z.string().catch(''),
  rompath: stringList.transform((value) => value ?? []),
  romext: stringList,
  emulators: lenient(z.array(z.string())),
  gameArt: lenient(z.unknown()),
});

export const LegacyLaunchersSchema = z.record(z.string(), LegacyLauncherSchema);

export type LegacyMenuItem = {
  name: string;
  display?: string | undefined;
  disply?: string | undefined;
  type?: string | undefined;
  shortname?: string | undefined;
  filter?: string | undefined;
  theme?: string | undefined;
  visible?: boolean | undefined;
  items?: LegacyMenuItem[] | undefined;
};

export const LegacyMenuItemSchema: z.ZodType<LegacyMenuItem> = z.lazy(() =>
  z.looseObject({
    name: z.string(),
    display: text,
    disply: text,
    type: text,
    shortname: text,
    filter: text,
    theme: text,
    visible: lenient(z.boolean()),
    items: lenientArray(LegacyMenuItemSchema).optional(),
  }),
);

export const LegacyMenuSchema = z.looseObject({
  title: z.string().catch('Menu'),
  items: lenientArray(LegacyMenuItemSchema),
});

const stringOrNumber = lenient(z.union([z.string(), z.number()]));

export const LegacyGameSchema = z.looseObject({
  filename: z.string(),
  system: text,
  title: text,
  year: stringOrNumber,
  desc: lenient(z.string().nullable()),
  players: stringOrNumber,
  publisher: text,
  developer: text,
  genre: text,
  category: text,
  filter: lenient(z.array(z.string())),
  hidden: lenient(z.boolean()),
  played: lenient(z.union([z.string(), z.number(), z.null()])),
  lastPlayedOn: text,
  core: text,
  config: text,
  alt_game_config: text,
  shader: text,
  launch_args: text,
  emulator: text,
  rom: text,
  parent: text,
  driver: text,
  manufacturer: text,
  folder: stringOrNumber,
  rompath: text,
});

/** A gamelist: entries stay raw, each is read with `LegacyGameSchema` so one bad entry is counted. */
export const LegacyGamelistSchema = z.looseObject({ games: z.array(z.unknown()) });

export const LegacyThemeSchema = z.looseObject({
  id: z.string(),
  art: lenient(z.record(z.string(), z.unknown())),
  settings: lenient(z.record(z.string(), z.unknown())),
});

export const LegacyThemesSchema = z.looseObject({
  activeDefault: text,
  themes: lenientArray(LegacyThemeSchema).default([]),
});

/** Legacy system name → ScreenScraper system id; non-numbers are skipped. */
export const LegacyScreenscraperSchema = z
  .record(z.string(), z.unknown())
  .transform((entries) =>
    Object.fromEntries(
      Object.entries(entries).filter(
        (entry): entry is [string, number] =>
          typeof entry[1] === 'number' && Number.isInteger(entry[1]) && entry[1] > 0,
      ),
    ),
  );

export type LegacyConfig = z.output<typeof LegacyConfigSchema>;
export type LegacyLauncher = z.output<typeof LegacyLauncherSchema>;
export type LegacyLaunchers = z.output<typeof LegacyLaunchersSchema>;
export type LegacyMenu = z.output<typeof LegacyMenuSchema>;
export type LegacyGame = z.output<typeof LegacyGameSchema>;
export type LegacyThemes = z.output<typeof LegacyThemesSchema>;
export type LegacyScreenscraper = z.output<typeof LegacyScreenscraperSchema>;
