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

const STUB_ON = { BILLING_ENABLED: 'true', BILLING_STUB: '1' };
const MONTH = 'price_stub_month_1990_brl';

async function setup(opts: { rawEnv?: Record<string, string>; billing?: BillingProvider } = {}) {
  const test = await createTestApp({
    rawEnv: opts.rawEnv ?? STUB_ON,
    ...(opts.billing ? { billing: opts.billing } : {}),
  });
  closers.push(test.close);
  const admin = await adminSignIn(test.app, 'admin');
  const adminSend = (method: 'POST' | 'PATCH', url: string, payload: object) =>
    test.app.inject({ method, url, headers: adminHeaders(admin, true), payload });
  const plan = (
    await adminSend('POST', '/v1/admin/plans', {
      slug: 'basic',
      name: 'Basic',
      deviceLimit: 2,
      scopeIds: [],
      ...(opts.billing ? {} : { stripePriceMonthly: MONTH }),
    })
  ).json<AdminPlan>();
  const launcher = await signIn(test.app, 'subscriber');
  const call = (path: 'checkout' | 'portal', payload?: object) =>
    test.app.inject({
      method: 'POST',
      url: `/v1/me/billing/${path}`,
      headers: bearer(launcher.accessToken),
      ...(payload ? { payload } : {}),
    });
  const checkout = (body: object = {}) =>
    call('checkout', { planSlug: 'basic', interval: 'month', ...body });
  return { ...test, adminSend, plan, launcher, call, checkout };
}

function insertStripeRow(
  db: Awaited<ReturnType<typeof setup>>['db'],
  userId: string,
  planId: string,
  status: string,
) {
  db.$client
    .prepare(
      `insert into subscriptions (id, user_id, plan_id, source, status, stripe_customer_id,
         stripe_subscription_id, created_at, updated_at)
       values (?, ?, ?, 'stripe', ?, 'cus_stub_9', ?, '2026-10-01T00:00:00.000Z', '2026-10-01T00:00:00.000Z')`,
    )
    .run(`s-${status}`, userId, planId, status, `sub_${status}`);
}

describe('checkout (FR-SUB-2, S3)', () => {
  it('a monthly checkout with the stub answers a page on the API origin', async () => {
    const { checkout } = await setup();
    const response = await checkout();
    expect(response.statusCode).toBe(200);
    expect(response.json<{ url: string }>().url).toMatch(
      /^http:\/\/localhost:4000\/v1\/billing\/stub\/checkout\/cs_stub_/,
    );
  });

  it('billing off is CONFLICT billingOff', async () => {
    const { checkout } = await setup({ rawEnv: { BILLING_STUB: '1' } });
    expect((await checkout()).json()).toMatchObject({
      error: { code: 'CONFLICT', details: { reason: 'billingOff' } },
    });
  });

  it('an unknown, archived or price-less plan is NOT_FOUND', async () => {
    const { checkout, adminSend, plan } = await setup();
    expect((await checkout({ interval: 'year' })).statusCode).toBe(404);
    expect((await checkout({ planSlug: 'nope' })).statusCode).toBe(404);
    await adminSend('PATCH', `/v1/admin/plans/${plan.id}`, { archived: true });
    expect((await checkout()).statusCode).toBe(404);
  });

  it('Review Focus 3: someone with access-giving billing or a comp grant is CONFLICT subscribed', async () => {
    const { checkout, adminSend, launcher, db, plan } = await setup();
    await adminSend('POST', `/v1/admin/users/${launcher.user.id}/grants`, {
      planSlug: 'basic',
      expiresAt: null,
      note: 'Friend',
    });
    expect((await checkout()).json()).toMatchObject({
      error: { code: 'CONFLICT', details: { reason: 'subscribed' } },
    });
    db.$client.prepare('delete from subscriptions').run();
    insertStripeRow(db, launcher.user.id, plan.id, 'past_due');
    expect((await checkout()).json()).toMatchObject({
      error: { details: { reason: 'subscribed' } },
    });
  });

  it('a provider that is down is 503 BILLING_UNAVAILABLE', async () => {
    const billing = fakeBilling([], {
      createCheckout: () => Promise.reject(apiError('BILLING_UNAVAILABLE')),
      getPrice: (id) =>
        Promise.resolve({ id, amount: 1990, currency: 'brl', interval: 'month', active: true }),
    });
    const { checkout, adminSend, plan } = await setup({ billing });
    await adminSend('PATCH', `/v1/admin/plans/${plan.id}`, { stripePriceMonthly: 'price_m' });
    const response = await checkout();
    expect(response.statusCode).toBe(503);
    expect(response.json()).toMatchObject({ error: { code: 'BILLING_UNAVAILABLE' } });
  });

  it('a suspended user is SUSPENDED', async () => {
    const { checkout, call, db, launcher } = await setup();
    db.$client.prepare("update users set status = 'suspended' where id = ?").run(launcher.user.id);
    expect((await checkout()).json()).toMatchObject({ error: { code: 'SUSPENDED' } });
    expect((await call('portal')).json()).toMatchObject({ error: { code: 'SUSPENDED' } });
  });

  it('without sign-in billing routes are UNAUTHENTICATED', async () => {
    const { app } = await setup();
    const response = await app.inject({ method: 'POST', url: '/v1/me/billing/portal' });
    expect(response.statusCode).toBe(401);
  });
});

describe('customer portal (FR-SUB-2)', () => {
  it('without a Stripe customer the portal is CONFLICT noCustomer; with one it answers a page', async () => {
    const { call, db, launcher, plan } = await setup();
    expect((await call('portal')).json()).toMatchObject({
      error: { code: 'CONFLICT', details: { reason: 'noCustomer' } },
    });
    insertStripeRow(db, launcher.user.id, plan.id, 'canceled');
    expect((await call('portal')).json<{ url: string }>().url).toBe(
      'http://localhost:4000/v1/billing/stub/portal/cus_stub_9',
    );
  });

  it('billing off is CONFLICT billingOff', async () => {
    const { call } = await setup({ rawEnv: { BILLING_STUB: '1' } });
    expect((await call('portal')).json()).toMatchObject({
      error: { details: { reason: 'billingOff' } },
    });
  });
});

describe('return page (IA F7)', () => {
  it('speaks Portuguese to pt-BR browsers and English otherwise', async () => {
    const { app } = await setup();
    const pt = await app.inject({
      url: '/v1/billing/return?result=success',
      headers: { 'accept-language': 'pt-BR,pt;q=0.9,en;q=0.8' },
    });
    expect(pt.statusCode).toBe(200);
    expect(pt.headers['content-type']).toMatch(/text\/html/);
    expect(pt.body).toContain('lang="pt-BR"');
    expect(pt.body).toContain('NextLevel');
    const en = await app.inject({ url: '/v1/billing/return?result=cancelled' });
    expect(en.body).toContain('lang="en"');
    expect(en.body).not.toEqual(pt.body);
  });

  it('an unknown result is 400', async () => {
    const { app } = await setup();
    expect((await app.inject({ url: '/v1/billing/return?result=hacked' })).statusCode).toBe(400);
  });
});
