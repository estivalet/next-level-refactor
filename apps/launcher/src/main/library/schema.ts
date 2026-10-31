import { sql } from 'drizzle-orm';
import {
  type AnySQLiteColumn,
  customType,
  index,
  integer,
  primaryKey,
  real,
  sqliteTable,
  text,
  uniqueIndex,
} from 'drizzle-orm/sqlite-core';

/** Windows paths ignore case, so the natural key (system_id, rel_path) does too. */
const nocaseText = customType<{ data: string; notNull: true }>({
  dataType: () => 'text COLLATE NOCASE',
});

/** Library tables (data model §4). M2b creates games and their metadata; later milestones add the rest. */
export const meta = sqliteTable('meta', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
});

export const games = sqliteTable(
  'games',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    systemId: text('system_id').notNull(),
    relPath: nocaseText('rel_path').notNull(),
    source: text('source', { enum: ['local', 'catalog'] })
      .notNull()
      .default('local'),
    catalogItemId: text('catalog_item_id'),
    locationId: text('location_id'),
    size: integer('size').notNull(),
    mtime: integer('mtime').notNull(),
    missing: integer('missing', { mode: 'boolean' }).notNull().default(false),
    missingSince: text('missing_since'),
    discGroup: text('disc_group'),
    addedAt: text('added_at').notNull(),
    /** Only a collection names it: left out of its system's lists and counts (import). */
    collectionOnly: integer('collection_only', { mode: 'boolean' }).notNull().default(false),
  },
  (table) => [
    // Its (system_id, rel_path) prefix also serves lookups by system.
    uniqueIndex('games_system_rel_path').on(table.systemId, table.relPath),
  ],
);

export const gameMetadata = sqliteTable(
  'game_metadata',
  {
    gameId: integer('game_id')
      .primaryKey()
      .references(() => games.id, { onDelete: 'cascade' }),
    title: text('title').notNull(),
    sortTitle: text('sort_title').notNull(),
    year: integer('year'),
    developer: text('developer'),
    publisher: text('publisher'),
    genre: text('genre'),
    players: text('players'),
    description: text('description'),
    region: text('region'),
    rating: real('rating'),
    lockedFields: text('locked_fields')
      .notNull()
      .default(sql`'[]'`),
    updatedAt: text('updated_at').notNull(),
  },
  (table) => [index('game_metadata_sort_title').on(table.sortTitle)],
);

/** Favorites, hidden, completed, the user's rating and play stats (FR-LIB-7, D60); no row = all defaults. */
export const gameUserState = sqliteTable(
  'game_user_state',
  {
    gameId: integer('game_id')
      .primaryKey()
      .references(() => games.id, { onDelete: 'cascade' }),
    favorite: integer('favorite', { mode: 'boolean' }).notNull().default(false),
    hidden: integer('hidden', { mode: 'boolean' }).notNull().default(false),
    /** The user finished the game (D60). */
    completed: integer('completed', { mode: 'boolean' }).notNull().default(false),
    userRating: integer('user_rating'),
    playCount: integer('play_count').notNull().default(0),
    lastPlayedAt: text('last_played_at'),
    playSeconds: integer('play_seconds').notNull().default(0),
  },
  (table) => [
    index('game_user_state_hidden').on(table.hidden),
    // The themes' Favorite filters are looked for after every game change (menuFingerprint).
    index('game_user_state_favorite').on(table.favorite),
  ],
);

/** Filter tags such as `homebrew` or `hack` (FR-LIB-6). */
export const gameFilters = sqliteTable(
  'game_filters',
  {
    gameId: integer('game_id')
      .notNull()
      .references(() => games.id, { onDelete: 'cascade' }),
    filter: text('filter').notNull(),
  },
  (table) => [primaryKey({ columns: [table.gameId, table.filter] })],
);

export const collections = sqliteTable('collections', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: nocaseText('name').notNull().unique(),
  sort: text('sort', { enum: ['manual', 'title', 'year'] })
    .notNull()
    .default('manual'),
  createdAt: text('created_at').notNull(),
  /** Import provenance (`nextlevelos:<name>`); null for collections made here (D12). */
  source: text('source').unique(),
});

export const collectionGames = sqliteTable(
  'collection_games',
  {
    collectionId: integer('collection_id')
      .notNull()
      .references(() => collections.id, { onDelete: 'cascade' }),
    gameId: integer('game_id')
      .notNull()
      .references(() => games.id, { onDelete: 'cascade' }),
    position: integer('position').notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.collectionId, table.gameId] }),
    index('collection_games_position').on(table.collectionId, table.position),
  ],
);

// games_fts (FTS5 over game_metadata.title) is created by the hand-written migration
// 0002_games_fts.sql: Drizzle Kit can't describe virtual tables or triggers.

/** A game's own profile, core and extra args (FR-EMU-4); no row = use the system's profile. */
export const gameLaunchOverride = sqliteTable('game_launch_override', {
  gameId: integer('game_id')
    .primaryKey()
    .references(() => games.id, { onDelete: 'cascade' }),
  profileId: text('profile_id'),
  core: text('core'),
  extraArgs: text('extra_args')
    .notNull()
    .default(sql`'[]'`),
});

/** Every launch (FR-EMU-10), newest 1,000 kept; titles and names are copies so rows outlive them. */
export const launchLog = sqliteTable(
  'launch_log',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    gameId: integer('game_id').references(() => games.id, { onDelete: 'set null' }),
    gameTitle: text('game_title').notNull(),
    profileId: text('profile_id').notNull(),
    profileName: text('profile_name').notNull(),
    argv: text('argv').notNull(),
    cwd: text('cwd').notNull(),
    test: integer('test', { mode: 'boolean' }).notNull().default(false),
    startedAt: text('started_at').notNull(),
    endedAt: text('ended_at'),
    exitCode: integer('exit_code'),
    errorCode: text('error_code'),
    stderrTail: text('stderr_tail'),
  },
  (table) => [index('launch_log_started').on(table.startedAt)],
);

/** One indexed media file per game and kind (`media/<kind>/<rom stem>.<ext>`), filled by the scan. */
export const gameMedia = sqliteTable(
  'game_media',
  {
    gameId: integer('game_id')
      .notNull()
      .references(() => games.id, { onDelete: 'cascade' }),
    kind: text('kind').notNull(),
    path: text('path').notNull(),
    size: integer('size').notNull(),
    /** File mtime in ms; part of the media URL so a replaced file is never served from cache. */
    version: integer('version').notNull().default(0),
  },
  (table) => [primaryKey({ columns: [table.gameId, table.kind] })],
);

/** The last scrape of a game (FR-SCR-2, FR-SCR-5); no row = never scraped. */
export const scrapeStatus = sqliteTable('scrape_status', {
  gameId: integer('game_id')
    .primaryKey()
    .references(() => games.id, { onDelete: 'cascade' }),
  provider: text('provider').notNull(),
  providerGameId: integer('provider_game_id'),
  status: text('status', { enum: ['scraped', 'review', 'notFound', 'failed'] }).notNull(),
  candidates: integer('candidates').notNull().default(0),
  error: text('error'),
  scrapedAt: text('scraped_at').notNull(),
});

/** Batch scrape jobs (FR-SCR-2, D18); at most one is running or paused at a time. */
export const scrapeJobs = sqliteTable('scrape_jobs', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  /** BatchScope as JSON. */
  scope: text('scope').notNull(),
  /** BatchRules as JSON. */
  rules: text('rules').notNull(),
  status: text('status', { enum: ['running', 'paused', 'finished', 'cancelled'] }).notNull(),
  /** The last game handled; the next one has a larger id. */
  cursorGameId: integer('cursor_game_id'),
  total: integer('total').notNull().default(0),
  done: integer('done').notNull().default(0),
  applied: integer('applied').notNull().default(0),
  review: integer('review').notNull().default(0),
  notFound: integer('not_found').notNull().default(0),
  failed: integer('failed').notNull().default(0),
  pausedReason: text('paused_reason'),
  resumeAt: text('resume_at'),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});

/** Arcade ROM facts NextLevelOS kept per game (data model §4); filled by the importer (D12). */
export const arcadeInfo = sqliteTable('arcade_info', {
  gameId: integer('game_id')
    .primaryKey()
    .references(() => games.id, { onDelete: 'cascade' }),
  rom: text('rom'),
  parent: text('parent'),
  driver: text('driver'),
  manufacturer: text('manufacturer'),
});

/** Saved game queries (FR-LIB-9); `query` is a SmartFilterQuery as JSON. */
export const smartFilters = sqliteTable('smart_filters', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: nocaseText('name').notNull().unique(),
  query: text('query').notNull(),
  createdAt: text('created_at').notNull(),
});

/** Menus (FR-MENU-3): at most one active; `source` marks imported ones (D12). */
export const menus = sqliteTable(
  'menus',
  {
    id: text('id').primaryKey(),
    title: text('title').notNull(),
    active: integer('active', { mode: 'boolean' }).notNull().default(false),
    revision: integer('revision').notNull().default(0),
    source: text('source').unique(),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
  },
  (table) => [
    uniqueIndex('menus_one_active')
      .on(table.active)
      .where(sql`active = 1`),
  ],
);

/** Menu tree nodes (FR-MENU-1/2); `ref_id` names a system, collection or smart filter. */
export const menuNodes = sqliteTable(
  'menu_nodes',
  {
    id: text('id').primaryKey(),
    menuId: text('menu_id')
      .notNull()
      .references(() => menus.id, { onDelete: 'cascade' }),
    parentId: text('parent_id').references((): AnySQLiteColumn => menuNodes.id, {
      onDelete: 'cascade',
    }),
    position: integer('position').notNull(),
    type: text('type', { enum: ['category', 'system', 'collection', 'smartFilter'] }).notNull(),
    refId: text('ref_id'),
    name: text('name').notNull(),
    displayName: text('display_name'),
    shortName: text('short_name'),
    /** FR-MENU-4 theme override: stored, not applied yet (D9). */
    themeId: text('theme_id'),
    filterTabs: integer('filter_tabs', { mode: 'boolean' }).notNull().default(true),
    visible: integer('visible', { mode: 'boolean' }).notNull().default(true),
  },
  (table) => [index('menu_nodes_menu').on(table.menuId, table.parentId, table.position)],
);

/**
 * Catalog downloads (FR-CAT-4, D47): the queue survives restarts, and so do partial files
 * (`<data>\downloads\<id>\<fileId>.part`). `item` is the CatalogItem at queue time.
 */
export const downloads = sqliteTable(
  'downloads',
  {
    id: text('id').primaryKey(),
    catalogItemId: text('catalog_item_id').notNull(),
    version: integer('version').notNull(),
    item: text('item').notNull(),
    state: text('state', { enum: ['queued', 'downloading', 'paused', 'failed', 'done'] }).notNull(),
    pausedReason: text('paused_reason', { enum: ['user', 'network', 'offline'] }),
    bytesDone: integer('bytes_done').notNull().default(0),
    bytesTotal: integer('bytes_total').notNull(),
    error: text('error'),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
  },
  (table) => [index('downloads_item').on(table.catalogItemId)],
);

/**
 * An installed catalog item (FR-CAT-3, FR-CAT-5, FR-CAT-7): the files the installer wrote
 * (relative to the location, `/`-separated), so uninstall deletes exactly those.
 */
export const catalogInstalls = sqliteTable('catalog_installs', {
  gameId: integer('game_id')
    .primaryKey()
    .references(() => games.id, { onDelete: 'cascade' }),
  catalogItemId: text('catalog_item_id').notNull().unique(),
  version: integer('version').notNull(),
  files: text('files').notNull(),
  locationId: text('location_id').notNull(),
  state: text('state', { enum: ['current', 'update', 'gone'] })
    .notNull()
    .default('current'),
  onLapse: text('on_lapse', { enum: ['keep', 'remove'] }).notNull(),
  installedAt: text('installed_at').notNull(),
});
