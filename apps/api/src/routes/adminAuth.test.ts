import { afterEach, describe, expect, it } from 'vitest';
import { adminHeaders, adminSignIn, CookieJar } from '../../test/adminSignIn.ts';
import { createTestApp } from '../../test/testApp.ts';

const closers: Array<() => Promise<void>> = [];
afterEach(async () => {
  for (const close of closers.splice(0)) await close();
});

async function setup(rawEnv: Record<string, string | undefined> = {}) {
  const test = await createTestApp({ rawEnv });
  closers.push(test.close);
  return test;
}

describe('admin console sign-in (ADR-006, security §2)', () => {
  it('start → consent → callback sets an httpOnly Strict session and a CSRF cookie', async () => {
    const { app } = await setup({ ADMIN_ORIGIN: 'http://localhost:5174' });
    const start = await app.inject({ url: '/v1/auth/google/start' });
    expect(start.statusCode).toBe(302);
    const consent = new URL(String(start.headers.location));
    expect(consent.pathname).toBe('/v1/auth/stub/authorize');
    expect(consent.searchParams.get('redirect_uri')).toBe(
      'http://localhost:4000/v1/auth/google/callback',
    );
    expect(consent.searchParams.get('code_challenge_method')).toBe('S256');
    const oauth = start.cookies.find((c) => c.name === 'nl_oauth');
    expect(oauth).toMatchObject({ httpOnly: true, sameSite: 'Lax' });

    const session = await adminSignIn(app, 'admin');
    expect(session.location).toBe('http://localhost:5174');
    const me = await app.inject({ url: '/v1/auth/session', headers: adminHeaders(session) });
    expect(me.json()).toMatchObject({
      user: { email: 'admin@nextlevel.test', role: 'admin' },
      csrf: session.csrf,
    });
  });

  it('the session cookie is httpOnly and SameSite=Strict; the CSRF cookie is readable', async () => {
    const { app } = await setup();
    const jar = new CookieJar();
    const start = await app.inject({ url: '/v1/auth/google/start' });
    jar.take(start);
    const consent = await app.inject({
      url: `${new URL(String(start.headers.location)).pathname}${new URL(String(start.headers.location)).search}&login_hint=admin`,
    });
    const back = new URL(String(consent.headers.location));
    const callback = await app.inject({
      url: `${back.pathname}${back.search}`,
      headers: { cookie: jar.header() },
    });
    expect(callback.cookies.find((c) => c.name === 'nl_session')).toMatchObject({
      httpOnly: true,
      sameSite: 'Strict',
      path: '/',
    });
    expect(callback.cookies.find((c) => c.name === 'nl_csrf')?.httpOnly).not.toBe(true);
  });

  it('a subscriber or an outsider is sent back with notAdmin, without a session', async () => {
    const { app } = await setup();
    for (const persona of ['subscriber', 'outsider'] as const) {
      const session = await adminSignIn(app, persona);
      expect(session.location).toBe('/?error=notAdmin');
      expect(session.jar.values.has('nl_session')).toBe(false);
    }
  });

  it('a callback without a matching start (forged, or the 10-minute cookie expired) goes back with expired', async () => {
    const { app } = await setup();
    const response = await app.inject({ url: '/v1/auth/google/callback?code=x&state=forged' });
    expect(response.statusCode).toBe(302);
    expect(response.headers.location).toBe('/?error=expired');
    expect(response.cookies.some((c) => c.name === 'nl_session' && c.value)).toBe(false);
  });

  it('a code Google refuses comes back as failed, not as "not an admin"', async () => {
    const { app } = await setup();
    const jar = new CookieJar();
    const start = await app.inject({ url: '/v1/auth/google/start' });
    jar.take(start);
    const state = new URL(String(start.headers.location)).searchParams.get('state') ?? '';
    const response = await app.inject({
      url: `/v1/auth/google/callback?code=stub.bogus&state=${state}`,
      headers: { cookie: jar.header() },
    });
    expect(response.headers.location).toBe('/?error=failed');
  });

  it('cancelling at Google comes back as error=cancelled', async () => {
    const { app } = await setup();
    const jar = new CookieJar();
    const start = await app.inject({ url: '/v1/auth/google/start' });
    jar.take(start);
    const state = new URL(String(start.headers.location)).searchParams.get('state') ?? '';
    const response = await app.inject({
      url: `/v1/auth/google/callback?error=access_denied&state=${state}`,
      headers: { cookie: jar.header() },
    });
    expect(response.headers.location).toBe('/?error=cancelled');
  });

  it('logout needs the CSRF header, then removes the session', async () => {
    const { app, db } = await setup();
    const session = await adminSignIn(app, 'admin');
    const noCsrf = await app.inject({
      method: 'POST',
      url: '/v1/auth/session/logout',
      headers: adminHeaders(session),
    });
    expect(noCsrf.statusCode).toBe(403);
    const out = await app.inject({
      method: 'POST',
      url: '/v1/auth/session/logout',
      headers: adminHeaders(session, true),
    });
    expect(out.statusCode).toBe(204);
    expect(db.$client.prepare('select count(*) from admin_sessions').pluck().get()).toBe(0);
    const me = await app.inject({ url: '/v1/auth/session', headers: adminHeaders(session) });
    expect(me.statusCode).toBe(401);
  });
});
