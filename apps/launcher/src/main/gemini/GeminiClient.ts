import {
  AppErrorException,
  ERROR_CODES,
  GeminiSourceSchema,
  type GeminiField,
  type GeminiSettings,
  type GeminiSource,
} from '@nextlevel/shared';
import { buildPrompt, parseReply, responseSchema, type PromptGame } from './prompt.ts';

export const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta';

/** Per-minute limit waits before giving up as a network-style pause (daily limits never retry). */
const MAX_MINUTE_RETRIES = 3;
const DEFAULT_RETRY_MS = 10_000;

type GeminiCode =
  'GEMINI_NO_KEY' | 'GEMINI_KEY_REJECTED' | 'GEMINI_QUOTA' | 'GEMINI_NETWORK' | 'GEMINI_BAD_REPLY';

const fail = (code: GeminiCode, details?: unknown): never => {
  throw new AppErrorException({ code, message: ERROR_CODES[code], details });
};

export interface GeminiClientDeps {
  fetch: typeof fetch;
  /** The key from the secret store; null when not set. */
  key: () => Promise<string | null>;
  settings: () => GeminiSettings;
  sleep: (ms: number) => Promise<void>;
  /** e2e only: a local fake for GEMINI_API_URL. */
  baseUrl?: string;
}

export interface GeminiReply {
  /** The reply's JSON array, unchecked (checkAnswer runs per game). */
  items: unknown[];
  sources: GeminiSource[];
  /** Search grounding was on for this request. */
  grounded: boolean;
}

interface ApiError {
  error?: { message?: string; details?: Array<Record<string, unknown>> };
}

interface ApiReply {
  candidates?: Array<{
    content?: { parts?: Array<{ text?: string }> };
    groundingMetadata?: { groundingChunks?: Array<{ web?: { uri?: string; title?: string } }> };
  }>;
}

/** `"7s"` / `"1.5s"` → ms. */
function retryDelay(details: Array<Record<string, unknown>>): number {
  const info = details.find((detail) => String(detail['@type']).endsWith('RetryInfo'));
  const delay = typeof info?.retryDelay === 'string' ? info.retryDelay : '';
  const match = /^(\d+(?:\.\d+)?)s$/.exec(delay);
  return match ? Math.ceil(Number(match[1]) * 1000) : DEFAULT_RETRY_MS;
}

function isDaily(details: Array<Record<string, unknown>>): boolean {
  return details.some((detail) =>
    ((detail.violations as Array<{ quotaId?: string }> | undefined) ?? []).some((violation) =>
      /PerDay/i.test(violation.quotaId ?? ''),
    ),
  );
}

function sourcesOf(reply: ApiReply): GeminiSource[] {
  const seen = new Set<string>();
  const sources: GeminiSource[] = [];
  for (const chunk of reply.candidates?.[0]?.groundingMetadata?.groundingChunks ?? []) {
    const parsed = GeminiSourceSchema.safeParse({
      title: chunk.web?.title ?? '',
      url: chunk.web?.uri ?? '',
    });
    if (parsed.success && !seen.has(parsed.data.url)) {
      seen.add(parsed.data.url);
      sources.push(parsed.data);
    }
  }
  return sources;
}

/** The Gemini API over plain REST (FR-SCR-7): a free AI Studio key, no SDK. */
export class GeminiClient {
  constructor(private readonly deps: GeminiClientDeps) {}

  async ask(games: PromptGame[], fields: GeminiField[], language: string): Promise<GeminiReply> {
    const grounded = this.deps.settings().grounding;
    const generationConfig: Record<string, unknown> = { temperature: 0 };
    // Structured output and Search may not combine on every model: with Search the JSON is
    // asked for in the prompt and read with parseReply.
    if (!grounded) {
      generationConfig.responseMimeType = 'application/json';
      generationConfig.responseSchema = responseSchema(fields);
    }
    const reply = await this.generate({
      contents: [{ role: 'user', parts: [{ text: buildPrompt(games, fields, language) }] }],
      generationConfig,
      ...(grounded ? { tools: [{ google_search: {} }] } : {}),
    });
    const text = (reply.candidates?.[0]?.content?.parts ?? [])
      .map((part) => part.text ?? '')
      .join('');
    const items = parseReply(text) ?? fail('GEMINI_BAD_REPLY');
    return { items, sources: grounded ? sourcesOf(reply) : [], grounded };
  }

  /** One tiny request: the key and model work. */
  async test(): Promise<void> {
    await this.generate({
      contents: [{ role: 'user', parts: [{ text: 'Reply with OK.' }] }],
      generationConfig: { temperature: 0, maxOutputTokens: 5 },
    });
  }

  private async generate(body: object): Promise<ApiReply> {
    const key = (await this.deps.key()) ?? fail('GEMINI_NO_KEY');
    const url = `${this.deps.baseUrl ?? GEMINI_API_URL}/models/${this.deps.settings().model}:generateContent`;
    for (let attempt = 0; ; attempt += 1) {
      let response: Response;
      try {
        response = await this.deps.fetch(url, {
          method: 'POST',
          headers: { 'content-type': 'application/json', 'x-goog-api-key': key },
          body: JSON.stringify(body),
        });
      } catch {
        return fail('GEMINI_NETWORK');
      }
      if (response.ok) return (await response.json().catch(() => ({}))) as ApiReply;
      const error = (await response.json().catch(() => ({}))) as ApiError;
      const details = error.error?.details ?? [];
      if (response.status === 429) {
        if (isDaily(details)) return fail('GEMINI_QUOTA');
        if (attempt >= MAX_MINUTE_RETRIES) return fail('GEMINI_NETWORK', { status: 429 });
        await this.deps.sleep(retryDelay(details));
        continue;
      }
      if ([400, 401, 403, 404].includes(response.status)) {
        return fail('GEMINI_KEY_REJECTED', { status: response.status });
      }
      return fail('GEMINI_NETWORK', { status: response.status });
    }
  }
}
