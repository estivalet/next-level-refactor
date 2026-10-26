import { afterEach, describe, expect, it } from 'vitest';
import { adminHeaders, adminSignIn } from '../../test/adminSignIn.ts';
import { bearer, signIn } from '../../test/launcherSignIn.ts';
import { createTestApp } from '../../test/testApp.ts';

const closers: Array<() => Promise<void>> = [];
afterEach(async () => {
  for (const close of closers.splice(0)) await close();
});

async function setup() {
  const test = await createTestApp();
  closers.push(test.close);
  const admin = await adminSignIn(test.app, 'admin');
  return { ...test, admin };
}

type Users = {
  items: Array<{ id: string; email: string; status: string; role: string }>;
  nextCursor: string | null;
};

describe('admin guard (security §2, Review Focus 5)', () => {
  it('a launcher Bearer token or no session is UNAUTHENTICATED on admin routes', async () => {
    const { app } = await setup();
    const launcher = await signIn(app, 'admin', 'PC');
    expect((await app.inject({ url: '/v1/admin/users' })).statusCode).toBe(401);
    const bearerOnly = await app.inject({
      url: '/v1/admin/users',
      headers: bearer(launcher.accessToken),
    });
    expect(bearerOnly.statusCode).toBe(401);
  });

  it('a write without the matching X-CSRF-Token is FORBIDDEN', async () => {
    const { app, admin } = await setup();
    for (const token of [undefined, 'wrong']) {
      const response = await app.inject({
        method: 'PATCH',
        url: '/v1/admin/settings',
        headers: { cookie: admin.jar.header(), ...(token ? { 'x-csrf-token': token } : {}) },
        payload: { graceDays: 7 },
      });
      expect(response.statusCode).toBe(403);
    }
  });

  it('8 h idle ends the session', async () => {
    const { app, admin, clock } = await setup();
    clock.advance(8 * 3600_000 + 1000);
    expect(
      (await app.inject({ url: '/v1/admin/users', headers: adminHeaders(admin) })).statusCode,
    ).toBe(401);
  });

  it('Review Focus 5: an admin demoted or suspended since signing in is refused at once', async () => {
    const { app, admin, db } = await setup();
    db.$client
      .prepare("update users set role = 'subscriber' where email = 'admin@nextlevel.test'")
      .run();
    const demoted = await app.inject({ url: '/v1/admin/users', headers: adminHeaders(admin) });
    expect(demoted.json()).toMatchObject({ error: { code: 'FORBIDDEN' } });
    db.$client
      .prepare(
        "update users set role = 'admin', status = 'suspended' where email = 'admin@nextlevel.test'",
      )
      .run();
    const suspended = await app.inject({ url: '/v1/admin/users', headers: adminHeaders(admin) });
    expect(suspended.json()).toMatchObject({ error: { code: 'SUSPENDED' } });
  });
});

describe('admin users (FR-ADM-1, FR-AUTH-7, US-F3)', () => {
  it('search ignores case, filters by status, and pages without repeats', async () => {
    const { app, admin } = await setup();
    await signIn(app, 'subscriber');
    await signIn(app, 'suspended');
    const found = await app.inject({
      url: '/v1/admin/users?q=SUBSCRIB',
      headers: adminHeaders(admin),
    });
    expect(found.json<Users>().items.map((u) => u.email)).toEqual(['subscriber@nextlevel.test']);
    const suspended = await app.inject({
      url: '/v1/admin/users?status=suspended',
      headers: adminHeaders(admin),
    });
    expect(suspended.json<Users>().items.map((u) => u.email)).toEqual(['suspended@nextlevel.test']);
    const seen: string[] = [];
    let cursor: string | null = null;
    do {
      const query: string = cursor ? `&cursor=${encodeURIComponent(cursor)}` : '';
      const page = await app.inject({
        url: `/v1/admin/users?limit=1${query}`,
        headers: adminHeaders(admin),
      });
      const body: Users = page.json<Users>();
      seen.push(...body.items.map((u) => u.email));
      cursor = body.nextCursor;
    } while (cursor);
    expect(seen.sort()).toEqual([
      'admin@nextlevel.test',
      'subscriber@nextlevel.test',
      'suspended@nextlevel.test',
    ]);
  });

  it('FR-ADM-1: a search with _ or % matches those characters literally', async () => {
    const { app, admin, db } = await setup();
    await signIn(app, 'subscriber');
    db.$client
      .prepare(
        "update users set email = 'first_last@example.test' where email = 'subscriber@nextlevel.test'",
      )
      .run();
    const underscore = await app.inject({
      url: '/v1/admin/users?q=first_last',
      headers: adminHeaders(admin),
    });
    expect(underscore.json<Users>().items.map((u) => u.email)).toEqual(['first_last@example.test']);
    const percent = await app.inject({
      url: '/v1/admin/users?q=%25',
      headers: adminHeaders(admin),
    });
    expect(percent.json<Users>().items).toEqual([]);
  });

  it('US-F3: suspend needs a reason, is audited, and the launcher sees it at its next check', async () => {
    const { app, admin } = await setup();
    const player = await signIn(app, 'subscriber');
    const patch = (payload: object) =>
      app.inject({
        method: 'PATCH',
        url: `/v1/admin/users/${player.user.id}`,
        headers: adminHeaders(admin, true),
        payload,
      });
    expect((await patch({ status: 'suspended' })).statusCode).toBe(400);
    expect(
      (await patch({ status: 'suspended', suspendedReason: 'Account sharing' })).statusCode,
    ).toBe(200);
    const entitlement = await app.inject({
      url: '/v1/me/entitlement',
      headers: bearer(player.accessToken),
    });
    expect(entitlement.json()).toMatchObject({ entitlement: { status: 'suspended' } });
    const detail = await app.inject({
      url: `/v1/admin/users/${player.user.id}`,
      headers: adminHeaders(admin),
    });
    expect(detail.json()).toMatchObject({
      status: 'suspended',
      suspendedReason: 'Account sharing',
      audit: [
        {
          action: 'user.suspend',
          actor: { email: 'admin@nextlevel.test' },
          after: { status: 'suspended', suspendedReason: 'Account sharing' },
        },
      ],
    });
  });

  it('an admin cannot demote or suspend themselves (so the last admin always stays)', async () => {
    const { app, admin } = await setup();
    const me = (await app.inject({ url: '/v1/auth/session', headers: adminHeaders(admin) })).json<{
      user: { id: string };
    }>();
    const response = await app.inject({
      method: 'PATCH',
      url: `/v1/admin/users/${me.user.id}`,
      headers: adminHeaders(admin, true),
      payload: { role: 'subscriber' },
    });
    expect(response.statusCode).toBe(409);
    expect(
      response.json<{ error: { details: { reason: string } } }>().error.details.reason,
    ).toMatch(/lastAdmin|self/);
    const player = await signIn(app, 'subscriber');
    await app.inject({
      method: 'PATCH',
      url: `/v1/admin/users/${player.user.id}`,
      headers: adminHeaders(admin, true),
      payload: { role: 'admin' },
    });
    const self = await app.inject({
      method: 'PATCH',
      url: `/v1/admin/users/${me.user.id}`,
      headers: adminHeaders(admin, true),
      payload: { status: 'suspended', suspendedReason: 'test' },
    });
    expect(self.json()).toMatchObject({ error: { code: 'CONFLICT', details: { reason: 'self' } } });
  });

  it("revoking a user's device signs that launcher out", async () => {
    const { app, admin } = await setup();
    const player = await signIn(app, 'subscriber');
    const response = await app.inject({
      method: 'DELETE',
      url: `/v1/admin/users/${player.user.id}/devices/${player.deviceId}`,
      headers: adminHeaders(admin, true),
    });
    expect(response.statusCode).toBe(204);
    const refresh = await app.inject({
      method: 'POST',
      url: '/v1/auth/refresh',
      payload: { refreshToken: player.refreshToken, deviceId: player.deviceId },
    });
    expect(refresh.statusCode).toBe(401);
  });
});

describe('admin settings and audit (FR-ADM-4, FR-ADM-5, C11)', () => {
  it('FR-ADM-4: grace days apply to the next entitlement; the banner and allow-list are normalized', async () => {
    const { app, admin } = await setup();
    const player = await signIn(app, 'subscriber');
    const saved = await app.inject({
      method: 'PATCH',
      url: '/v1/admin/settings',
      headers: adminHeaders(admin, true),
      payload: { graceDays: 3, banner: '   ', allowList: ['A@x.test', 'a@x.test'] },
    });
    expect(saved.json()).toMatchObject({ graceDays: 3, banner: null, allowList: ['a@x.test'] });
    const body = (
      await app.inject({ url: '/v1/me/entitlement', headers: bearer(player.accessToken) })
    ).json<{
      entitlement: { checkedAt: string; offlineUntil: string };
    }>();
    expect(Date.parse(body.entitlement.offlineUntil) - Date.parse(body.entitlement.checkedAt)).toBe(
      3 * 24 * 3600_000,
    );
  });

  it('C11: when the audit entry cannot be written, the change is not made', async () => {
    const { app, admin, db } = await setup();
    db.$client.exec(
      "create trigger no_audit before insert on audit_log begin select raise(abort, 'audit down'); end;",
    );
    const response = await app.inject({
      method: 'PATCH',
      url: '/v1/admin/settings',
      headers: adminHeaders(admin, true),
      payload: { graceDays: 5 },
    });
    expect(response.statusCode).toBe(500);
    const settings = await app.inject({ url: '/v1/admin/settings', headers: adminHeaders(admin) });
    expect(settings.json()).toMatchObject({ graceDays: 14 });
  });

  it('C11: a role change or device revoke whose audit entry fails is not made', async () => {
    const { app, admin, db } = await setup();
    const player = await signIn(app, 'subscriber');
    db.$client.exec(
      "create trigger no_audit before insert on audit_log begin select raise(abort, 'audit down'); end;",
    );
    const role = await app.inject({
      method: 'PATCH',
      url: `/v1/admin/users/${player.user.id}`,
      headers: adminHeaders(admin, true),
      payload: { role: 'admin' },
    });
    expect(role.statusCode).toBe(500);
    const revoke = await app.inject({
      method: 'DELETE',
      url: `/v1/admin/users/${player.user.id}/devices/${player.deviceId}`,
      headers: adminHeaders(admin, true),
    });
    expect(revoke.statusCode).toBe(500);
    expect(
      db.$client.prepare('select role from users where id = ?').pluck().get(player.user.id),
    ).toBe('subscriber');
    expect(
      db.$client
        .prepare('select revoked_at from devices where id = ?')
        .pluck()
        .get(player.deviceId),
    ).toBeNull();
    const refresh = await app.inject({
      method: 'POST',
      url: '/v1/auth/refresh',
      payload: { refreshToken: player.refreshToken, deviceId: player.deviceId },
    });
    expect(refresh.statusCode).toBe(200);
  });

  it('FR-ADM-5: a settings save that changes nothing writes no audit entry', async () => {
    const { app, admin } = await setup();
    await app.inject({
      method: 'PATCH',
      url: '/v1/admin/settings',
      headers: adminHeaders(admin, true),
      payload: { graceDays: 14 },
    });
    const audit = await app.inject({ url: '/v1/admin/audit', headers: adminHeaders(admin) });
    expect(audit.json<{ items: unknown[] }>().items).toEqual([]);
  });

  it('FR-ADM-5: every change is in the audit log with who, what and before/after; filters work', async () => {
    const { app, admin } = await setup();
    const player = await signIn(app, 'subscriber');
    await app.inject({
      method: 'PATCH',
      url: '/v1/admin/settings',
      headers: adminHeaders(admin, true),
      payload: { graceDays: 7 },
    });
    await app.inject({
      method: 'PATCH',
      url: `/v1/admin/users/${player.user.id}`,
      headers: adminHeaders(admin, true),
      payload: { role: 'admin' },
    });
    const all = await app.inject({ url: '/v1/admin/audit', headers: adminHeaders(admin) });
    expect(all.json<{ items: Array<{ action: string }> }>().items.map((e) => e.action)).toEqual([
      'user.role',
      'settings.update',
    ]);
    const byTarget = await app.inject({
      url: `/v1/admin/audit?target=${player.user.id}`,
      headers: adminHeaders(admin),
    });
    expect(byTarget.json()).toMatchObject({
      items: [{ action: 'user.role', before: { role: 'subscriber' }, after: { role: 'admin' } }],
    });
  });
});
