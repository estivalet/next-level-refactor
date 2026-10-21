import { sql } from 'drizzle-orm';
import {
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
