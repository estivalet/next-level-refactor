import { z } from 'zod';
import { FILTER_SLUG, GAME_SORTS, GAME_TABS, GameScopeSchema } from './games.ts';

/** File formats a game list exports to (FR-LIB-11). */
export const EXPORT_FORMATS = ['csv', 'json', 'gamelistXml'] as const;

/** Fields the user can pick for an export, in the order they are written. */
export const EXPORT_FIELDS = [
  'title',
  'system',
  'year',
  'genre',
  'players',
  'developer',
  'publisher',
  'region',
  'description',
  'rating',
  'userRating',
  'favorite',
  'completed',
  'hidden',
  'missing',
  'path',
  'playCount',
  'lastPlayed',
  'added',
  'filters',
] as const;

export type ExportFormat = (typeof EXPORT_FORMATS)[number];
export type ExportField = (typeof EXPORT_FIELDS)[number];

/**
 * The EmulationStation `gamelist.xml` tag of each field it has one for (ES-DE / RetroBat names);
 * the other fields are left out of that format. `path` is always written: ES needs it.
 */
export const GAMELIST_XML_TAGS: Partial<Record<ExportField, string>> = {
  path: 'path',
  title: 'name',
  description: 'desc',
  rating: 'rating',
  year: 'releasedate',
  developer: 'developer',
  publisher: 'publisher',
  genre: 'genre',
  players: 'players',
  region: 'region',
  favorite: 'favorite',
  hidden: 'hidden',
  completed: 'completed',
  playCount: 'playcount',
  lastPlayed: 'lastplayed',
};

/** Fields every export has, whatever the user picked. */
export const REQUIRED_EXPORT_FIELDS: Record<ExportFormat, readonly ExportField[]> = {
  csv: ['title'],
  json: ['title'],
  gamelistXml: ['title', 'path'],
};

/** What the dialog starts with: the usual columns, no long text (description). */
export const DEFAULT_EXPORT_FIELDS: readonly ExportField[] = [
  'title',
  'system',
  'year',
  'genre',
  'players',
  'developer',
  'publisher',
  'rating',
  'userRating',
  'favorite',
  'completed',
  'path',
];

/** The list as shown on screen: its tab, sort and narrowing (null = every game of the scope). */
export const ExportViewSchema = z.strictObject({
  tab: z.enum(GAME_TABS),
  sort: z.enum(GAME_SORTS).optional(),
  filter: z.string().regex(FILTER_SLUG).optional(),
  genre: z.string().max(200).optional(),
});

export const GameExportRequestSchema = z.strictObject({
  scope: GameScopeSchema,
  view: ExportViewSchema.nullable(),
  format: z.enum(EXPORT_FORMATS),
  fields: z
    .array(z.enum(EXPORT_FIELDS))
    .min(1)
    .max(EXPORT_FIELDS.length)
    .refine((fields) => new Set(fields).size === fields.length, { message: 'duplicate' }),
  /** The scope's name as shown: the suggested file name and the JSON header. */
  title: z.string().trim().min(1).max(200),
});

export const GameExportResultSchema = z.discriminatedUnion('status', [
  z.object({ status: z.literal('cancelled') }),
  z.object({ status: z.literal('saved'), count: z.number().int().min(0) }),
]);

export type ExportView = z.output<typeof ExportViewSchema>;
export type GameExportRequest = z.output<typeof GameExportRequestSchema>;
export type GameExportResult = z.output<typeof GameExportResultSchema>;

/** The fields written for a request: required ones added, unsupported ones dropped, in order. */
export function exportedFields(
  format: ExportFormat,
  picked: readonly ExportField[],
): ExportField[] {
  const wanted = new Set([...picked, ...REQUIRED_EXPORT_FIELDS[format]]);
  return EXPORT_FIELDS.filter(
    (field) =>
      wanted.has(field) && (format !== 'gamelistXml' || GAMELIST_XML_TAGS[field] !== undefined),
  );
}
