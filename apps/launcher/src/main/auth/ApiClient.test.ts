import { describe, expect, it } from 'vitest';
import { ApiClient, ApiFailure } from './ApiClient.ts';

const ENTITLEMENT = {
  userId: 'u1',
  role: 'subscriber',
  status: 'active',
  plan: { slug: 'default', name: 'Default', deviceLimit: 3 },
  scopes: [],
  checkedAt: '2026-10-25T12:00:00.000Z',
  offlineUntil: '2026-11-08T12:00:00.000Z',
};

type Answer = { status: number; body?: unknown } | 'network' | 'hang';

function client(answer: Answer, timeoutMs = 10_000) {
  const requests: Array<{ url: string; init: RequestInit | undefined }> = [];
  const fakeFetch = (input: string | URL | Request, init?: RequestInit) => {
    requests.push({ url: input instanceof Request ? input.url : input.toString(), init });
    if (answer === 'network') return Promise.reject(new TypeError('fetch failed'));
    if (answer === 'hang') {
      return new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => {
          reject(new DOMException('aborted', 'AbortError'));
        });
      });
    }
    return Promise.resolve(
      new Response(answer.body === undefined ? null : JSON.stringify(answer.body), {
        status: answer.status,
        headers: { 'content-type': 'application/json' },
      }),
    );
  };
  return {
    api: new ApiClient({ baseUrl: 'http://api.test', fetch: fakeFetch, timeoutMs }),
    requests,
  };
}

const failureOf = (promise: Promise<unknown>) =>
  promise.then(
    () => null,
    (error: unknown) => (error instanceof ApiFailure ? error.failure : error),
  );

describe('API client (FR-AUTH-5: offline means "keep the grace")', () => {
  it('a good answer is parsed; the Bearer token goes in the header, never the URL', async () => {
    const { api, requests } = client({
      status: 200,
      body: { entitlement: ENTITLEMENT, banner: null },
    });
    expect(await api.entitlement('access-token')).toEqual({
      entitlement: ENTITLEMENT,
      banner: null,
    });
    expect(requests[0]?.url).toBe('http://api.test/v1/me/entitlement');
    expect(new Headers(requests[0]?.init?.headers).get('authorization')).toBe(
      'Bearer access-token',
    );
  });

  it.each([
    ['a network error', 'network' as const],
    ['a 503', { status: 503 }],
    [
      'a 429',
      { status: 429, body: { error: { code: 'RATE_LIMITED', message: '', requestId: 'r' } } },
    ],
    ['a 200 that is not the expected shape', { status: 200, body: { nope: true } }],
    ['a 4xx that is not the envelope', { status: 404, body: '<html>' }],
  ])('%s is offline', async (_name, answer) => {
    expect(await failureOf(client(answer).api.entitlement('t'))).toEqual({ kind: 'offline' });
  });

  it('a request that hangs is offline after the timeout', async () => {
    const started = Date.now();
    expect(await failureOf(client('hang', 50).api.launcherConfig())).toEqual({ kind: 'offline' });
    expect(Date.now() - started).toBeLessThan(2000);
  });

  it('an error envelope is an api failure with its code and details (US-A4)', async () => {
    const details = { ticket: 't', devices: [] };
    const { api } = client({
      status: 409,
      body: { error: { code: 'DEVICE_LIMIT', message: 'm', requestId: 'r', details } },
    });
    const failure = await failureOf(
      api.exchange({
        code: 'c',
        codeVerifier: 'v'.repeat(43),
        redirectUri: 'http://127.0.0.1:1/callback',
        device: { name: 'PC', platform: 'win32', appVersion: '1' },
      }),
    );
    expect(failure).toEqual({ kind: 'api', status: 409, code: 'DEVICE_LIMIT', details });
  });

  it('tokens never appear in a failure message', async () => {
    const { api } = client({
      status: 401,
      body: { error: { code: 'UNAUTHENTICATED', message: 'm', requestId: 'r' } },
    });
    const error = await api
      .refresh({ refreshToken: 'secret-refresh', deviceId: 'd' })
      .catch((e: unknown) => e);
    expect(String(error)).not.toContain('secret-refresh');
    expect((error as ApiFailure).failure).toMatchObject({ kind: 'api', code: 'UNAUTHENTICATED' });
  });

  it('logout and device revoke expect 204', async () => {
    const { api, requests } = client({ status: 204 });
    await api.logout('r');
    await api.revokeDevice('t', 'd 1');
    expect(requests.map((r) => [r.init?.method, r.url])).toEqual([
      ['POST', 'http://api.test/v1/auth/logout'],
      ['DELETE', 'http://api.test/v1/me/devices/d%201'],
    ]);
  });
});
