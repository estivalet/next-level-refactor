import { createHash } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import type { StubPersona } from '../src/auth/stub.ts';

export const VERIFIER = 'a'.repeat(43);
const CHALLENGE = createHash('sha256').update(VERIFIER).digest('base64url');
export const REDIRECT = 'http://127.0.0.1:5000/callback';
export const DEVICE = { name: 'Living room', platform: 'win32', appVersion: '0.7.0' } as const;

/** What the launcher does with the stub: authorize (persona) → code → exchange. */
export async function stubCode(app: FastifyInstance, persona: StubPersona): Promise<string> {
  const query = new URLSearchParams({
    redirect_uri: REDIRECT,
    state: 's',
    code_challenge: CHALLENGE,
    code_challenge_method: 'S256',
    login_hint: persona,
  });
  const response = await app.inject({ url: `/v1/auth/stub/authorize?${query.toString()}` });
  const code = new URL(String(response.headers.location)).searchParams.get('code');
  if (!code) throw new Error(`no code for ${persona}`);
  return code;
}

export async function exchange(
  app: FastifyInstance,
  persona: StubPersona,
  device: { name: string; platform: 'win32'; appVersion: string } = DEVICE,
  headers: Record<string, string> = {},
) {
  const code = await stubCode(app, persona);
  return app.inject({
    method: 'POST',
    url: '/v1/auth/google/exchange',
    headers,
    payload: { code, codeVerifier: VERIFIER, redirectUri: REDIRECT, device },
  });
}

/** Signs a persona in and returns the session body. */
export async function signIn(app: FastifyInstance, persona: StubPersona, name = 'Living room') {
  const response = await exchange(app, persona, { ...DEVICE, name });
  if (response.statusCode !== 200) {
    throw new Error(`sign-in failed: ${String(response.statusCode)} ${response.body}`);
  }
  return response.json<{
    accessToken: string;
    refreshToken: string;
    deviceId: string;
    user: { id: string; role: string };
    entitlement: { status: string; offlineUntil: string; checkedAt: string };
    banner: string | null;
  }>();
}

export const bearer = (token: string) => ({ authorization: `Bearer ${token}` });
