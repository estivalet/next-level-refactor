import { createHash } from 'node:crypto';
import { afterEach, describe, expect, it } from 'vitest';
import { createTestApp } from '../../test/testApp.ts';

const closers: Array<() => Promise<void>> = [];
afterEach(async () => {
  for (const close of closers.splice(0)) await close();
});

const VERIFIER = 'a'.repeat(43);
const CHALLENGE = createHash('sha256').update(VERIFIER).digest('base64url');

function authorize(params: Record<string, string>) {
  const query = new URLSearchParams({
    redirect_uri: 'http://127.0.0.1:5000/callback',
    state: 'st',
    code_challenge: CHALLENGE,
    code_challenge_method: 'S256',
    response_type: 'code',
    client_id: 'stub',
    scope: 'openid email profile',
    ...params,
  });
  return `/v1/auth/stub/authorize?${query.toString()}`;
}

async function setup(rawEnv: Record<string, string | undefined> = {}) {
  const test = await createTestApp({ rawEnv });
  closers.push(test.close);
  return test;
}

describe('GET /v1/auth/stub/authorize (environment-setup: AUTH_STUB)', () => {
  it('with a login hint it goes straight back to the redirect with a code and the state', async () => {
    const { app } = await setup();
    const response = await app.inject({ url: authorize({ login_hint: 'subscriber' }) });
    expect(response.statusCode).toBe(302);
    const location = new URL(String(response.headers.location));
    expect(`${location.origin}${location.pathname}`).toBe('http://127.0.0.1:5000/callback');
    expect(location.searchParams.get('state')).toBe('st');
    expect(location.searchParams.get('code')).toMatch(/^stub\./);
  });

  it('without a hint it shows the four personas and a cancel link', async () => {
    const { app } = await setup();
    const response = await app.inject({ url: authorize({}) });
    expect(response.statusCode).toBe(200);
    expect(response.headers['content-type']).toMatch(/text\/html/);
    for (const persona of ['admin', 'subscriber', 'suspended', 'outsider']) {
      expect(response.body).toContain(`login_hint=${persona}`);
    }
    expect(response.body).toContain('error=access_denied');
  });

  it('a redirect that is neither loopback nor our own callback is refused', async () => {
    const { app } = await setup();
    const response = await app.inject({
      url: authorize({ redirect_uri: 'https://evil.example/cb', login_hint: 'admin' }),
    });
    expect(response.statusCode).toBe(400);
    const own = await app.inject({
      url: authorize({
        redirect_uri: 'http://localhost:4000/v1/auth/google/callback',
        login_hint: 'admin',
      }),
    });
    expect(own.statusCode).toBe(302);
  });

  it('does not exist without AUTH_STUB', async () => {
    const { app } = await setup({
      AUTH_STUB: undefined,
      GOOGLE_CLIENT_ID_DESKTOP: 'd',
      GOOGLE_CLIENT_SECRET_DESKTOP: 'd',
      GOOGLE_CLIENT_ID_WEB: 'w',
      GOOGLE_CLIENT_SECRET_WEB: 'w',
    });
    const response = await app.inject({ url: authorize({ login_hint: 'admin' }) });
    expect(response.statusCode).toBe(404);
  });
});

describe('GET /v1/auth/launcher-config (FR-AUTH-2, D28)', () => {
  it('stub: the stub authorize URL, the scopes and the banner', async () => {
    const test = await createTestApp({ settings: { banner: 'Maintenance at 22:00' } });
    closers.push(test.close);
    const response = await test.app.inject({ url: '/v1/auth/launcher-config' });
    expect(response.json()).toEqual({
      authorizeUrl: 'http://localhost:4000/v1/auth/stub/authorize',
      clientId: 'stub',
      scopes: ['openid', 'email', 'profile'],
      banner: 'Maintenance at 22:00',
    });
  });

  it("Google: Google's authorize URL and the Desktop client id", async () => {
    const { app } = await setup({
      AUTH_STUB: undefined,
      GOOGLE_CLIENT_ID_DESKTOP: 'desktop-id',
      GOOGLE_CLIENT_SECRET_DESKTOP: 'd',
      GOOGLE_CLIENT_ID_WEB: 'web-id',
      GOOGLE_CLIENT_SECRET_WEB: 'w',
    });
    const body = (await app.inject({ url: '/v1/auth/launcher-config' })).json<{
      authorizeUrl: string;
      clientId: string;
    }>();
    expect(body.authorizeUrl).toBe('https://accounts.google.com/o/oauth2/v2/auth');
    expect(body.clientId).toBe('desktop-id');
  });
});
