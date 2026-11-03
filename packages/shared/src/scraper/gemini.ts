import { z } from 'zod';
import { ScrapeFieldSchema } from './schema.ts';

// Gemini fills missing game details (FR-SCR-7): unknown stays unknown.

export {
  GEMINI_DEFAULT_MODEL,
  GeminiSettingsSchema,
  type GeminiSettings,
} from './geminiSettings.ts';

/** Details Gemini may fill; never rating or art, and the title only as a suggestion. */
export const GEMINI_FIELDS = [
  'description',
  'year',
  'developer',
  'publisher',
  'genre',
  'players',
] as const;
export type GeminiField = (typeof GEMINI_FIELDS)[number];
export const GeminiFieldSchema = z.enum(GEMINI_FIELDS);

const gameId = z.number().int().positive();
const value = z.union([z.string(), z.number()]);

/** One checked field: `value` is null whenever Gemini didn't know (or the checks dropped it). */
export const GeminiFieldAnswerSchema = z.object({
  known: z.boolean(),
  value: value.nullable(),
});
export type GeminiFieldAnswer = z.output<typeof GeminiFieldAnswerSchema>;

export const GeminiSourceSchema = z.object({
  title: z.string().max(300),
  url: z.url({ protocol: /^https$/ }).max(2000),
});
export type GeminiSource = z.output<typeof GeminiSourceSchema>;

export const GeminiRouteSchema = z.enum(['api', 'web']);
export type GeminiRoute = z.output<typeof GeminiRouteSchema>;

/** A checked answer for one game, kept until applied or dismissed (Needs review). */
export const GeminiAnswerSchema = z.object({
  gameId,
  route: GeminiRouteSchema,
  fields: z.partialRecord(GeminiFieldSchema, GeminiFieldAnswerSchema),
  /** A suggested official title; null when none (or the same as the current one). */
  title: z.string().max(300).nullable(),
  sources: z.array(GeminiSourceSchema).max(20),
  /** Whether Search grounding was on for this request (Auto-update leans on sources then). */
  grounded: z.boolean().default(false),
  askedAt: z.string(),
});
export type GeminiAnswer = z.output<typeof GeminiAnswerSchema>;

/** The dialog's rows: the current value and Gemini's checked one (null = doesn't know). */
const fieldView = z.object({
  current: value.nullable(),
  scraped: value.nullable(),
  locked: z.boolean(),
});
export const GeminiDialogViewSchema = z.object({
  answer: GeminiAnswerSchema,
  fields: z.partialRecord(z.enum([...GEMINI_FIELDS, 'title']), fieldView),
});
export type GeminiDialogView = z.output<typeof GeminiDialogViewSchema>;

export const GeminiKeyStatusSchema = z.object({
  /** The OS secret store works. */
  available: z.boolean(),
  set: z.boolean(),
});
export type GeminiKeyStatus = z.output<typeof GeminiKeyStatusSchema>;

export const GeminiBatchRulesSchema = z.strictObject({
  fields: z.array(GeminiFieldSchema).min(1).max(GEMINI_FIELDS.length),
  mode: z.enum(['review', 'auto']),
  route: GeminiRouteSchema,
});
export type GeminiBatchRules = z.output<typeof GeminiBatchRulesSchema>;

/** Fields the dialog may apply: the six, plus the title the user ticked. */
export const GeminiApplyInputSchema = z.strictObject({
  gameId,
  fields: z
    .array(ScrapeFieldSchema.extract([...GEMINI_FIELDS, 'title']))
    .max(GEMINI_FIELDS.length + 1),
});

/** `<data>\gemini\jobs\<id>\request.json`, read by tools/gemini-web (never holds a key). */
export const GeminiWebRequestSchema = z.strictObject({
  jobId: z.number().int().positive(),
  fields: z.array(GeminiFieldSchema).min(1),
  /** The description's language, as a name ("English", "Brazilian Portuguese"). */
  language: z.string().min(1).max(60),
  games: z.array(
    z.strictObject({
      gameId,
      system: z.string(),
      title: z.string(),
      file: z.string(),
      known: z.partialRecord(GeminiFieldSchema, value),
    }),
  ),
});
export type GeminiWebRequest = z.output<typeof GeminiWebRequestSchema>;

/** One line of `results.jsonl`: Gemini's raw reply for one prompt's games; main runs the checks. */
export const GeminiWebResultLineSchema = z.object({
  gameIds: z.array(gameId).min(1).max(50),
  reply: z.string().max(100_000),
});
export type GeminiWebResultLine = z.output<typeof GeminiWebResultLineSchema>;
