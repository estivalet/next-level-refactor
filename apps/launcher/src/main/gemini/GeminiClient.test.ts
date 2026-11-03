import { AppErrorException, GeminiSettingsSchema, type GeminiSettings } from '@nextlevel/shared';
import { describe, expect, it } from 'vitest';
import { GEMINI_API_URL, GeminiClient } from './GeminiClient.ts';
import type { PromptGame } from './prompt.ts';

const game: PromptGame = {
  gameId: 7,
  system: 'Coleco Telstar',
  title: 'Tennis',
  file: 't',
  known: {},
};

const reply = (text: string, chunks: Array<{ uri: string; title: string }> = []) =>
  new Response(
    JSON.stringify({
      candidates: [
        {
          content: { parts: [{ text }] },
          groundingMetadata: { groundingChunks: chunks.map((web) => ({ web })) },
        },
      ],
    }),
    { status: 200 },
  );

const failure = (status: number, details: unknown[], message = 'x') =>
  new Response(JSON.stringify({ error: { code: status, message, details } }), { status });

const perMinute = (delay: string) =>
  failure(429, [
    {
      '@type': 'type.googleapis.com/google.rpc.QuotaFailure',
      violations: [{ quotaId: 'GenerateRequestsPerMinutePerProjectPerModel-FreeTier' }],
    },
    { '@type': 'type.googleapis.com/google.rpc.RetryInfo', retryDelay: delay },
  ]);

const perDay = failure(429, [
  {
    '@type': 'type.googleapis.com/google.rpc.QuotaFailure',
    violations: [{ quotaId: 'GenerateRequestsPerDayPerProjectPerModel-FreeTier' }],
  },
]);

function setup(responses: Array<Response | Error>, settings: Partial<GeminiSettings> = {}) {
  const calls: Array<{ url: string; init: RequestInit }> = [];
  const sleeps: number[] = [];
  const client = new GeminiClient({
    fetch: ((url: string, init: RequestInit) => {
      calls.push({ url, init });
      const next = responses.shift();
      if (!next) return Promise.reject(new Error('no more responses'));
      if (next instanceof Error) return Promise.reject(next);
      return Promise.resolve(next);
    }) as unknown as typeof fetch,
    key: () => Promise.resolve('test-key-123'),
    settings: () => ({ ...GeminiSettingsSchema.parse({}), ...settings }),
    sleep: (ms) => {
      sleeps.push(ms);
      return Promise.resolve();
    },
  });
  interface Body {
    generationConfig: Record<string, unknown>;
    tools?: unknown;
  }
  const body = (index = 0) => JSON.parse(calls[index]?.init.body as string) as Body;
  return { client, calls, sleeps, body };
}

async function code(promise: Promise<unknown>): Promise<string> {
  try {
    await promise;
  } catch (error) {
    if (error instanceof AppErrorException) return error.error.code;
    throw error;
  }
  return 'resolved';
}

describe('GeminiClient (FR-SCR-7)', () => {
  it('FR-SCR-7: posts to the model with the key in a header, temperature 0', async () => {
    const { client, calls, body } = setup([reply('[{"gameId":7}]')], {
      model: 'gemini-test',
      grounding: false,
    });
    await client.ask([game], ['year'], 'English');
    expect(calls[0]?.url).toBe(`${GEMINI_API_URL}/models/gemini-test:generateContent`);
    expect(calls[0]?.url).not.toContain('test-key-123');
    expect(new Headers(calls[0]?.init.headers).get('x-goog-api-key')).toBe('test-key-123');
    expect(body().generationConfig.temperature).toBe(0);
  });

  it('FR-SCR-7: without grounding it asks for JSON with a response schema', async () => {
    const { client, body } = setup([reply('[{"gameId":7}]')], { grounding: false });
    const result = await client.ask([game], ['year'], 'English');
    expect(body().generationConfig.responseMimeType).toBe('application/json');
    expect(body().generationConfig.responseSchema).toBeDefined();
    expect(body().tools).toBeUndefined();
    expect(result).toEqual({ items: [{ gameId: 7 }], sources: [], grounded: false });
  });

  it('FR-SCR-7: with grounding it uses Google Search and returns https sources once each', async () => {
    const { client, body } = setup([
      reply('Sure:\n```json\n[{"gameId":7}]\n```', [
        { uri: 'https://en.wikipedia.org/wiki/Coleco_Telstar', title: 'Wikipedia' },
        { uri: 'https://en.wikipedia.org/wiki/Coleco_Telstar', title: 'Wikipedia' },
        { uri: 'http://insecure.example', title: 'Insecure' },
      ]),
    ]);
    const result = await client.ask([game], ['year'], 'English');
    expect(body().tools).toEqual([{ google_search: {} }]);
    expect(body().generationConfig.responseSchema).toBeUndefined();
    expect(result.items).toEqual([{ gameId: 7 }]);
    expect(result.sources).toEqual([
      { title: 'Wikipedia', url: 'https://en.wikipedia.org/wiki/Coleco_Telstar' },
    ]);
    expect(result.grounded).toBe(true);
  });

  it('FR-SCR-7: a per-minute limit waits the retry delay and tries again', async () => {
    const { client, sleeps } = setup([perMinute('7s'), reply('[{"gameId":7}]')]);
    const result = await client.ask([game], ['year'], 'English');
    expect(sleeps).toEqual([7000]);
    expect(result.items).toEqual([{ gameId: 7 }]);
  });

  it('FR-SCR-7: the daily limit is GEMINI_QUOTA at once, never retried', async () => {
    const { client, calls } = setup([perDay]);
    expect(await code(client.ask([game], ['year'], 'English'))).toBe('GEMINI_QUOTA');
    expect(calls).toHaveLength(1);
  });

  it('FR-SCR-7: errors map to their codes', async () => {
    const ask = (response: Response | Error) =>
      code(setup([response]).client.ask([game], ['year'], 'English'));
    expect(await ask(failure(400, [{ reason: 'API_KEY_INVALID' }], 'API key not valid.'))).toBe(
      'GEMINI_KEY_REJECTED',
    );
    expect(await ask(failure(403, []))).toBe('GEMINI_KEY_REJECTED');
    expect(await ask(failure(404, [], 'model not found'))).toBe('GEMINI_KEY_REJECTED');
    expect(await ask(new TypeError('fetch failed'))).toBe('GEMINI_NETWORK');
    expect(await ask(failure(503, []))).toBe('GEMINI_NETWORK');
    expect(await ask(reply('I have no idea.'))).toBe('GEMINI_BAD_REPLY');
  });

  it('FR-SCR-7: no key is GEMINI_NO_KEY without a request', async () => {
    const calls: unknown[] = [];
    const client = new GeminiClient({
      fetch: () => {
        calls.push(1);
        return Promise.resolve(reply('[]'));
      },
      key: () => Promise.resolve(null),
      settings: () => GeminiSettingsSchema.parse({}),
      sleep: () => Promise.resolve(),
    });
    expect(await code(client.ask([game], ['year'], 'English'))).toBe('GEMINI_NO_KEY');
    expect(await code(client.test())).toBe('GEMINI_NO_KEY');
    expect(calls).toHaveLength(0);
  });

  it('FR-SCR-7: test sends one tiny request', async () => {
    const { client, calls } = setup([reply('OK')]);
    await client.test();
    expect(calls).toHaveLength(1);
  });

  it('FR-SCR-7: a dev base URL replaces the Google one', async () => {
    const calls: string[] = [];
    const client = new GeminiClient({
      fetch: ((url: string) => {
        calls.push(url);
        return Promise.resolve(reply('[]'));
      }) as unknown as typeof fetch,
      key: () => Promise.resolve('k-123456789'),
      settings: () => GeminiSettingsSchema.parse({}),
      sleep: () => Promise.resolve(),
      baseUrl: 'http://127.0.0.1:9/v1beta',
    });
    await client.ask([game], ['year'], 'English');
    expect(calls[0]).toMatch(/^http:\/\/127\.0\.0\.1:9\/v1beta\/models\//);
  });
});
