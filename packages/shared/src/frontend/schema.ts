import { z } from 'zod';

// Front-end (themes) contracts: what the launcher hands a ThemeHost over IPC (FR-THM-6).

/** A theme id and a pack folder name. */
export const THEME_ID = /^[a-z0-9-]{1,40}$/;

/** A game media kind = the folder name under `media/` (data model §4). */
export const MEDIA_KIND = /^[a-z0-9-]{1,40}$/;

/** Game art kinds in display order; other indexed kinds are allowed too. */
export const GAME_ART_KINDS = [
  'box-front',
  'box-back',
  'fanart',
  'video',
  'screenshot-game-play',
  'screenshot-title',
  'screenshot-select',
  'logo-clear',
  'marquee',
] as const;

export const MENU_NODE_TYPES = ['category', 'system', 'collection', 'filter'] as const;

export type MenuNode = {
  id: string;
  /** The menu-art key (system name, manufacturer, collection name). */
  name: string;
  display: string;
  /** Generated categories carry an i18n key; themes prefer it over `display`. */
  labelKey?: string | undefined;
  shortName?: string | undefined;
  type: (typeof MENU_NODE_TYPES)[number];
  systemId?: string | undefined;
  collectionId?: number | undefined;
  filter?: string | undefined;
  children: MenuNode[];
};

export const MenuNodeSchema: z.ZodType<MenuNode> = z.lazy(() =>
  z.object({
    id: z.string().min(1).max(200),
    name: z.string(),
    display: z.string(),
    labelKey: z.string().optional(),
    shortName: z.string().optional(),
    type: z.enum(MENU_NODE_TYPES),
    systemId: z.string().optional(),
    collectionId: z.number().int().positive().optional(),
    filter: z.string().optional(),
    children: z.array(MenuNodeSchema),
  }),
);

export const MenuTreeSchema = z.object({
  title: z.string(),
  items: z.array(MenuNodeSchema),
});

/** One game in a theme level: everything a theme shows without another round trip. */
export const ThemeGameSchema = z.object({
  id: z.number().int().positive(),
  systemId: z.string(),
  title: z.string(),
  year: z.number().int().nullable(),
  genre: z.string().nullable(),
  players: z.string().nullable(),
  developer: z.string().nullable(),
  publisher: z.string().nullable(),
  favorite: z.boolean(),
  hidden: z.boolean(),
  filters: z.array(z.string()),
  playCount: z.number().int().min(0),
  lastPlayedAt: z.string().nullable(),
  /** Indexed media kinds of this game (`game_media`). */
  media: z.array(z.string().regex(MEDIA_KIND)),
});

export const ThemeGamesSchema = z.array(ThemeGameSchema).max(200000);

export const GAME_BACKGROUND_SOURCES = ['fanart', 'video', 'screenshot'] as const;

/** A theme's art preferences (data model §2.5); every key optional, merged by layer. */
export const ThemeArtOptionsSchema = z.object({
  logoVariant: z.string().min(1).max(40).optional(),
  backgroundVariants: z.array(z.string().min(1).max(80)).optional(),
  useVideoBackground: z.boolean().optional(),
  backgroundZoom: z.boolean().optional(),
  gameBackgroundSources: z.array(z.enum(GAME_BACKGROUND_SOURCES)).optional(),
  /** Game tile art kinds per system id, or `default`. */
  gameArt: z.record(z.string(), z.array(z.string())).optional(),
});

export const ThemeOptionsSchema = z.object({
  art: ThemeArtOptionsSchema.optional(),
  /** Theme-specific settings; each theme validates its own keys. */
  settings: z.record(z.string(), z.unknown()).optional(),
});

/** A theme pack's `theme.json` (only `id` is required). */
export const ThemeManifestSchema = z.object({
  id: z.string(),
  version: z.string().optional(),
  author: z.string().optional(),
  description: z.string().optional(),
  /** False drops the shared art folder for this theme. */
  fallback: z.boolean().optional(),
  art: ThemeArtOptionsSchema.optional(),
  settings: z.record(z.string(), z.unknown()).optional(),
});

export const ART_INDEX_WARNING_CODES = [
  'folderUnreadable',
  'manifestInvalidJson',
  'manifestNotObject',
  'manifestIdMismatch',
  'manifestFallbackInvalid',
  'manifestArtNotObject',
  'manifestArtWrongType',
  'manifestSettingsNotObject',
] as const;

/** Something about a theme's art folders or pack `theme.json` worth telling the user; `field`
 * names the offending key or value. Settings shows it through i18n (FR-THM-2). */
export const ArtIndexWarningSchema = z.object({
  code: z.enum(ART_INDEX_WARNING_CODES),
  field: z.string().max(200).optional(),
});

/** The art files a theme can use: its pack's, then the shared folder's (FR-THM-2). */
export const ArtIndexSchema = z.object({
  /** Relative `/`-separated paths under `<themesPath>/<themeId>`. */
  packFiles: z.array(z.string()),
  /** Relative `/`-separated paths under the shared art folder. */
  assetsFiles: z.array(z.string()),
  manifest: ThemeManifestSchema.nullable(),
  warnings: z.array(ArtIndexWarningSchema),
});

export type MenuTree = z.output<typeof MenuTreeSchema>;
export type ThemeGame = z.output<typeof ThemeGameSchema>;
export type GameBackgroundSource = (typeof GAME_BACKGROUND_SOURCES)[number];
export type ThemeArtOptions = z.output<typeof ThemeArtOptionsSchema>;
export type ThemeOptions = z.output<typeof ThemeOptionsSchema>;
export type ThemeManifest = z.output<typeof ThemeManifestSchema>;
export type ArtIndex = z.output<typeof ArtIndexSchema>;
export type ArtIndexWarning = z.output<typeof ArtIndexWarningSchema>;
