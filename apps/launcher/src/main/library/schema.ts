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

/** Favorites, hidden, the user's rating and play stats (FR-LIB-7); no row = all defaults. */
export const gameUserState = sqliteTable(
  'game_user_state',
  {
    gameId: integer('game_id')
      .primaryKey()
      .references(() => games.id, { onDelete: 'cascade' }),
    favorite: integer('favorite', { mode: 'boolean' }).notNull().default(false),
    hidden: integer('hidden', { mode: 'boolean' }).notNull().default(false),
    userRating: integer('user_rating'),
    playCount: integer('play_count').notNull().default(0),
    lastPlayedAt: text('last_played_at'),
    playSeconds: integer('play_seconds').notNull().default(0),
  },
  (table) => [index('game_user_state_hidden').on(table.hidden)],
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
  },
  (table) => [primaryKey({ columns: [table.gameId, table.kind] })],
);

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
