import { z } from 'zod';
import { ScrapeStatusSchema } from '../scraper/schema.ts';

const id = z.number().int().positive();
const count = z.number().int().min(0);

/**
 * Game list tabs: All leaves hidden games out; Hidden is the only place they show (US-C4);
 * Needs review lists games a batch scrape could not match on its own (FR-SCR-2, D18).
 */
export const GAME_TABS = ['all', 'favorites', 'hidden', 'missing', 'needsReview'] as const;
/** Orders of a system's game list; a collection uses its own `sort`. */
export const GAME_SORTS = ['title', 'year', 'rating', 'added'] as const;

export const GameScopeSchema = z.discriminatedUnion('kind', [
  z.strictObject({ kind: z.literal('system'), systemId: z.string().min(1) }),
  z.strictObject({ kind: z.literal('collection'), collectionId: id }),
  z.strictObject({ kind: z.literal('smartFilter'), smartFilterId: id }),
]);

export const GameListQuerySchema = z.strictObject({
  scope: GameScopeSchema,
  tab: z.enum(GAME_TABS).default('all'),
  sort: z.enum(GAME_SORTS).optional(),
  /** In-list filter, matched like global search but within the scope. */
  text: z.string().max(200).optional(),
  offset: count,
  limit: z.number().int().min(1).max(1000),
});

/** One line of a game list; `expectedPath` is only set for missing games (FR-LIB-4). */
export const GameRowSchema = z.object({
  id,
  systemId: z.string(),
  title: z.string(),
  year: z.number().int().nullable(),
  genre: z.string().nullable(),
  players: z.string().nullable(),
  favorite: z.boolean(),
  hidden: z.boolean(),
  userRating: z.number().int().min(1).max(5).nullable(),
  missing: z.boolean(),
  expectedPath: z.string().nullable(),
});

export const GameListPageSchema = z.object({
  total: count,
  offset: count,
  games: z.array(GameRowSchema),
});

export const GameDetailsSchema = GameRowSchema.extend({
  relPath: z.string(),
  discGroup: z.string().nullable(),
  missingSince: z.string().nullable(),
  addedAt: z.string(),
  developer: z.string().nullable(),
  publisher: z.string().nullable(),
  description: z.string().nullable(),
  region: z.string().nullable(),
  /** Community rating from a scrape (0..5, one decimal); the user's own is `userRating`. */
  rating: z.number().nullable(),
  filters: z.array(z.string()),
  /** Fields the user edited; scrapes never overwrite them (FR-LIB-6). */
  lockedFields: z.array(z.string()),
  playCount: count,
  lastPlayedAt: z.string().nullable(),
  collectionIds: z.array(id),
  /** The last scrape (FR-SCR-5); null = never scraped. */
  scrape: ScrapeStatusSchema.nullable(),
  /** Indexed media kinds → file version, for `mediaUrl` (FR-SCR-5). */
  media: z.record(z.string(), z.number().int().min(0)),
});

/** Metadata the user can edit in the Library (FR-LIB-6). */
export const EDITABLE_FIELDS = [
  'title',
  'year',
  'developer',
  'publisher',
  'genre',
  'players',
  'description',
  'region',
  'filters',
] as const;

export type EditableField = (typeof EDITABLE_FIELDS)[number];

/** Trimmed optional text; empty becomes null. */
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .nullable()
    .transform((value) => (value ? value : null));

export const FILTER_SLUG = /^[a-z0-9-]{1,40}$/;

export const MetadataChangesSchema = z
  .strictObject({
    title: z.string().trim().min(1).max(300),
    year: z.number().int().min(1950).max(2100).nullable(),
    developer: optionalText(200),
    publisher: optionalText(200),
    genre: optionalText(200),
    players: optionalText(200),
    description: optionalText(20000),
    region: optionalText(200),
    filters: z.array(z.string().regex(FILTER_SLUG)).max(30),
  })
  .partial()
  .refine((changes) => Object.keys(changes).length > 0, { message: 'empty' });

export const GameFlagsSchema = z
  .strictObject({
    favorite: z.boolean(),
    hidden: z.boolean(),
    userRating: z.number().int().min(1).max(5).nullable(),
  })
  .partial()
  .refine((flags) => Object.keys(flags).length > 0, { message: 'empty' });

export const GameIdsSchema = z.array(id).min(1).max(10000);

export const SearchResultSchema = z.object({
  games: z.array(GameRowSchema),
  /** More games matched than were returned. */
  more: z.boolean(),
});

export type GameTab = (typeof GAME_TABS)[number];
export type GameSort = (typeof GAME_SORTS)[number];
export type GameScope = z.output<typeof GameScopeSchema>;
export type GameListQuery = z.output<typeof GameListQuerySchema>;
export type GameRow = z.output<typeof GameRowSchema>;
export type GameListPage = z.output<typeof GameListPageSchema>;
export type GameDetails = z.output<typeof GameDetailsSchema>;
export type MetadataChanges = z.output<typeof MetadataChangesSchema>;
export type GameFlags = z.output<typeof GameFlagsSchema>;
export type SearchResult = z.output<typeof SearchResultSchema>;
