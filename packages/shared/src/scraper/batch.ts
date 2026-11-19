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
  /** FR-SCR-6: after ScreenScraper, fill what is still missing from LaunchBox. */
  launchbox: z.boolean().default(false),
});

export const BatchScopeSchema = z.union([
  z.strictObject({ systemIds: z.array(z.string().min(1).max(80)).min(1).max(500) }),
  z.strictObject({ gameIds: z.array(z.number().int().positive()).min(1).max(50_000) }),
]);

/**
 * `media`: art could not be saved for several games in a row (unwritable or unplugged folder);
 * `error`: something unexpected (e.g. the library could not be written); see the log;
 * `launchbox`: Then fill from LaunchBox is on but the LaunchBox database isn't downloaded;
 * `gemini-quota`: Gemini's free daily limit is used up (resumes at the next reset, FR-SCR-7);
 * `webTool`: the Gemini website tool could not start or stopped (FR-SCR-7).
 */
export const BATCH_PAUSE_REASONS = [
  'quota',
  'network',
  'credentials',
  'user',
  'media',
  'error',
  'launchbox',
  'gemini-quota',
  'webTool',
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
  /** Games LaunchBox wrote to (FR-SCR-6), part of `applied`. */
  launchbox: count,
  current: z.object({ gameId: z.number().int().positive(), title: z.string() }).nullable(),
  /** The systems a system-scope job covers (Show Needs review opens them); null for a selection. */
  systemIds: z.array(z.string()).nullable(),
  /** FR-SCR-8: when the job was started (ISO time); absent for the Gemini batch. */
  startedAt: z.string().optional(),
  /** FR-SCR-8: when this launch picked the job up from the last session (ISO), else null. */
  resumedAt: z.string().nullable().optional(),
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
  launchbox: 0,
  current: null,
  systemIds: null,
};

/** FR-SCR-8: what a batch did with one game; `skipped` = it needed nothing the rules fill. */
export const BATCH_ITEM_OUTCOMES = ['applied', 'review', 'notFound', 'failed', 'skipped'] as const;
const OutcomeSchema = z.enum(BATCH_ITEM_OUTCOMES);

/** One game a batch job handled (FR-SCR-8, `scrape_job_items`). */
export const BatchJobItemSchema = z.object({
  gameId: z.number().int().positive(),
  title: z.string(),
  systemId: z.string(),
  outcome: OutcomeSchema,
  provider: z.enum(['screenscraper', 'launchbox']).nullable(),
  /** Error code of a failed game. */
  error: z.string().nullable(),
  handledAt: z.string(),
});

const ItemsCursorSchema = z.strictObject({
  handledAt: z.string().max(40),
  gameId: z.number().int().positive(),
});

/** A page of the current job's games, newest first (FR-SCR-8). */
export const BatchItemsInputSchema = z.strictObject({
  outcome: OutcomeSchema.optional(),
  cursor: ItemsCursorSchema.optional(),
  limit: z.number().int().min(1).max(200).default(100),
});

export const BatchItemsPageSchema = z.object({
  items: z.array(BatchJobItemSchema),
  next: ItemsCursorSchema.nullable(),
});

/** The current job with what it was told to do (FR-SCR-8); `listed` = games in its item list. */
export const BatchJobDetailsSchema = z.object({
  status: BatchStatusSchema,
  scope: BatchScopeSchema,
  rules: BatchRulesSchema,
  startedAt: z.string(),
  listed: count,
});

export type BatchItemOutcome = (typeof BATCH_ITEM_OUTCOMES)[number];
export type BatchJobItem = z.output<typeof BatchJobItemSchema>;
export type BatchItemsInput = z.output<typeof BatchItemsInputSchema>;
export type BatchItemsPage = z.output<typeof BatchItemsPageSchema>;
export type BatchJobDetails = z.output<typeof BatchJobDetailsSchema>;
export type BatchField = z.output<typeof BatchFieldSchema>;
export type BatchRules = z.output<typeof BatchRulesSchema>;
export type BatchScope = z.output<typeof BatchScopeSchema>;
export type BatchPauseReason = (typeof BATCH_PAUSE_REASONS)[number];
export type BatchStatus = z.output<typeof BatchStatusSchema>;
