import type { AdminPlan } from '@nextlevel/shared';
import { afterEach, describe, expect, it } from 'vitest';
import { adminHeaders, adminSignIn } from '../../test/adminSignIn.ts';
import { fakeBilling } from '../../test/fakeBilling.ts';
import { bearer, signIn } from '../../test/launcherSignIn.ts';
import { createTestApp } from '../../test/testApp.ts';
import type { BillingProvider } from '../billing/provider.ts';
import { apiError } from '../errors.ts';

const closers: Array<() => Promise<void>> = [];
afterEach(async () => {
  for (const close of closers.splice(0)) await close();
});

const EMAIL = 'subscriber@nextlevel.test';

async function setup(billing?: BillingProvider) {
  const test = await createTestApp({
    rawEnv: { BILLING_ENABLED: 'true', BILLING_STUB: '1' },
    ...(billing ? { billing } : {}),
  });
  closers.push(test.close);
  const admin = await adminSignIn(test.app, 'admin');
  const adminSend = (method: 'POST' | 'PATCH' | 'DELETE' | 'GET', url: string, payload?: object) =>
    test.app.inject({
      method,
      url,
      headers: adminHeaders(admin, method !== 'GET'),
      ...(payload ? { payload } : {}),
    });
  const plan = (
    await adminSend('POST', '/v1/admin/plans', {
      slug: 'basic',
      name: 'Basic',
      deviceLimit: 2,
      scopeIds: [],
    })
  ).json<AdminPlan>();
  const launcher = await signIn(test.app, 'subscriber');
  const deleteMe = (confirmEmail: string) =>
    test.app.inject({
      method: 'DELETE',
      url: '/v1/me',
      headers: bearer(launcher.accessToken),
      payload: { confirmEmail },
    });
  const count = (sql: string, ...args: unknown[]) =>
    test.db.$client
      .prepare(sql)
      .pluck()
      .get(...args) as number;
  return { ...test, admin, adminSend, plan, launcher, deleteMe, count };
}

function keysOf(value: unknown): string[] {
  if (Array.isArray(value)) return value.flatMap(keysOf);
  if (value && typeof value === 'object') {
    return Object.entries(value).flatMap(([key, inner]) => [key, ...keysOf(inner)]);
  }
  return [];
}

function insertStripe(db: Awaited<ReturnType<typeof setup>>['db'], userId: string, planId: string) {
  db.$client
    .prepare(
      `insert into subscriptions (id, user_id, plan_id, source, status, stripe_customer_id,
         stripe_subscription_id, created_at, updated_at)
       values ('s-pay', ?, ?, 'stripe', 'active', 'cus_1', 'sub_live', ?, ?)`,
    )
    .run(userId, planId, '2026-10-01T00:00:00.000Z', '2026-10-01T00:00:00.000Z');
}

describe('Download my data (security §5, D36)', () => {
  it('has the profile, devices and subscriptions, and no tokens or other people', async () => {
    const { app, adminSend, launcher } = await setup();
    await adminSend('POST', `/v1/admin/users/${launcher.user.id}/grants`, {
      planSlug: 'basic',
      expiresAt: null,
      note: 'Friend',
    });
    const response = await app.inject({
      url: '/v1/me/export',
      headers: bearer(launcher.accessToken),
    });
    expect(response.statusCode).toBe(200);
    const data = response.json<Record<string, unknown>>();
    expect(data).toMatchObject({
      user: { email: EMAIL, status: 'active' },
      devices: [{ name: 'Living room' }],
      subscriptions: [{ source: 'comp', status: 'active', plan: { slug: 'basic' } }],
      audit: [expect.objectContaining({ action: 'grant.create' })],
    });
    const keys = keysOf(data);
    for (const secret of ['tokenHash', 'refreshToken', 'accessToken', 'googleSub', 'grantedBy']) {
      expect(keys).not.toContain(secret);
    }
    expect(JSON.stringify(data)).not.toContain('admin@nextlevel.test');
  });

  it('needs a signed-in launcher', async () => {
    const { app } = await setup();
    expect((await app.inject({ url: '/v1/me/export' })).statusCode).toBe(401);
  });
});

describe('Delete account (security §5, D36)', () => {
  it('a wrong email is VALIDATION_FAILED and changes nothing', async () => {
    const { deleteMe, count, launcher } = await setup();
    const response = await deleteMe('someone@nextlevel.test');
    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({
      error: { code: 'VALIDATION_FAILED', details: { reason: 'email' } },
    });
    expect(count('select count(*) from users where id = ?', launcher.user.id)).toBe(1);
  });

  it('deletes the user and their devices; the refresh token is dead; audit rows lose the email', async () => {
    const { app, deleteMe, count, launcher, adminSend, db } = await setup();
    await adminSend('PATCH', `/v1/admin/users/${launcher.user.id}`, {
      status: 'suspended',
      suspendedReason: 'Spam',
    });
    await adminSend('PATCH', `/v1/admin/users/${launcher.user.id}`, { status: 'active' });
    expect((await deleteMe(EMAIL.toUpperCase())).statusCode).toBe(204);
    expect(count('select count(*) from users where id = ?', launcher.user.id)).toBe(0);
    expect(count('select count(*) from devices where user_id = ?', launcher.user.id)).toBe(0);
    const refresh = await app.inject({
      method: 'POST',
      url: '/v1/auth/refresh',
      payload: { refreshToken: launcher.refreshToken, deviceId: launcher.deviceId },
    });
    expect(refresh.statusCode).toBe(401);
    const audit = db.$client.prepare('select before, after from audit_log').all();
    expect(audit.length).toBeGreaterThan(0);
    expect(JSON.stringify(audit)).not.toContain(EMAIL);
    expect(JSON.stringify(audit)).not.toContain('Spam');
  });

  it('signing in again after deletion makes a new account', async () => {
    const { app, deleteMe, launcher } = await setup();
    await deleteMe(EMAIL);
    const again = await signIn(app, 'subscriber');
    expect(again.user.id).not.toBe(launcher.user.id);
  });

  it('Review Focus 4: Stripe down while cancelling → 503, nothing deleted; up → cancelled once, deleted', async () => {
    const cancelled: string[] = [];
    let down = true;
    const billing = fakeBilling([], {
      cancelNow: (id) => {
        if (down) return Promise.reject(apiError('BILLING_UNAVAILABLE'));
        cancelled.push(id);
        return Promise.resolve();
      },
    });
    const { deleteMe, count, launcher, plan, db } = await setup(billing);
    insertStripe(db, launcher.user.id, plan.id);
    const failed = await deleteMe(EMAIL);
    expect(failed.statusCode).toBe(503);
    expect(failed.json()).toMatchObject({ error: { code: 'BILLING_UNAVAILABLE' } });
    expect(count('select count(*) from users where id = ?', launcher.user.id)).toBe(1);
    expect(count('select count(*) from subscriptions where user_id = ?', launcher.user.id)).toBe(1);
    down = false;
    expect((await deleteMe(EMAIL)).statusCode).toBe(204);
    expect(cancelled).toEqual(['sub_live']);
    expect(count('select count(*) from users where id = ?', launcher.user.id)).toBe(0);
  });

  it('an admin deletes a subscriber: 204 and user.delete without the email; admins are refused', async () => {
    const { adminSend, launcher, db } = await setup();
    const adminId = db.$client
      .prepare("select id from users where email = 'admin@nextlevel.test'")
      .pluck()
      .get() as string;
    const self = await adminSend('DELETE', `/v1/admin/users/${adminId}`, {
      confirmEmail: 'admin@nextlevel.test',
    });
    expect(self.json()).toMatchObject({
      error: { code: 'CONFLICT', details: { reason: 'admin' } },
    });
    const wrong = await adminSend('DELETE', `/v1/admin/users/${launcher.user.id}`, {
      confirmEmail: 'x@nextlevel.test',
    });
    expect(wrong.statusCode).toBe(400);
    const done = await adminSend('DELETE', `/v1/admin/users/${launcher.user.id}`, {
      confirmEmail: EMAIL,
    });
    expect(done.statusCode).toBe(204);
    const entry = db.$client
      .prepare("select target_id as targetId, before from audit_log where action = 'user.delete'")
      .get() as { targetId: string; before: string };
    expect(entry.targetId).toBe(launcher.user.id);
    expect(entry.before).not.toContain(EMAIL);
    expect((await adminSend('GET', `/v1/admin/users/${launcher.user.id}`)).statusCode).toBe(404);
  });

  it('a demoted former admin who acted and granted is kept as a tombstone', async () => {
    const { app, adminSend, launcher, db } = await setup();
    await signIn(app, 'suspended').catch(() => undefined);
    const suspendedId = db.$client
      .prepare("select id from users where email = 'suspended@nextlevel.test'")
      .pluck()
      .get() as string;
    await adminSend('PATCH', `/v1/admin/users/${launcher.user.id}`, { role: 'admin' });
    const former = await adminSignIn(app, 'subscriber');
    const granted = await app.inject({
      method: 'POST',
      url: `/v1/admin/users/${suspendedId}/grants`,
      headers: adminHeaders(former, true),
      payload: { planSlug: 'basic', expiresAt: null, note: 'From a friend' },
    });
    expect(granted.statusCode).toBe(200);
    await adminSend('PATCH', `/v1/admin/users/${launcher.user.id}`, { role: 'subscriber' });
    const done = await adminSend('DELETE', `/v1/admin/users/${launcher.user.id}`, {
      confirmEmail: EMAIL,
    });
    expect(done.statusCode).toBe(204);
    const row = db.$client
      .prepare('select * from users where id = ?')
      .get(launcher.user.id) as Record<string, unknown>;
    expect(row).toMatchObject({
      email: `deleted-${launcher.user.id}@deleted.invalid`,
      name: 'Deleted user',
      avatar_url: null,
      google_sub: `deleted:${launcher.user.id}`,
      status: 'suspended',
    });
    expect(
      db.$client
        .prepare('select count(*) from subscriptions where granted_by = ?')
        .pluck()
        .get(launcher.user.id),
    ).toBe(1);
    expect(
      db.$client
        .prepare('select count(*) from audit_log where actor_id = ?')
        .pluck()
        .get(launcher.user.id),
    ).toBeGreaterThan(0);
    // Their email is gone from the audit log too, including the grant they gave (grantedBy).
    const audit = db.$client.prepare('select before, after from audit_log').all();
    expect(JSON.stringify(audit)).not.toContain(EMAIL);
    const again = await signIn(app, 'subscriber');
    expect(again.user.id).not.toBe(launcher.user.id);
  });
});
