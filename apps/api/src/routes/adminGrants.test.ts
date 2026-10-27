import type {
  AdminPlan,
  AdminSubscription,
  AdminUserDetail,
  AuditEntry,
  Entitlement,
} from '@nextlevel/shared';
import { afterEach, describe, expect, it } from 'vitest';
import { adminHeaders, adminSignIn } from '../../test/adminSignIn.ts';
import { fakeBilling, PRICES } from '../../test/fakeBilling.ts';
import { bearer, signIn } from '../../test/launcherSignIn.ts';
import { createTestApp } from '../../test/testApp.ts';

const closers: Array<() => Promise<void>> = [];
afterEach(async () => {
  for (const close of closers.splice(0)) await close();
});

const BILLING_ON = { BILLING_ENABLED: 'true', BILLING_STUB: '1' };
const UNTIL = '2027-01-31T00:00:00.000Z';

async function setup() {
  const test = await createTestApp({
    rawEnv: BILLING_ON,
    billing: fakeBilling(Object.values(PRICES)),
  });
  closers.push(test.close);
  const admin = await adminSignIn(test.app, 'admin');
  const send = (method: 'GET' | 'POST' | 'PATCH' | 'DELETE', url: string, payload?: object) =>
    test.app.inject({
      method,
      url,
      headers: adminHeaders(admin, method !== 'GET'),
      ...(payload === undefined ? {} : { payload }),
    });
  const launcher = await signIn(test.app, 'subscriber');
  const userId = launcher.user.id;
  const plan = (
    await send('POST', '/v1/admin/plans', {
      slug: 'basic',
      name: 'Basic',
      deviceLimit: 2,
      scopeIds: [],
    })
  ).json<AdminPlan>();
  const entitlement = async () =>
    (
      await test.app.inject({
        url: '/v1/me/entitlement',
        headers: bearer(launcher.accessToken),
      })
    ).json<{ entitlement: Entitlement }>().entitlement;
  const grant = (body: object = {}) =>
    send('POST', `/v1/admin/users/${userId}/grants`, {
      planSlug: 'basic',
      expiresAt: UNTIL,
      note: 'Beta tester',
      ...body,
    });
  return { ...test, send, userId, plan, entitlement, grant };
}

describe('complimentary grants (US-F2, FR-SUB-4, D35)', () => {
  it('US-F2: a grant until 2027-01-31 gives access on its plan until then, not after', async () => {
    const { app, grant, entitlement, clock } = await setup();
    expect((await entitlement()).status).toBe('none');
    const response = await grant();
    expect(response.statusCode).toBe(200);
    expect(response.json<AdminSubscription>()).toMatchObject({
      source: 'comp',
      status: 'active',
      plan: { slug: 'basic', name: 'Basic' },
      periodEnd: UNTIL,
      grantedBy: { email: 'admin@nextlevel.test' },
      note: 'Beta tester',
    });
    expect(await entitlement()).toMatchObject({
      status: 'active',
      plan: { slug: 'basic' },
      subscription: { source: 'comp', periodEnd: UNTIL },
    });
    // Months later the tokens have expired too: the entitlement comes with a new sign-in.
    clock.now = new Date('2027-02-01T00:00:00.000Z');
    expect((await signIn(app, 'subscriber', 'PC 2')).entitlement.status).toBe('none');
  });

  it('a user paying through Stripe cannot get a grant (CONFLICT subscribed)', async () => {
    const { grant, db, userId, plan } = await setup();
    db.$client
      .prepare(
        `insert into subscriptions (id, user_id, plan_id, source, status, stripe_subscription_id,
           created_at, updated_at)
         values ('s-stripe', ?, ?, 'stripe', 'past_due', 'sub_1', ?, ?)`,
      )
      .run(userId, plan.id, '2026-10-01T00:00:00.000Z', '2026-10-01T00:00:00.000Z');
    expect((await grant()).json()).toMatchObject({
      error: { code: 'CONFLICT', details: { reason: 'subscribed' } },
    });
  });

  it('an archived plan cannot be granted; an end in the past is VALIDATION_FAILED', async () => {
    const { grant, send, plan } = await setup();
    expect((await grant({ expiresAt: '2026-10-24T00:00:00.000Z' })).json()).toMatchObject({
      error: { code: 'VALIDATION_FAILED' },
    });
    expect((await grant({ planSlug: 'nope' })).json()).toMatchObject({
      error: { code: 'VALIDATION_FAILED' },
    });
    await send('PATCH', `/v1/admin/plans/${plan.id}`, { archived: true });
    expect((await grant()).json()).toMatchObject({
      error: { code: 'CONFLICT', details: { reason: 'archived' } },
    });
  });

  it('revoking ends access and both changes are audited against the subscription', async () => {
    const { grant, send, userId, entitlement } = await setup();
    const sub = (await grant({ expiresAt: null })).json<AdminSubscription>();
    expect((await entitlement()).subscription).toMatchObject({ periodEnd: null });
    const revoke = await send('DELETE', `/v1/admin/users/${userId}/grants/${sub.id}`);
    expect(revoke.statusCode).toBe(204);
    expect((await entitlement()).status).toBe('none');
    const audit = (await send('GET', `/v1/admin/audit?target=${sub.id}`)).json<{
      items: AuditEntry[];
    }>().items;
    expect(audit.map((e) => [e.action, e.targetType])).toEqual([
      ['grant.revoke', 'subscription'],
      ['grant.create', 'subscription'],
    ]);
    expect(audit[0]?.after).toMatchObject({ status: 'canceled' });
    const again = await send('DELETE', `/v1/admin/users/${userId}/grants/${sub.id}`);
    expect(again.json()).toMatchObject({
      error: { code: 'CONFLICT', details: { reason: 'notActive' } },
    });
    const other = await send('DELETE', `/v1/admin/users/someone-else/grants/${sub.id}`);
    expect(other.statusCode).toBe(404);
  });

  it('a new grant replaces the active one: old canceled, one audit entry each', async () => {
    const { grant, send, userId } = await setup();
    const first = (await grant()).json<AdminSubscription>();
    const second = (await grant({ expiresAt: null, note: 'Extended' })).json<AdminSubscription>();
    const detail = (await send('GET', `/v1/admin/users/${userId}`)).json<AdminUserDetail>();
    expect(detail.subscriptions.map((s) => [s.id, s.status])).toEqual([
      [second.id, 'active'],
      [first.id, 'canceled'],
    ]);
    const audit = (await send('GET', '/v1/admin/audit'))
      .json<{ items: AuditEntry[] }>()
      .items.filter((e) => e.targetType === 'subscription');
    expect(audit.map((e) => [e.action, e.targetId]).sort()).toEqual(
      [
        ['grant.create', first.id],
        ['grant.create', second.id],
        ['grant.revoke', first.id],
      ].sort(),
    );
  });

  it('Review Focus 5: an archived plan still names the plan for the people on it', async () => {
    const { grant, send, plan, entitlement } = await setup();
    await grant();
    await send('PATCH', `/v1/admin/plans/${plan.id}`, { archived: true });
    expect(await entitlement()).toMatchObject({ status: 'active', plan: { slug: 'basic' } });
    const plans = (await send('GET', '/v1/admin/plans')).json<AdminPlan[]>();
    expect(plans.find((p) => p.slug === 'basic')?.subscribers).toBe(1);
  });

  it('grant routes are admin only', async () => {
    const { app, userId } = await setup();
    const response = await app.inject({
      method: 'POST',
      url: `/v1/admin/users/${userId}/grants`,
      payload: { planSlug: 'basic', expiresAt: null, note: 'x' },
    });
    expect(response.statusCode).toBe(401);
  });
});
