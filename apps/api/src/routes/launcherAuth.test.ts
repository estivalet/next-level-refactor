import { afterEach, describe, expect, it } from 'vitest';
import { adminHeaders, adminSignIn } from '../../test/adminSignIn.ts';
import { createTestApp } from '../../test/testApp.ts';
import {
  bearer,
  exchange,
  signIn,
  stubCode,
  VERIFIER,
  REDIRECT,
  DEVICE,
} from '../../test/launcherSignIn.ts';

const closers: Array<() => Promise<void>> = [];
afterEach(async () => {
  for (const close of closers.splice(0)) await close();
});

async function setup(opts: Parameters<typeof createTestApp>[0] = {}) {
  const test = await createTestApp(opts);
  closers.push(test.close);
  return test;
}

describe('launcher sign-in (FR-AUTH-1..3, US-A1, D22)', () => {
  it('US-A1: the exchange returns tokens, the profile, the entitlement and the banner', async () => {
    const { app } = await setup({ settings: { banner: 'Hello' } });
    const session = await signIn(app, 'subscriber');
    expect(session.user).toMatchObject({ role: 'subscriber' });
    expect(session.entitlement.status).toBe('active');
    expect(session.banner).toBe('Hello');
    expect(session.accessToken.split('.')).toHaveLength(3);
  });

  it('D22: a Google account outside the allow-list is NOT_ALLOWED', async () => {
    const { app } = await setup();
    const response = await exchange(app, 'outsider');
    expect(response.statusCode).toBe(403);
    expect(response.json()).toMatchObject({ error: { code: 'NOT_ALLOWED' } });
  });

  it('D22: open mode admits anyone; closed mode admits only existing users', async () => {
    const open = await setup({ settings: { signUpMode: 'open' } });
    expect((await exchange(open.app, 'outsider')).statusCode).toBe(200);
    const closed = await setup({ settings: { signUpMode: 'closed' } });
    expect((await exchange(closed.app, 'outsider')).statusCode).toBe(403);
  });

  it('a code exchanged with the wrong verifier is UNAUTHENTICATED', async () => {
    const { app } = await setup();
    const code = await stubCode(app, 'subscriber');
    const response = await app.inject({
      method: 'POST',
      url: '/v1/auth/google/exchange',
      payload: { code, codeVerifier: 'b'.repeat(43), redirectUri: REDIRECT, device: DEVICE },
    });
    expect(response.statusCode).toBe(401);
  });
});

describe('device limit (FR-AUTH-8, US-A4)', () => {
  it('US-A4: the 4th device gets DEVICE_LIMIT with the 3 devices and a ticket', async () => {
    const { app } = await setup();
    for (const name of ['A', 'B', 'C']) await signIn(app, 'subscriber', name);
    const response = await exchange(app, 'subscriber', { ...DEVICE, name: 'D' });
    expect(response.statusCode).toBe(409);
    const body = response.json<{
      error: { code: string; details: { ticket: string; devices: Array<{ name: string }> } };
    }>();
    expect(body.error.code).toBe('DEVICE_LIMIT');
    expect(body.error.details.devices.map((d) => d.name)).toEqual(['A', 'B', 'C']);
  });

  it('US-A4: completing with the ticket revokes the chosen device and signs in, once', async () => {
    const { app } = await setup();
    const first = await signIn(app, 'subscriber', 'A');
    await signIn(app, 'subscriber', 'B');
    await signIn(app, 'subscriber', 'C');
    const limited = await exchange(app, 'subscriber', { ...DEVICE, name: 'D' });
    const { ticket } = limited.json<{ error: { details: { ticket: string } } }>().error.details;
    const complete = (revokeDeviceId: string) =>
      app.inject({
        method: 'POST',
        url: '/v1/auth/complete',
        payload: { ticket, revokeDeviceId, device: { ...DEVICE, name: 'D' } },
      });
    const done = await complete(first.deviceId);
    expect(done.statusCode).toBe(200);
    const devices = await app.inject({
      url: '/v1/me/devices',
      headers: bearer(done.json<{ accessToken: string }>().accessToken),
    });
    expect(devices.json<Array<{ name: string }>>().map((d) => d.name)).toEqual(['B', 'C', 'D']);
    expect((await complete(first.deviceId)).statusCode).toBe(401);
    const revoked = await app.inject({ url: '/v1/me', headers: bearer(first.accessToken) });
    expect(revoked.statusCode).toBe(401);
  });

  it('a ticket older than 5 minutes is refused', async () => {
    const { app, clock } = await setup();
    const first = await signIn(app, 'subscriber', 'A');
    await signIn(app, 'subscriber', 'B');
    await signIn(app, 'subscriber', 'C');
    const limited = await exchange(app, 'subscriber', { ...DEVICE, name: 'D' });
    const { ticket } = limited.json<{ error: { details: { ticket: string } } }>().error.details;
    clock.advance(5 * 60_000 + 1000);
    const response = await app.inject({
      method: 'POST',
      url: '/v1/auth/complete',
      payload: { ticket, revokeDeviceId: first.deviceId, device: DEVICE },
    });
    expect(response.statusCode).toBe(401);
  });

  it('admins have no device limit; sign-out frees a slot', async () => {
    const { app } = await setup();
    for (const name of ['A', 'B', 'C', 'D']) await signIn(app, 'admin', name);
    const a = await signIn(app, 'subscriber', 'A');
    await signIn(app, 'subscriber', 'B');
    await signIn(app, 'subscriber', 'C');
    const logout = await app.inject({
      method: 'POST',
      url: '/v1/auth/logout',
      payload: { refreshToken: a.refreshToken },
    });
    expect(logout.statusCode).toBe(204);
    expect((await exchange(app, 'subscriber', { ...DEVICE, name: 'D' })).statusCode).toBe(200);
  });
});

describe('device limit with billing on (FR-SUB-4, D33)', () => {
  const BILLING_ON = { BILLING_ENABLED: 'true', BILLING_STUB: '1' };

  it("the limit comes from the entitlement's plan: a 1-device comp plan refuses a 2nd PC", async () => {
    const { app } = await setup({ rawEnv: BILLING_ON });
    const first = await signIn(app, 'subscriber', 'PC 1');
    const admin = await adminSignIn(app, 'admin');
    const write = { headers: adminHeaders(admin, true) };
    await app.inject({
      ...write,
      method: 'POST',
      url: '/v1/admin/plans',
      payload: { slug: 'solo', name: 'Solo', deviceLimit: 1, scopeIds: [] },
    });
    const granted = await app.inject({
      ...write,
      method: 'POST',
      url: `/v1/admin/users/${first.user.id}/grants`,
      payload: { planSlug: 'solo', expiresAt: null, note: 'One PC' },
    });
    expect(granted.statusCode).toBe(200);
    const second = await exchange(app, 'subscriber', { ...DEVICE, name: 'PC 2' });
    expect(second.json()).toMatchObject({ error: { code: 'DEVICE_LIMIT' } });
  });

  it("a user with no subscription signs in (none) and has the Default plan's limit", async () => {
    const { app } = await setup({ rawEnv: BILLING_ON });
    for (const name of ['A', 'B', 'C']) {
      expect((await signIn(app, 'subscriber', name)).entitlement.status).toBe('none');
    }
    const fourth = await exchange(app, 'subscriber', { ...DEVICE, name: 'D' });
    expect(fourth.json()).toMatchObject({ error: { code: 'DEVICE_LIMIT' } });
  });
});

describe('device-limit ticket hardening (US-A4, review)', () => {
  async function limited(app: Parameters<typeof signIn>[0]) {
    const a = await signIn(app, 'subscriber', 'A');
    const b = await signIn(app, 'subscriber', 'B');
    await signIn(app, 'subscriber', 'C');
    const response = await exchange(app, 'subscriber', { ...DEVICE, name: 'D' });
    const { ticket } = response.json<{ error: { details: { ticket: string } } }>().error.details;
    return { a, b, ticket };
  }
  const complete = (app: Parameters<typeof signIn>[0], ticket: string, revokeDeviceId: string) =>
    app.inject({
      method: 'POST',
      url: '/v1/auth/complete',
      payload: { ticket, revokeDeviceId, device: { ...DEVICE, name: 'D' } },
    });

  it('US-A4: a re-encoded copy of a used ticket (same signature bits) is refused', async () => {
    const { app } = await setup();
    const { a, b, ticket } = await limited(app);
    expect((await complete(app, ticket, a.deviceId)).statusCode).toBe(200);
    // The last base64url character carries unused bits: flipping them keeps the signature valid.
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
    const last = alphabet.indexOf(ticket.slice(-1));
    const variants = [1, 2, 3].map(
      (bits) => ticket.slice(0, -1) + (alphabet[(last & ~3) | ((last + bits) & 3)] ?? ''),
    );
    for (const variant of variants.filter((v) => v !== ticket)) {
      expect((await complete(app, variant, b.deviceId)).statusCode).toBe(401);
    }
  });

  it('US-A4: a device id that is no longer there does not spend the ticket', async () => {
    const { app } = await setup();
    const { a, b, ticket } = await limited(app);
    await app.inject({
      method: 'DELETE',
      url: `/v1/me/devices/${a.deviceId}`,
      headers: bearer(b.accessToken),
    });
    expect((await complete(app, ticket, a.deviceId)).statusCode).toBe(404);
    expect((await complete(app, ticket, b.deviceId)).statusCode).toBe(200);
  });
});

describe('refresh and rate limits (ADR-006, api-spec rate limits)', () => {
  it('refresh rotates the pair and updates last seen', async () => {
    const { app, clock, db } = await setup();
    const session = await signIn(app, 'subscriber');
    clock.advance(60_000);
    const response = await app.inject({
      method: 'POST',
      url: '/v1/auth/refresh',
      payload: { refreshToken: session.refreshToken, deviceId: session.deviceId },
    });
    expect(response.statusCode).toBe(200);
    const seen = db.$client
      .prepare('select last_seen_at from devices where id = ?')
      .pluck()
      .get(session.deviceId);
    expect(seen).toBe(clock.read().toISOString());
  });

  it('the 11th exchange in a minute from one address is RATE_LIMITED with Retry-After', async () => {
    const { app } = await setup();
    const statuses: number[] = [];
    for (let i = 0; i < 11; i += 1) {
      const response = await app.inject({
        method: 'POST',
        url: '/v1/auth/google/exchange',
        payload: { code: 'x', codeVerifier: VERIFIER, redirectUri: REDIRECT, device: DEVICE },
      });
      statuses.push(response.statusCode);
      if (i === 10) {
        expect(response.json()).toMatchObject({ error: { code: 'RATE_LIMITED' } });
        expect(response.headers['retry-after']).toBeDefined();
      }
    }
    expect(statuses.slice(0, 10).every((s) => s === 401)).toBe(true);
    expect(statuses[10]).toBe(429);
  });
});
