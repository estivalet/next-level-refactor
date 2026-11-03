import { z } from 'zod';
import { ScrapeApplyResultSchema } from '../scraper/apply.ts';
import {
  GeminiApplyInputSchema,
  GeminiDialogViewSchema,
  GeminiKeyStatusSchema,
} from '../scraper/gemini.ts';

const gameInput = z.strictObject({ gameId: z.number().int().positive() });

/** Gemini fill channels (FR-SCR-7). */
export const geminiContract = {
  'gemini.key.status': { input: z.void(), output: GeminiKeyStatusSchema },
  /** null removes the key. */
  'gemini.key.set': {
    input: z.strictObject({ apiKey: z.string().trim().min(10).max(200).nullable() }),
    output: GeminiKeyStatusSchema,
  },
  /** One tiny request with the stored key and model. */
  'gemini.test': { input: z.void(), output: z.object({ ok: z.literal(true) }) },
  /** Asks Gemini about the game's empty fields (all six with `allFields`) and stores the answer. */
  'gemini.ask': {
    input: z.strictObject({
      gameId: z.number().int().positive(),
      allFields: z.boolean().optional(),
    }),
    output: GeminiDialogViewSchema,
  },
  /** The stored answer (Needs review), without a new request; null when there is none. */
  'gemini.stored': { input: gameInput, output: GeminiDialogViewSchema.nullable() },
  'gemini.apply': { input: GeminiApplyInputSchema, output: ScrapeApplyResultSchema },
  'gemini.dismiss': { input: gameInput, output: z.void() },
} as const;
