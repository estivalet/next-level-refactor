import { afterEach, describe, expect, it } from 'vitest';
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
});
