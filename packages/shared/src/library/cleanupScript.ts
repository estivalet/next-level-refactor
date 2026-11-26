import { z } from 'zod';
import { GameScopeSchema } from './games.ts';

/**
 * FR-LIB-20: the Delete later tab's cleanup script. The launcher only writes the script; the
 * owner reviews and runs it.
 */
export const CleanupScriptRequestSchema = z.strictObject({
  scope: GameScopeSchema,
  /** The scope's name as shown: the suggested file name and the script header. */
  title: z.string().trim().min(1).max(200),
});

export const CleanupScriptResultSchema = z.discriminatedUnion('status', [
  z.object({ status: z.literal('cancelled') }),
  z.object({
    status: z.literal('saved'),
    games: z.number().int().min(0),
    files: z.number().int().min(0),
  }),
]);

export type CleanupScriptRequest = z.output<typeof CleanupScriptRequestSchema>;
export type CleanupScriptResult = z.output<typeof CleanupScriptResultSchema>;
