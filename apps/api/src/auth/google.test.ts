import { createLocalJWKSet, exportJWK, generateKeyPair, SignJWT, type JWK } from 'jose';
import { beforeAll, describe, expect, it } from 'vitest';
import { googleProvider } from './google.ts';

const NOW = new Date('2026-10-25T12:00:00.000Z');
const CLIENT = 'desktop-client.apps.example';
let key: Awaited<ReturnType<typeof generateKeyPair>>['privateKey'];
let jwk: JWK;

beforeAll(async () => {
  const pair = await generateKeyPair('RS256', { extractable: true });
  key = pair.privateKey;
  jwk = { ...(await exportJWK(pair.publicKey)), kid: 'k1', alg: 'RS256' };
});

async function idToken(
  claims: Record<string, unknown> = {},
  opts: { aud?: string; iss?: string; exp?: Date } = {},
) {
  return new SignJWT({
    email: 'Player@Example.TEST',
    email_verified: true,
    name: 'Player One',
    picture: 'https://example.test/a.png',
    ...claims,
  })
    .setProtectedHeader({ alg: 'RS256', kid: 'k1' })
    .setSubject('google-sub-1')
    .setIssuer(opts.iss ?? 'https://accounts.google.com')
    .setAudience(opts.aud ?? CLIENT)
    .setIssuedAt(Math.floor(NOW.getTime() / 1000) - 10)
    .setExpirationTime(opts.exp ?? new Date(NOW.getTime() + 3600_000))
    .sign(key);
}

function setup(answer: () => Promise<{ status: number; body: unknown }>) {
  const requests: Array<{ url: string; body: string }> = [];
  const fakeFetch = async (input: string | URL | Request, init?: RequestInit) => {
    requests.push({
      url: input instanceof Request ? input.url : input.toString(),
      body: typeof init?.body === 'string' ? init.body : '',
    });
    const { status, body } = await answer();
    return new Response(JSON.stringify(body), {
      status,
      headers: { 'content-type': 'application/json' },
    });
  };
  const provider = googleProvider({
    clientId: CLIENT,
    clientSecret: 'client-secret',
    fetch: fakeFetch,
    jwks: createLocalJWKSet({ keys: [jwk] }),
    clock: () => NOW,
  });
  const exchange = () =>
    provider.exchange({
      code: 'auth-code',
      codeVerifier: 'v'.repeat(43),
      redirectUri: 'http://127.0.0.1:5000/callback',
    });
  return { provider, requests, exchange };
}

describe('Google identity provider (FR-AUTH-1, ADR-006, security §2)', () => {
  it('exchanges the code with the verifier and returns the verified identity', async () => {
    const token = await idToken();
    const { exchange, requests, provider } = setup(() =>
      Promise.resolve({ status: 200, body: { id_token: token, access_token: 'g' } }),
    );
    expect(await exchange()).toEqual({
      sub: 'google-sub-1',
      email: 'player@example.test',
      name: 'Player One',
      avatarUrl: 'https://example.test/a.png',
    });
    expect(requests[0]?.url).toBe('https://oauth2.googleapis.com/token');
    const form = new URLSearchParams(requests[0]?.body);
    expect(Object.fromEntries(form)).toEqual({
      code: 'auth-code',
      client_id: CLIENT,
      client_secret: 'client-secret',
      code_verifier: 'v'.repeat(43),
      redirect_uri: 'http://127.0.0.1:5000/callback',
      grant_type: 'authorization_code',
    });
    expect(provider.authorizeUrl).toBe('https://accounts.google.com/o/oauth2/v2/auth');
    expect(provider.clientId).toBe(CLIENT);
  });

  it.each([
    ['another audience', () => idToken({}, { aud: 'someone-else' })],
    ['another issuer', () => idToken({}, { iss: 'https://evil.example' })],
    ['an expired token', () => idToken({}, { exp: new Date(NOW.getTime() - 1000) })],
    ['an unverified email', () => idToken({ email_verified: false })],
    ['no email', () => idToken({ email: undefined })],
  ])('%s is UNAUTHENTICATED', async (_name, make) => {
    const token = await make();
    const { exchange } = setup(() => Promise.resolve({ status: 200, body: { id_token: token } }));
    await expect(exchange()).rejects.toMatchObject({ code: 'UNAUTHENTICATED' });
  });

  it("Google refusing the code is UNAUTHENTICATED without Google's answer in the message", async () => {
    const { exchange } = setup(() =>
      Promise.resolve({ status: 400, body: { error: 'invalid_grant', detail: 'leaky' } }),
    );
    const error = await exchange().catch((e: unknown) => e);
    expect(error).toMatchObject({ code: 'UNAUTHENTICATED' });
    expect((error as Error).message).not.toMatch(/leaky|invalid_grant/);
  });
});
