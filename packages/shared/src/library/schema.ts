import { z } from 'zod';

const count = z.number().int().min(0);

/** One system's outcome in a scan; `missing` counts games that went missing in this scan. */
export const ScanSystemResultSchema = z.object({
  systemId: z.string(),
  present: count,
  added: count,
  moved: count,
  restored: count,
  missing: count,
});

export const ScanProgressSchema = z.object({
  scanId: z.string(),
  systemsDone: count,
  systemsTotal: count,
  systemId: z.string().nullable(),
  filesSeen: count,
});

export const ScanSummarySchema = z.object({
  scanId: z.string(),
  startedAt: z.string(),
  finishedAt: z.string(),
  outcome: z.enum(['completed', 'cancelled', 'failed']),
  systems: z.array(ScanSystemResultSchema),
  /** Systems the scan turned on because games were found and the user never set them. */
  enabledSystemIds: z.array(z.string()),
  /** False when the scan only looked for files of games already listed (an import's scan). */
  addNew: z.boolean().optional(),
});

export const ScanStatusSchema = z.object({
  running: z.boolean(),
  progress: ScanProgressSchema.nullable(),
  last: ScanSummarySchema.nullable(),
});

/** A catalog system with its library counts; `games` includes the missing ones. */
export const SystemSummarySchema = z.object({
  id: z.string(),
  enabled: z.boolean(),
  games: count,
  missing: count,
  /** Games whose last scrape asked for review (FR-SCR-2). */
  review: count,
});

export type ScanSystemResult = z.output<typeof ScanSystemResultSchema>;
export type ScanProgress = z.output<typeof ScanProgressSchema>;
export type ScanSummary = z.output<typeof ScanSummarySchema>;
export type ScanStatus = z.output<typeof ScanStatusSchema>;
export type SystemSummary = z.output<typeof SystemSummarySchema>;
