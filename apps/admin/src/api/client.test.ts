import { AppErrorException } from '@nextlevel/shared';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { apiFetch, onUnauthenticated } from './client.ts';

afterEach(() => {
  vi.unstubAllGlobals();
  document.cookie = 'nl_csrf=; max-age=0';
});

function stubFetch(status: number, body: unknown) {
  const calls: Array<{ url: string; init: RequestInit }> = [];
  vi.stubGlobal('fetch', (url: string, init: RequestInit) => {
    calls.push({ url, init });
    return Promise.resolve(
      new Response(body === undefined ? null : JSON.stringify(body), {
        status,
        headers: { 'content-type': 'application/json' },
      }),
    );
  });
  return calls;
}

describe('console API client (security §2: cookie session + CSRF)', () => {
  it('writes send the CSRF cookie value in X-CSRF-Token; reads do not', async () => {
    document.cookie = 'nl_csrf=abc123';
    const calls = stubFetch(200, { ok: true });
    await apiFetch('/v1/admin/settings', { schema: z.object({ ok: z.boolean() }) });
    await apiFetch('/v1/admin/settings', {
      method: 'PATCH',
      body: { graceDays: 3 },
      schema: z.object({ ok: z.boolean() }),
    });
    const headers = calls.map((c) => new Headers(c.init.headers).get('x-csrf-token'));
    expect(headers).toEqual([null, 'abc123']);
    expect(calls[1]?.init.credentials).toBe('same-origin');
    expect(calls[1]?.init.body).toBe('{"graceDays":3}');
  });

  it('an error envelope becomes an AppErrorException with its code and details', async () => {
    stubFetch(409, {
      error: { code: 'CONFLICT', message: 'm', requestId: 'r', details: { reason: 'lastAdmin' } },
    });
    const error = await apiFetch('/v1/admin/users/x', {
      method: 'PATCH',
      body: {},
      schema: z.unknown(),
    }).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(AppErrorException);
    expect((error as AppErrorException).error).toMatchObject({
      code: 'CONFLICT',
      details: { reason: 'lastAdmin' },
    });
  });

  it('a 401 tells the app the session is gone', async () => {
    stubFetch(401, { error: { code: 'UNAUTHENTICATED', message: 'm', requestId: 'r' } });
    const gone = vi.fn();
    const stop = onUnauthenticated(gone);
    await apiFetch('/v1/admin/users', { schema: z.unknown() }).catch(() => undefined);
    stop();
    expect(gone).toHaveBeenCalledTimes(1);
  });
});
