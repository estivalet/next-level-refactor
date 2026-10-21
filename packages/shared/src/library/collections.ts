import { z } from 'zod';

/** How a collection orders its games (FR-LIB-8). */
export const COLLECTION_SORTS = ['manual', 'title', 'year'] as const;

/** Names are unique ignoring case; the database enforces it. */
export const CollectionNameSchema = z.string().trim().min(1).max(100);

export const CollectionSummarySchema = z.object({
  id: z.number().int().positive(),
  name: z.string(),
  sort: z.enum(COLLECTION_SORTS),
  games: z.number().int().min(0),
});

export type CollectionSort = (typeof COLLECTION_SORTS)[number];
export type CollectionSummary = z.output<typeof CollectionSummarySchema>;
