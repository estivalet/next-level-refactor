import { z } from 'zod';
import { MenuTitleSchema } from './menus/schema.ts';

// Settings sync (FR-SET-5, D55): one document per kind and account, with a revision the server
// bumps on every write. The server stamps `updatedAt`, so a launcher's clock never decides.

export const SYNC_KINDS = ['settings', 'menus', 'collections', 'userState'] as const;
export type SyncKind = (typeof SYNC_KINDS)[number];

/** The most a document may weigh as JSON (the PUT body limit). */
export const SYNC_MAX_BYTES = 5 * 1024 * 1024;

export const SyncDocumentSchema = z.object({
  /** 0 when the kind was never written. */
  revision: z.number().int().min(0),
  data: z.unknown(),
  updatedAt: z.iso.datetime().nullable(),
});
export type SyncDocument = z.output<typeof SyncDocumentSchema>;

export const SyncPutRequestSchema = z.strictObject({
  /** The revision this write is based on; a newer one on the server → 409 with its copy. */
  baseRevision: z.number().int().min(0),
  /** Required and never null: null is what Delete synced data leaves behind. */
  data: z.unknown().refine((value) => value !== null && value !== undefined, {
    message: 'data is required',
  }),
});

export const SyncPutResponseSchema = z.object({
  revision: z.number().int().min(1),
  updatedAt: z.iso.datetime(),
});

/** Tombstones older than this are dropped when documents merge (D55). */
export const SYNC_TOMBSTONE_DAYS = 90;

/**
 * One synced value (D55). Entries merge one by one: the newer `updatedAt` wins, equal stamps take
 * the server's copy. `deleted` marks a tombstone (its value is null).
 */
export const SyncEntrySchema = z.object({
  value: z.unknown(),
  updatedAt: z.iso.datetime(),
  deleted: z.literal(true).optional(),
});
export type SyncEntry = z.output<typeof SyncEntrySchema>;

/** What a launcher stores as a sync document's `data`. */
export const SyncDataSchema = z.object({
  v: z.literal(1),
  entries: z.record(z.string().min(1).max(2048), SyncEntrySchema),
});
export type SyncData = z.output<typeof SyncDataSchema>;
export type SyncEntries = SyncData['entries'];

/**
 * The settings that follow the account (D55), as dotted paths into Settings. Never paths,
 * storage, emulators, profiles, per-system settings, secrets, kiosk or sync itself.
 */
export const SYNC_SETTINGS_KEYS = [
  'general.language',
  'themes.activeDefault',
  'themes.entries',
  'themes.sound',
  'input',
  'scraper.regionPriority',
  'scraper.languagePriority',
  'scraper.artKinds',
  'scraper.fields',
  'scraper.gemini.model',
  'scraper.gemini.grounding',
] as const;
export type SyncSettingsKey = (typeof SYNC_SETTINGS_KEYS)[number];

// Entry values per document (D55). Keys: `userState` — `g:<gameKey>` flags and
// `p:<deviceKey>|<gameKey>` one PC's play counter; `collections` — `c:<syncId>` a collection,
// `m:<syncId>|<gameKey>` a member, `f:<syncId>` a smart filter; `menus` — `menu:<id>` or
// `menu:s:<source>` (an imported menu), and `active`. A game key is `catalog:<itemId>` for a
// catalog game, else `<systemId>/<path inside its storage location, lowercase, '/'-separated>`.

export const SyncFlagsSchema = z.object({
  favorite: z.boolean(),
  hidden: z.boolean(),
  completed: z.boolean(),
  userRating: z.number().int().min(1).max(5).nullable(),
});
export type SyncFlags = z.output<typeof SyncFlagsSchema>;

export const SyncPlaysSchema = z.object({
  count: z.number().int().min(0),
  seconds: z.number().int().min(0),
  lastPlayedAt: z.iso.datetime().nullable(),
});
export type SyncPlays = z.output<typeof SyncPlaysSchema>;

export const SyncCollectionSchema = z.object({
  name: z.string().trim().min(1).max(200),
  sort: z.enum(['manual', 'title', 'year']),
});
export type SyncCollection = z.output<typeof SyncCollectionSchema>;

export const SyncMemberSchema = z.object({ position: z.number() });

export const SyncSmartFilterSchema = z.object({
  name: z.string().trim().min(1).max(200),
  query: z.unknown(),
});

/**
 * A menu as synced: its nodes as stored, except that collection and smart filter nodes name
 * their target by sync id (checked against MenuDraftSchema once translated back).
 */
export const SyncMenuSchema = z.object({
  /** Null for an imported menu: each PC that imported it has its own id for it. */
  id: z.uuid().nullable(),
  title: MenuTitleSchema,
  source: z.string().min(1).max(500).nullable(),
  nodes: z.array(z.unknown()),
});
export type SyncMenu = z.output<typeof SyncMenuSchema>;

/** What a launcher last merged for one kind: its document, the revision, the games it had. */
export const SyncKindStateSchema = z.object({
  revision: z.number().int().min(0),
  entries: SyncDataSchema.shape.entries,
  /** Game keys this PC had at that sync (a game found since takes the document's state). */
  held: z.array(z.string()),
});
export type SyncKindState = z.output<typeof SyncKindStateSchema>;

/** `<data>\sync.json`: this PC's sync progress for the signed-in account. */
export const SyncStoreSchema = z.object({
  v: z.literal(1),
  userId: z.string().nullable(),
  lastSync: z.iso.datetime().nullable(),
  kinds: z.partialRecord(z.enum(SYNC_KINDS), SyncKindStateSchema),
});
export type SyncStore = z.output<typeof SyncStoreSchema>;
