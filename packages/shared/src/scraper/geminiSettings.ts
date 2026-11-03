import { z } from 'zod';

// Settings → Scraper → Gemini (FR-SCR-7). Kept apart from gemini.ts so schema.ts can use it
// without an import cycle (gemini.ts builds on schema.ts).

/**
 * A free-tier Flash model (Google AI Studio, checked 2026-11-03 from public guides; the Settings
 * field lets the user pick another, and Test reports an unknown model).
 */
export const GEMINI_DEFAULT_MODEL = 'gemini-3.6-flash';

const path = z.string().trim().max(1000);

export const GeminiSettingsSchema = z.object({
  model: z
    .string()
    .trim()
    .regex(/^[a-z0-9][a-z0-9.-]{1,80}$/)
    .default(GEMINI_DEFAULT_MODEL),
  /** Ask Gemini to check its answers with Google Search, when the free tier allows it. */
  grounding: z.boolean().default(true),
  /** The Selenium website tool (personal fallback); empty = not set up. */
  webTool: z
    .object({
      python: path.default(''),
      firefoxProfile: path.default(''),
      /** geckodriver.exe; empty = the one next to the tool. */
      driver: path.default(''),
    })
    .prefault({}),
});

export type GeminiSettings = z.output<typeof GeminiSettingsSchema>;
