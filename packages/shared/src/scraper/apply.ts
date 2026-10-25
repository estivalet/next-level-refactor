import { z } from 'zod';
import { GameDetailsSchema } from '../library/games.ts';
import { GameArtKindSchema, ScrapeFieldSchema } from './schema.ts';

// Single-game scrape requests (FR-SCR-1, US-C5). Kept apart from schema.ts because the result
// carries GameDetails, whose schema already imports the scrape status from there.

const id = z.number().int().positive();

export const ScrapeSearchInputSchema = z.strictObject({
  gameId: id,
  /** A typed title: search by title only (no hash). */
  title: z.string().trim().min(1).max(300).optional(),
  /** Bypass the response cache ("Search again"). */
  refresh: z.boolean().optional(),
});

export const ScrapePreviewInputSchema = z.strictObject({ gameId: id, providerGameId: id });

export const ScrapeApplyInputSchema = z.strictObject({
  gameId: id,
  providerGameId: id,
  kinds: z.array(GameArtKindSchema).max(20),
  /** Ticked fields; a locked one is written on purpose and stays locked (D19). */
  fields: z.array(ScrapeFieldSchema).max(20),
});

export const SCRAPE_FAILURES = ['notAvailable', 'download', 'write'] as const;

export const ScrapeApplyResultSchema = z.object({
  written: z.array(GameArtKindSchema),
  failed: z.array(z.object({ kind: GameArtKindSchema, code: z.enum(SCRAPE_FAILURES) })),
  game: GameDetailsSchema,
});

export const ScraperSystemSchema = z.object({ id, name: z.string() });

export type ScrapeSearchInput = z.output<typeof ScrapeSearchInputSchema>;
export type ScrapePreviewInput = z.output<typeof ScrapePreviewInputSchema>;
export type ScrapeApplyInput = z.output<typeof ScrapeApplyInputSchema>;
export type ScrapeApplyResult = z.output<typeof ScrapeApplyResultSchema>;
export type ScrapeFailure = (typeof SCRAPE_FAILURES)[number];
export type ScraperSystem = z.output<typeof ScraperSystemSchema>;
