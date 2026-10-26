import { afterEach, describe, expect, it } from 'vitest';
import { bearer, signIn } from '../../test/launcherSignIn.ts';
import { createTestApp } from '../../test/testApp.ts';

const closers: Array<() => Promise<void>> = [];
afterEach(async () => {
  for (const close of closers.splice(0)) await close();
});

async function setup(opts: Parameters<typeof createTestApp>[0] = {}) {
  const test = await createTestApp(opts);
  closers.push(test.close);
  return test;
}

describe('/v1/me (FR-AUTH-3, FR-AUTH-5, FR-AUTH-7, FR-AUTH-8)', () => {
  it('without a Bearer token every /me route is UNAUTHENTICATED', async () => {
    const { app } = await setup();
    for (const url of ['/v1/me', '/v1/me/entitlement', '/v1/me/devices']) {
      const response = await app.inject({ url });
      expect(response.statusCode).toBe(401);
      expect(response.json()).toMatchObject({ error: { code: 'UNAUTHENTICATED' } });
    }
  });

  it('GET /v1/me/entitlement answers the entitlement and the banner, and updates last seen', async () => {
    const { app, clock, db } = await setup({ settings: { banner: 'Soon', graceDays: 3 } });
    const session = await signIn(app, 'subscriber');
    clock.advance(10 * 60_000);
    const response = await app.inject({
      url: '/v1/me/entitlement',
      headers: bearer(session.accessToken),
    });
    const body = response.json<{ entitlement: { offlineUntil: string }; banner: string }>();
    expect(body.banner).toBe('Soon');
    expect(body.entitlement.offlineUntil).toBe(
      new Date(clock.read().getTime() + 3 * 24 * 3600_000).toISOString(),
    );
    const seen = db.$client
      .prepare('select last_seen_at from users where id = ?')
      .pluck()
      .get(session.user.id);
    expect(seen).toBe(clock.read().toISOString());
  });

  it('FR-AUTH-7: a suspended persona signs in and reads a suspended entitlement', async () => {
    const { app } = await setup();
    const session = await signIn(app, 'suspended');
    const me = await app.inject({ url: '/v1/me', headers: bearer(session.accessToken) });
    expect(me.json()).toMatchObject({ entitlement: { status: 'suspended' } });
  });

  it('devices: the calling device is current; it cannot revoke itself; others can be revoked', async () => {
    const { app } = await setup();
    const den = await signIn(app, 'subscriber', 'Den');
    const office = await signIn(app, 'subscriber', 'Office');
    const list = await app.inject({ url: '/v1/me/devices', headers: bearer(den.accessToken) });
    expect(list.json()).toEqual([
      expect.objectContaining({ name: 'Den', current: true }),
      expect.objectContaining({ name: 'Office', current: false }),
    ]);
    const self = await app.inject({
      method: 'DELETE',
      url: `/v1/me/devices/${den.deviceId}`,
      headers: bearer(den.accessToken),
    });
    expect(self.statusCode).toBe(409);
    expect(self.json()).toMatchObject({
      error: { code: 'CONFLICT', details: { reason: 'current' } },
    });
    const other = await app.inject({
      method: 'DELETE',
      url: `/v1/me/devices/${office.deviceId}`,
      headers: bearer(den.accessToken),
    });
    expect(other.statusCode).toBe(204);
    const gone = await app.inject({ url: '/v1/me', headers: bearer(office.accessToken) });
    expect(gone.statusCode).toBe(401);
  });

  it("another user's device is NOT_FOUND", async () => {
    const { app } = await setup();
    const mine = await signIn(app, 'subscriber');
    const theirs = await signIn(app, 'admin');
    const response = await app.inject({
      method: 'DELETE',
      url: `/v1/me/devices/${theirs.deviceId}`,
      headers: bearer(mine.accessToken),
    });
    expect(response.statusCode).toBe(404);
  });
});
