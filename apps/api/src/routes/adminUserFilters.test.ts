import { afterEach, describe, expect, it, vi } from 'vitest';
import { adminHeaders, adminSignIn } from '../../test/adminSignIn.ts';
import { signIn } from '../../test/launcherSignIn.ts';
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

type Users = { items: Array<{ email: string }>; nextCursor: string | null };

describe('users by plan and access (D38, FR-ADM-1)', () => {
  it('?access= and ?plan= filter by the current subscription; detail lists subscriptions', async () => {
    const test = await createTestApp({ rawEnv: { BILLING_ENABLED: 'true', BILLING_STUB: '1' } });
    closers.push(test.close);
    const { app } = test;
    const admin = await adminSignIn(app, 'admin');
    const subscriber = await signIn(app, 'subscriber');
    await signIn(app, 'suspended').catch(() => undefined);
    const write = { headers: adminHeaders(admin, true) };
    await app.inject({
      ...write,
      method: 'POST',
      url: '/v1/admin/plans',
      payload: { slug: 'basic', name: 'Basic', deviceLimit: 2, scopeIds: [] },
    });
    const emails = async (query: string) =>
      (await app.inject({ url: `/v1/admin/users?${query}`, headers: adminHeaders(admin) }))
        .json<Users>()
        .items.map((u) => u.email)
        .sort();
    expect(await emails('access=none')).toEqual(['subscriber@nextlevel.test']);
    expect(await emails('access=comp')).toEqual([]);
    await app.inject({
      ...write,
      method: 'POST',
      url: `/v1/admin/users/${subscriber.user.id}/grants`,
      payload: { planSlug: 'basic', expiresAt: null, note: 'Friend' },
    });
    expect(await emails('access=comp')).toEqual(['subscriber@nextlevel.test']);
    expect(await emails('access=active')).toEqual([
      'admin@nextlevel.test',
      'subscriber@nextlevel.test',
    ]);
    expect(await emails('access=none')).toEqual([]);
    expect(await emails('plan=basic')).toEqual(['subscriber@nextlevel.test']);
    expect(await emails('plan=default')).toEqual([]);
    expect(await emails('plan=basic&q=nobody')).toEqual([]);
    const plans = (
      await app.inject({ url: '/v1/admin/users', headers: adminHeaders(admin) })
    ).json<{ items: Array<{ email: string; plan: { slug: string; name: string } | null }> }>()
      .items;
    expect(Object.fromEntries(plans.map((u) => [u.email, u.plan]))).toMatchObject({
      'subscriber@nextlevel.test': { slug: 'basic', name: 'Basic' },
      'admin@nextlevel.test': null,
    });
    const detail = await app.inject({
      url: `/v1/admin/users/${subscriber.user.id}`,
      headers: adminHeaders(admin),
    });
    expect(
      detail.json<{ subscriptions: Array<{ source: string; note: string }> }>().subscriptions,
    ).toMatchObject([{ source: 'comp', note: 'Friend' }]);
  });

  it('with billing off everyone allowed is on the Default plan', async () => {
    const { app, admin } = await setup();
    await signIn(app, 'subscriber');
    const emails = async (query: string) =>
      (await app.inject({ url: `/v1/admin/users?${query}`, headers: adminHeaders(admin) }))
        .json<Users>()
        .items.map((u) => u.email);
    expect(await emails('plan=default')).toEqual(['subscriber@nextlevel.test']);
    expect(await emails('access=none')).toEqual([]);
  });
  it('access=grace lists the past-due Stripe subscriber only', async () => {
    const test = await createTestApp({ rawEnv: { BILLING_ENABLED: 'true', BILLING_STUB: '1' } });
    closers.push(test.close);
    const { app, db } = test;
    const admin = await adminSignIn(app, 'admin');
    const subscriber = await signIn(app, 'subscriber');
    const plan = (
      await app.inject({
        method: 'POST',
        url: '/v1/admin/plans',
        headers: adminHeaders(admin, true),
        payload: { slug: 'basic', name: 'Basic', deviceLimit: 2, scopeIds: [] },
      })
    ).json<{ id: string }>();
    const emails = async (query: string) =>
      (await app.inject({ url: `/v1/admin/users?${query}`, headers: adminHeaders(admin) }))
        .json<Users>()
        .items.map((u) => u.email);
    expect(await emails('access=grace')).toEqual([]);
    db.$client
      .prepare(
        `insert into subscriptions (id, user_id, plan_id, source, status, stripe_subscription_id,
           current_period_end, created_at, updated_at)
         values ('s-due', ?, ?, 'stripe', 'past_due', 'sub_due', ?, ?, ?)`,
      )
      .run(
        subscriber.user.id,
        plan.id,
        '2099-01-01T00:00:00.000Z',
        '2026-10-01T00:00:00.000Z',
        '2026-10-01T00:00:00.000Z',
      );
    expect(await emails('access=grace')).toEqual(['subscriber@nextlevel.test']);
    expect(await emails('access=active')).not.toContain('subscriber@nextlevel.test');
  });

  it('FR-ADM-1: a users page reads the subscriptions table once, filtered or not', async () => {
    const test = await createTestApp({ rawEnv: { BILLING_ENABLED: 'true', BILLING_STUB: '1' } });
    closers.push(test.close);
    const { app, db } = test;
    const admin = await adminSignIn(app, 'admin');
    await signIn(app, 'subscriber');
    const prepare = vi.spyOn(db.$client, 'prepare');
    const subscriptionQueries = async (query: string) => {
      prepare.mockClear();
      const response = await app.inject({
        url: `/v1/admin/users${query}`,
        headers: adminHeaders(admin),
      });
      expect(response.statusCode).toBe(200);
      return prepare.mock.calls.filter(([text]) => /from "subscriptions"/.test(text)).length;
    };
    expect(await subscriptionQueries('')).toBe(1);
    expect(await subscriptionQueries('?access=none')).toBe(2);
  });
});
