import { z } from 'zod';
import { FILTER_SLUG } from './games.ts';

/** How a smart filter orders its games (FR-LIB-9). */
export const SMART_FILTER_SORTS = ['title', 'year', 'lastPlayed', 'playCount', 'added'] as const;
export const SMART_FILTER_PLAYED = ['any', 'played', 'never'] as const;

const year = z.number().int().min(1950).max(2100);

/** A saved game query (FR-LIB-9). Missing games never match. */
export const SmartFilterQuerySchema = z
  .strictObject({
    /** Empty = every system. */
    systems: z.array(z.string().min(1).max(100)).max(500).default([]),
    favorite: z.literal(true).optional(),
    /** Any of these filter tags. */
    filters: z.array(z.string().regex(FILTER_SLUG)).min(1).max(30).optional(),
    /** Genre contains this text, ignoring case. */
    genre: z.string().trim().min(1).max(100).optional(),
    yearFrom: year.optional(),
    yearTo: year.optional(),
    minPlayers: z.number().int().min(1).max(16).optional(),
    played: z.enum(SMART_FILTER_PLAYED).default('any'),
    playedWithinDays: z.number().int().min(1).max(3650).optional(),
    sort: z.enum(SMART_FILTER_SORTS).default('title'),
    limit: z.number().int().min(1).max(10000).optional(),
  })
  .refine(
    (query) =>
      query.yearFrom === undefined || query.yearTo === undefined || query.yearFrom <= query.yearTo,
    { path: ['yearTo'], message: 'yearRange' },
  );

/** Names are unique ignoring case; the database enforces it. */
export const SmartFilterNameSchema = z.string().trim().min(1).max(100);

export const SmartFilterSummarySchema = z.object({
  id: z.number().int().positive(),
  name: z.string(),
  query: SmartFilterQuerySchema,
  /** Present games it matches now. */
  games: z.number().int().min(0),
});

export type SmartFilterSort = (typeof SMART_FILTER_SORTS)[number];
export type SmartFilterQuery = z.output<typeof SmartFilterQuerySchema>;
export type SmartFilterQueryInput = z.input<typeof SmartFilterQuerySchema>;
export type SmartFilterSummary = z.output<typeof SmartFilterSummarySchema>;
