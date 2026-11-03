import { z } from 'zod';

// LaunchBox Games Database as a second scraper (FR-SCR-6): its public database download,
// indexed locally in `<data>\launchbox\`.

/** The local LaunchBox index: missing until downloaded; `progress` 0–1 while working. */
export const LaunchBoxStatusSchema = z.object({
  state: z.enum(['missing', 'downloading', 'building', 'ready', 'failed']),
  /** When the index in use was built (ISO); null without one. */
  builtAt: z.string().nullable(),
  games: z.number().int().min(0),
  progress: z.number().min(0).max(1).nullable(),
  /** i18n key of the last failure (a previous index may still be in use). */
  error: z.string().nullable(),
});

export type LaunchBoxStatus = z.output<typeof LaunchBoxStatusSchema>;
