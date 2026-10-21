import { sql } from 'drizzle-orm';
import {
  customType,
  index,
  integer,
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
    uniqueIndex('games_system_rel_path').on(table.systemId, table.relPath),
    index('games_system').on(table.systemId),
  ],
);

export const gameMetadata = sqliteTable('game_metadata', {
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
});
