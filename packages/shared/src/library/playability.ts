import { z } from 'zod';

/** Whether a game plays well here (FR-LIB-13); replaces NextLevelOS's per-game `tests`. */
export const PLAYABILITY_MARKS = ['works', 'issues', 'broken'] as const;
export const PLAYABILITY_NOTE_MAX = 500;

export const PlayabilityMarkSchema = z.enum(PLAYABILITY_MARKS);

/** A game's mark, its note ('' = none) and when it was set (ISO). */
export const PlayabilitySchema = z.object({
  mark: PlayabilityMarkSchema,
  note: z.string(),
  at: z.string(),
});

/**
 * Sets the mark (date = now) or clears mark, note and date (`mark: null`). Without `note` a game
 * keeps the note it has, so marking several games at once leaves their notes alone.
 */
export const PlayabilityChangeSchema = z.strictObject({
  mark: PlayabilityMarkSchema.nullable(),
  note: z.string().trim().max(PLAYABILITY_NOTE_MAX).optional(),
});

export type PlayabilityMark = z.output<typeof PlayabilityMarkSchema>;
export type Playability = z.output<typeof PlayabilitySchema>;
export type PlayabilityChange = z.output<typeof PlayabilityChangeSchema>;
