import { z } from 'zod';
import { GameArtKindSchema, ScrapeFieldSchema } from './schema.ts';

// Batch scrape (FR-SCR-2, US-C6, D18): one job at a time, persisted in `scrape_jobs`, one game
// after another; it survives a restart and pauses on quota, network loss or bad credentials.

const count = z.number().int().min(0);

/** Batch never offers `title` (D19). */
export const BatchFieldSchema = ScrapeFieldSchema.exclude(['title']);

export const BatchRulesSchema = z.strictObject({
  /** Skip art kinds the game has and fields that hold a value. */
  onlyMissing: z.boolean(),
  kinds: z.array(GameArtKindSchema).max(20),
  fields: z.array(BatchFieldSchema).max(20),
  regions: z
    .array(z.string().regex(/^[a-z]{2,4}$/))
    .min(1)
    .max(10),
});

export const BatchScopeSchema = z.union([
  z.strictObject({ systemIds: z.array(z.string().min(1).max(80)).min(1).max(500) }),
  z.strictObject({ gameIds: z.array(z.number().int().positive()).min(1).max(50_000) }),
]);

/**
 * `media`: art could not be saved for several games in a row (unwritable or unplugged folder);
 * `error`: something unexpected (e.g. the library could not be written); see the log.
 */
export const BATCH_PAUSE_REASONS = [
  'quota',
  'network',
  'credentials',
  'user',
  'media',
  'error',
] as const;

export const BatchStatusSchema = z.object({
  jobId: z.number().int().positive().nullable(),
  state: z.enum(['idle', 'running', 'paused', 'finished']),
  pausedReason: z.enum(BATCH_PAUSE_REASONS).nullable(),
  /** When a quota pause resumes on its own (ISO time). */
  resumeAt: z.string().nullable(),
  total: count,
  done: count,
  applied: count,
  review: count,
  notFound: count,
  failed: count,
  current: z.object({ gameId: z.number().int().positive(), title: z.string() }).nullable(),
});

export const IDLE_BATCH: BatchStatus = {
  jobId: null,
  state: 'idle',
  pausedReason: null,
  resumeAt: null,
  total: 0,
  done: 0,
  applied: 0,
  review: 0,
  notFound: 0,
  failed: 0,
  current: null,
};

export type BatchField = z.output<typeof BatchFieldSchema>;
export type BatchRules = z.output<typeof BatchRulesSchema>;
export type BatchScope = z.output<typeof BatchScopeSchema>;
export type BatchPauseReason = (typeof BATCH_PAUSE_REASONS)[number];
export type BatchStatus = z.output<typeof BatchStatusSchema>;
