import { AppErrorException, type PlansResponse } from '@nextlevel/shared';
import { describe, expect, it } from 'vitest';
import { ApiFailure, type Failure } from './ApiClient.ts';
import { BillingService } from './BillingService.ts';
import { entitlement, setup, storedSession, T0, DAY } from './testing.ts';

const PLANS: PlansResponse = { billingEnabled: true, plans: [] };
const CHECKOUT_URL = 'https://checkout.stripe.com/c/pay/cs_test_1';

async function billingSetup(
  opts: { checkout?: () => Promise<{ url: string }>; portal?: () => Promise<{ url: string }> } = {},
) {
  const t = setup({ session: storedSession(T0 - DAY) });
  t.queues.entitlement.push({
    entitlement: entitlement(T0, { status: 'none', plan: null }),
    banner: null,
  });
  await t.service.start();
  const calls: string[] = [];
  const opened: string[] = [];
  const warnings: Array<[object, string]> = [];
  let tick: (() => void) | null = null;
  let now = T0;
  const billing = new BillingService({
    auth: t.service,
    api: {
      plans: () => {
        calls.push('plans');
        return Promise.resolve(PLANS);
      },
      checkout: (access, body) => {
        calls.push(`checkout:${access}:${body.planSlug}:${body.interval}`);
        return opts.checkout ? opts.checkout() : Promise.resolve({ url: CHECKOUT_URL });
      },
      portal: (access) => {
        calls.push(`portal:${access}`);
        return opts.portal
          ? opts.portal()
          : Promise.resolve({ url: 'https://billing.stripe.com/p/session/x' });
      },
    },
    openBrowser: (url) => {
      opened.push(url);
      return Promise.resolve();
    },
    apiOrigin: 'http://localhost:4000',
    every: (_ms, run) => {
      tick = run;
      return () => {
        tick = null;
      };
    },
    clock: () => new Date(now),
    log: { warn: (context, msg) => warnings.push([context, msg]) },
  });
  const poll = async () => {
    tick?.();
    await t.service.idle();
  };
  return {
    ...t,
    billing,
    calls,
    opened,
    warnings,
    poll,
    polling: () => tick !== null,
    advanceBilling: (ms: number) => {
      now += ms;
    },
  };
}

const none = () => ({ entitlement: entitlement(T0, { status: 'none', plan: null }), banner: null });

describe('checkout from the launcher (US-A2, IA F7)', () => {
  it('opens the browser once and polls until the entitlement turns active (3rd poll)', async () => {
    const b = await billingSetup();
    const waiting = await b.billing.openCheckout('basic', 'month');
    expect(waiting).toMatchObject({ kind: 'signedIn', waitingForPayment: true });
    expect(b.opened).toEqual([CHECKOUT_URL]);
    b.queues.entitlement.push(none(), none());
    await b.poll();
    await b.poll();
    expect(b.service.state()).toMatchObject({ waitingForPayment: true });
    await b.poll();
    expect(b.service.state()).toMatchObject({
      kind: 'signedIn',
      entitlement: { status: 'active' },
      waitingForPayment: false,
    });
    expect(b.polling()).toBe(false);
  });

  it('Review Focus 3: two Choose clicks at once → one checkout, one browser', async () => {
    const b = await billingSetup();
    await Promise.all([
      b.billing.openCheckout('basic', 'month'),
      b.billing.openCheckout('basic', 'month'),
    ]);
    expect(b.calls.filter((c) => c.startsWith('checkout'))).toHaveLength(1);
    expect(b.opened).toHaveLength(1);
  });

  it('after 2 minutes without access the wait ends and Subscribe stays', async () => {
    const b = await billingSetup();
    await b.billing.openCheckout('basic', 'year');
    for (let i = 0; i < 40; i += 1) {
      b.queues.entitlement.push(none());
      b.advanceBilling(3000);
      await b.poll();
    }
    b.advanceBilling(3000);
    await b.poll();
    expect(b.service.state()).toMatchObject({
      entitlement: { status: 'none' },
      waitingForPayment: false,
    });
    expect(b.polling()).toBe(false);
  });

  it('a URL outside Stripe and the API is refused: no browser, logged', async () => {
    const b = await billingSetup({
      checkout: () => Promise.resolve({ url: 'https://evil.test/pay' }),
    });
    await expect(b.billing.openCheckout('basic', 'month')).rejects.toMatchObject({
      error: { code: 'VALIDATION_FAILED' },
    });
    expect(b.opened).toEqual([]);
    expect(b.warnings).toEqual([
      [expect.objectContaining({ code: 'VALIDATION_FAILED' }), expect.any(String)],
    ]);
    expect(JSON.stringify(b.warnings)).not.toContain('evil.test');
  });

  it('CONFLICT subscribed (already paid) refreshes the entitlement instead', async () => {
    const failure: Failure = {
      kind: 'api',
      status: 409,
      code: 'CONFLICT',
      details: { reason: 'subscribed' },
    };
    const b = await billingSetup({ checkout: () => Promise.reject(new ApiFailure(failure)) });
    const state = await b.billing.openCheckout('basic', 'month');
    expect(state).toMatchObject({ kind: 'signedIn', entitlement: { status: 'active' } });
    expect(b.opened).toEqual([]);
  });

  it('offline → API_UNREACHABLE', async () => {
    const b = await billingSetup({
      checkout: () => Promise.reject(new ApiFailure({ kind: 'offline' })),
    });
    const error = await b.billing.openCheckout('basic', 'month').catch((e: unknown) => e);
    expect(error).toBeInstanceOf(AppErrorException);
    expect((error as AppErrorException).error.code).toBe('API_UNREACHABLE');
  });

  it('Choose another plan stops waiting; signing out stops the polling', async () => {
    const b = await billingSetup();
    await b.billing.openCheckout('basic', 'month');
    expect(b.billing.stopWaiting()).toMatchObject({ waitingForPayment: false });
    expect(b.polling()).toBe(false);
    await b.billing.openCheckout('basic', 'month');
    await b.service.signOut();
    await b.poll();
    expect(b.polling()).toBe(false);
    expect(b.service.state()).toMatchObject({ kind: 'signedOut' });
  });
});

describe('plans and portal (S3, S12)', () => {
  it('plans come from the public list; the portal opens billing.stripe.com', async () => {
    const b = await billingSetup();
    expect(await b.billing.plans()).toEqual(PLANS);
    await b.billing.openPortal();
    expect(b.opened).toEqual(['https://billing.stripe.com/p/session/x']);
  });

  it('a portal URL on checkout.stripe.com is refused', async () => {
    const b = await billingSetup({
      portal: () => Promise.resolve({ url: 'https://checkout.stripe.com/c/pay/x' }),
    });
    await expect(b.billing.openPortal()).rejects.toMatchObject({
      error: { code: 'VALIDATION_FAILED' },
    });
    expect(b.opened).toEqual([]);
  });
});
