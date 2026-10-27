import type { AdminPlan, Entitlement } from '@nextlevel/shared';
import { afterEach, describe, expect, it } from 'vitest';
import { adminHeaders, adminSignIn } from '../../test/adminSignIn.ts';
import { bearer, signIn } from '../../test/launcherSignIn.ts';
import { createTestApp, FakeClock } from '../../test/testApp.ts';
import type { BillingProvider } from '../billing/provider.ts';
import { stubProvider } from '../billing/stubProvider.ts';
import { STUB_WEBHOOK_SECRET } from '../env.ts';

const closers: Array<() => Promise<void>> = [];
afterEach(async () => {
  for (const close of closers.splice(0)) await close();
});

const BILLING_ON = { BILLING_ENABLED: 'true', BILLING_STUB: '1' };
const MONTH = 'price_stub_month_1990_brl';
const pathOf = (url: string) => new URL(url).pathname;

/** The app's own stub (env BILLING_STUB=1): webhooks arrive through the real route. */
async function stubApp() {
  const test = await createTestApp({ rawEnv: BILLING_ON });
  closers.push(test.close);
  const admin = await adminSignIn(test.app, 'admin');
  await test.app.inject({
    method: 'POST',
    url: '/v1/admin/plans',
    headers: adminHeaders(admin, true),
    payload: {
      slug: 'basic',
      name: 'Basic',
      deviceLimit: 2,
      scopeIds: [],
      stripePriceMonthly: MONTH,
    },
  });
  const launcher = await signIn(test.app, 'subscriber');
  const entitlement = async () =>
    (
      await test.app.inject({ url: '/v1/me/entitlement', headers: bearer(launcher.accessToken) })
    ).json<{ entitlement: Entitlement }>().entitlement;
  const subscribe = async () => {
    const checkout = await test.app.inject({
      method: 'POST',
      url: '/v1/me/billing/checkout',
      headers: bearer(launcher.accessToken),
      payload: { planSlug: 'basic', interval: 'month' },
    });
    const url = checkout.json<{ url: string }>().url;
    const paid = await test.app.inject({ method: 'POST', url: `${pathOf(url)}/pay` });
    expect(paid.statusCode).toBe(303);
    expect(paid.headers.location).toBe('http://localhost:4000/v1/billing/return?result=success');
  };
  const portal = async (action: string) => {
    const portalUrl = (
      await test.app.inject({
        method: 'POST',
        url: '/v1/me/billing/portal',
        headers: bearer(launcher.accessToken),
      })
    ).json<{ url: string }>().url;
    const page = await test.app.inject({ url: pathOf(portalUrl) });
    const form = new RegExp(`action="([^"]+/${action})"`).exec(page.body)?.[1];
    if (!form) throw new Error(`no ${action} button on the portal page`);
    expect((await test.app.inject({ method: 'POST', url: pathOf(form) })).statusCode).toBe(303);
  };
  return { ...test, entitlement, subscribe, portal };
}

describe('Stripe webhooks through the stub (FR-SUB-3, D32)', () => {
  it('paying a checkout makes the user active on a monthly Stripe subscription', async () => {
    const { subscribe, entitlement, db } = await stubApp();
    expect((await entitlement()).status).toBe('none');
    await subscribe();
    expect(await entitlement()).toMatchObject({
      status: 'active',
      plan: { slug: 'basic' },
      subscription: { source: 'stripe', status: 'active', interval: 'month' },
    });
    const events = db.$client.prepare('select type, processed_at as p from stripe_events').all();
    expect(events).toEqual([
      { type: 'checkout.session.completed', p: expect.any(String) as unknown },
      { type: 'customer.subscription.created', p: expect.any(String) as unknown },
    ]);
  });

  it('Portal: payment fails → grace; cancel at period end → active, ending; end now → none', async () => {
    const { subscribe, portal, entitlement } = await stubApp();
    await subscribe();
    await portal('paymentFails');
    expect((await entitlement()).status).toBe('grace');
    await portal('renew');
    await portal('cancelAtPeriodEnd');
    expect(await entitlement()).toMatchObject({
      status: 'active',
      subscription: { cancelAtPeriodEnd: true },
    });
    await portal('endNow');
    expect(await entitlement()).toMatchObject({ status: 'none', subscription: null });
  });
});

/** A stub driven by the test: events are captured and posted by hand. */
async function manualApp(overrides: Partial<BillingProvider> = {}) {
  const clock = new FakeClock();
  const captured: Array<{ raw: string; signature: string }> = [];
  const stub = stubProvider({
    publicUrl: 'http://localhost:4000',
    webhookSecret: STUB_WEBHOOK_SECRET,
    clock: clock.read,
    deliver: (raw, signature) => {
      captured.push({ raw, signature });
      return Promise.resolve();
    },
  });
  let reads = 0;
  const billing: BillingProvider = {
    ...stub,
    getSubscription: (id) => {
      reads += 1;
      return stub.getSubscription(id);
    },
    ...overrides,
  };
  const lines: string[] = [];
  const test = await createTestApp({
    rawEnv: BILLING_ON,
    billing,
    log: { level: 'warn', stream: { write: (line: string) => lines.push(line) } },
  });
  closers.push(test.close);
  test.clock.now = clock.now;
  const admin = await adminSignIn(test.app, 'admin');
  const plan = (
    await test.app.inject({
      method: 'POST',
      url: '/v1/admin/plans',
      headers: adminHeaders(admin, true),
      payload: {
        slug: 'basic',
        name: 'Basic',
        deviceLimit: 2,
        scopeIds: [],
        stripePriceMonthly: MONTH,
      },
    })
  ).json<AdminPlan>();
  const launcher = await signIn(test.app, 'subscriber');
  const post = (event: { raw: string; signature: string }) =>
    test.app.inject({
      method: 'POST',
      url: '/v1/webhooks/stripe',
      headers: { 'content-type': 'application/json', 'stripe-signature': event.signature },
      payload: event.raw,
    });
  const pay = async (priceId = MONTH, userId = launcher.user.id) => {
    const { url } = await stub.createCheckout({
      userId,
      email: 'subscriber@nextlevel.test',
      customerId: null,
      priceId,
      successUrl: 'x',
      cancelUrl: 'x',
    });
    return stub.pay(url.split('/').at(-1) ?? '');
  };
  const rows = () =>
    test.db.$client
      .prepare('select user_id as userId, status, stripe_subscription_id as sid from subscriptions')
      .all();
  return { ...test, stub, captured, post, pay, rows, plan, launcher, lines, reads: () => reads };
}

describe('webhook idempotency and order (Review Focus 1)', () => {
  it('the same event twice: one row, the second answered without reading Stripe', async () => {
    const { captured, post, pay, rows, reads } = await manualApp();
    const sub = await pay();
    const [completed] = captured;
    if (!completed) throw new Error('no event');
    expect((await post(completed)).statusCode).toBe(200);
    const after = reads();
    expect((await post(completed)).statusCode).toBe(200);
    expect(reads()).toBe(after);
    expect(rows()).toEqual([expect.objectContaining({ sid: sub.id, status: 'active' })]);
  });

  it('subscription.created before checkout.session.completed ends in the same single row', async () => {
    const { captured, post, pay, rows, stub } = await manualApp();
    const sub = await pay();
    await stub.act(sub.id, 'cancelAtPeriodEnd');
    for (const event of [...captured].reverse()) expect((await post(event)).statusCode).toBe(200);
    expect(rows()).toEqual([expect.objectContaining({ sid: sub.id, status: 'active' })]);
  });
});

describe('webhook failures (FR-SUB-3, security §4)', () => {
  it('a bad signature is 400 and stores no event', async () => {
    const { captured, post, pay, db } = await manualApp();
    await pay();
    const [event] = captured;
    if (!event) throw new Error('no event');
    const response = await post({ raw: event.raw, signature: 't=1,v1=00' });
    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({ error: { code: 'VALIDATION_FAILED' } });
    expect(db.$client.prepare('select count(*) from stripe_events').pluck().get()).toBe(0);
  });

  it('a processing error is 500 with the event unprocessed; redelivery then succeeds', async () => {
    let failing = true;
    const { captured, post, pay, db, rows, stub } = await manualApp({
      getSubscription: (id) =>
        failing ? Promise.reject(new Error('boom')) : stub.getSubscription(id),
    });
    await pay();
    const [event] = captured;
    if (!event) throw new Error('no event');
    expect((await post(event)).statusCode).toBe(500);
    expect(db.$client.prepare('select processed_at from stripe_events').pluck().all()).toEqual([
      null,
    ]);
    failing = false;
    expect((await post(event)).statusCode).toBe(200);
    expect(rows()).toHaveLength(1);
  });

  it('an unknown price or user is stored as processed, changes nothing, and logs no email', async () => {
    const { captured, post, pay, rows, lines, db } = await manualApp();
    await pay('price_stub_month_500_brl');
    await pay(MONTH, 'no-such-user');
    for (const event of captured) expect((await post(event)).statusCode).toBe(200);
    expect(rows()).toEqual([]);
    expect(
      db.$client
        .prepare('select count(*) from stripe_events where processed_at is null')
        .pluck()
        .get(),
    ).toBe(0);
    const warnings = lines.filter((line) => line.includes('"level":40'));
    expect(warnings.length).toBeGreaterThan(0);
    expect(lines.join('\n')).not.toContain('@');
  });

  it('an unhandled event type is 200 and ignored', async () => {
    const { post, stub, rows, db } = await manualApp();
    const raw = JSON.stringify({
      id: 'evt_x',
      object: 'event',
      type: 'customer.created',
      data: { object: { id: 'cus_x', object: 'customer' } },
    });
    expect((await post({ raw, signature: stub.sign(raw) })).statusCode).toBe(200);
    expect(rows()).toEqual([]);
    expect(db.$client.prepare('select processed_at from stripe_events').pluck().all()).toEqual([
      expect.any(String),
    ]);
  });
});
