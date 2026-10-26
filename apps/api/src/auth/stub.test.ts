import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { FakeClock } from '../../test/testApp.ts';
import { stubProviders } from './stub.ts';

const VERIFIER = 'a'.repeat(43);
const CHALLENGE = createHash('sha256').update(VERIFIER).digest('base64url');
const REDIRECT = 'http://127.0.0.1:5000/callback';

function setup() {
  const clock = new FakeClock();
  const stub = stubProviders({ publicUrl: 'http://localhost:4000', clock: clock.read });
  return { stub, clock };
}

describe('sign-in stub (environment-setup: AUTH_STUB)', () => {
  it('a code is exchanged once for the persona, with the PKCE verifier', async () => {
    const { stub } = setup();
    const code = stub.issue('subscriber', CHALLENGE, REDIRECT);
    const input = { code, codeVerifier: VERIFIER, redirectUri: REDIRECT };
    expect(await stub.desktop.exchange(input)).toEqual({
      sub: 'stub-subscriber',
      email: 'subscriber@nextlevel.test',
      name: 'Subscriber',
      avatarUrl: null,
      stub: { allowListed: true, suspended: false },
    });
    await expect(stub.desktop.exchange(input)).rejects.toMatchObject({ code: 'UNAUTHENTICATED' });
  });

  it('a wrong verifier, another redirect or a code older than 60 s is refused', async () => {
    const { stub, clock } = setup();
    const wrong = stub.issue('admin', CHALLENGE, REDIRECT);
    await expect(
      stub.desktop.exchange({ code: wrong, codeVerifier: 'b'.repeat(43), redirectUri: REDIRECT }),
    ).rejects.toMatchObject({ code: 'UNAUTHENTICATED' });
    const moved = stub.issue('admin', CHALLENGE, REDIRECT);
    await expect(
      stub.desktop.exchange({
        code: moved,
        codeVerifier: VERIFIER,
        redirectUri: 'http://127.0.0.1:5001/callback',
      }),
    ).rejects.toMatchObject({ code: 'UNAUTHENTICATED' });
    const old = stub.issue('admin', CHALLENGE, REDIRECT);
    clock.advance(60_001);
    await expect(
      stub.desktop.exchange({ code: old, codeVerifier: VERIFIER, redirectUri: REDIRECT }),
    ).rejects.toMatchObject({ code: 'UNAUTHENTICATED' });
  });

  it('personas: suspended is created suspended; outsider is not allow-listed', async () => {
    const { stub } = setup();
    const as = async (persona: 'suspended' | 'outsider') =>
      stub.web.exchange({
        code: stub.issue(persona, CHALLENGE, REDIRECT),
        codeVerifier: VERIFIER,
        redirectUri: REDIRECT,
      });
    expect((await as('suspended')).stub).toEqual({ allowListed: true, suspended: true });
    expect((await as('outsider')).stub).toEqual({ allowListed: false, suspended: false });
    expect(stub.desktop.authorizeUrl).toBe('http://localhost:4000/v1/auth/stub/authorize');
  });
});
