import Stripe from 'stripe';
import { describe, expect, it } from 'vitest';
import { stripeProvider } from './stripeProvider.ts';

// The real SDK with a fake HTTP client: no network (test strategy). Fixtures are hand-written
// in Stripe's shapes with fake ids and *.test emails.

const WEBHOOK_SECRET = 'whsec_test_fixture';

const SUBSCRIPTION = {
  id: 'sub_fake1',
  object: 'subscription',
  customer: 'cus_fake1',
  status: 'active',
  cancel_at_period_end: false,
  metadata: { userId: 'u1' },
  items: {
    object: 'list',
    data: [
      {
        id: 'si_fake1',
        object: 'subscription_item',
        current_period_end: 1795003200, // 2026-11-18T12:00:00Z
        price: { id: 'price_fake_m', object: 'price' },
      },
    ],
  },
};

interface Sent {
  method: string;
  path: string;
  body: URLSearchParams;
}

function setup(respond: (sent: Sent) => { status: number; body: unknown } | Error) {
  const sent: Sent[] = [];
  const warnings: Array<Record<string, unknown>> = [];
  const fakeFetch = (input: string | URL | Request, init?: RequestInit): Promise<Response> => {
    const url = new URL(input instanceof Request ? input.url : String(input));
    const request = {
      method: init?.method ?? 'GET',
      path: url.pathname,
      body: new URLSearchParams(typeof init?.body === 'string' ? init.body : url.search),
    };
    sent.push(request);
    const answer = respond(request);
    if (answer instanceof Error) return Promise.reject(answer);
    return Promise.resolve(
      new Response(JSON.stringify(answer.body), {
        status: answer.status,
        headers: { 'content-type': 'application/json', 'request-id': 'req_fake' },
      }),
    );
  };
  const provider = stripeProvider({
    secretKey: 'sk_test_fake',
    webhookSecret: WEBHOOK_SECRET,
    httpClient: Stripe.createFetchHttpClient(fakeFetch),
    maxNetworkRetries: 0,
    log: { warn: (fields: Record<string, unknown>) => warnings.push(fields) },
  });
  return { provider, sent, warnings };
}

describe('Stripe provider (ADR-009, D31)', () => {
  it('maps a Stripe subscription, period end from its first item', async () => {
    const { provider } = setup(() => ({ status: 200, body: SUBSCRIPTION }));
    expect(await provider.getSubscription('sub_fake1')).toEqual({
      id: 'sub_fake1',
      customerId: 'cus_fake1',
      userId: 'u1',
      status: 'active',
      priceId: 'price_fake_m',
      currentPeriodEnd: '2026-11-18T12:00:00.000Z',
      cancelAtPeriodEnd: false,
    });
  });

  it('maps a recurring price; an unknown price is VALIDATION_FAILED unknownPrice', async () => {
    const { provider } = setup((sent) =>
      sent.path.endsWith('price_fake_m')
        ? {
            status: 200,
            body: {
              id: 'price_fake_m',
              object: 'price',
              active: true,
              currency: 'brl',
              unit_amount: 1990,
              recurring: { interval: 'month', interval_count: 1 },
            },
          }
        : {
            status: 404,
            body: { error: { type: 'invalid_request_error', code: 'resource_missing' } },
          },
    );
    expect(await provider.getPrice('price_fake_m')).toEqual({
      id: 'price_fake_m',
      amount: 1990,
      currency: 'brl',
      interval: 'month',
      active: true,
    });
    await expect(provider.getPrice('price_missing')).rejects.toMatchObject({
      code: 'VALIDATION_FAILED',
      details: { reason: 'unknownPrice' },
    });
  });

  it('checkout sends the user id as metadata and reuses a known customer', async () => {
    const { provider, sent } = setup(() => ({
      status: 200,
      body: {
        id: 'cs_fake',
        object: 'checkout.session',
        url: 'https://checkout.stripe.com/c/fake',
      },
    }));
    const input = {
      userId: 'u1',
      email: 'subscriber@nextlevel.test',
      priceId: 'price_fake_m',
      successUrl: 'http://localhost:4000/v1/billing/return?result=success',
      cancelUrl: 'http://localhost:4000/v1/billing/return?result=cancelled',
    };
    expect(await provider.createCheckout({ ...input, customerId: 'cus_fake1' })).toEqual({
      id: 'cs_fake',
      url: 'https://checkout.stripe.com/c/fake',
    });
    await provider.createCheckout({ ...input, customerId: null });
    const [known, fresh] = sent.map((s) => s.body);
    expect(sent[0]?.path).toBe('/v1/checkout/sessions');
    expect(known?.get('mode')).toBe('subscription');
    expect(known?.get('line_items[0][price]')).toBe('price_fake_m');
    expect(known?.get('client_reference_id')).toBe('u1');
    expect(known?.get('subscription_data[metadata][userId]')).toBe('u1');
    expect(known?.get('customer')).toBe('cus_fake1');
    expect(known?.has('customer_email')).toBe(false);
    expect(fresh?.get('customer_email')).toBe('subscriber@nextlevel.test');
    expect(fresh?.has('customer')).toBe(false);
  });

  it('a network error or a Stripe 5xx is BILLING_UNAVAILABLE', async () => {
    const down = setup(() => new TypeError('fetch failed'));
    await expect(down.provider.getSubscription('sub_fake1')).rejects.toMatchObject({
      code: 'BILLING_UNAVAILABLE',
    });
    const failing = setup(() => ({ status: 500, body: { error: { type: 'api_error' } } }));
    await expect(
      failing.provider.createPortal({ customerId: 'cus_fake1', returnUrl: 'http://x.test' }),
    ).rejects.toMatchObject({ code: 'BILLING_UNAVAILABLE' });
  });

  it('a Stripe failure is logged with its status, type, code and request id, no secrets', async () => {
    const { provider, warnings } = setup(() => ({
      status: 400,
      body: {
        error: {
          type: 'invalid_request_error',
          message: 'No configuration provided for the customer portal.',
        },
      },
    }));
    await expect(
      provider.createPortal({ customerId: 'cus_fake1', returnUrl: 'http://x.test' }),
    ).rejects.toMatchObject({ code: 'BILLING_UNAVAILABLE' });
    expect(warnings).toEqual([
      expect.objectContaining({
        statusCode: 400,
        type: 'StripeInvalidRequestError',
        requestId: 'req_fake',
      }),
    ]);
    expect(JSON.stringify(warnings)).not.toContain('sk_test');
  });

  it('expiring a checkout session posts expire; one already completed or expired is fine', async () => {
    const { provider, sent } = setup((request) =>
      request.path.includes('cs_done')
        ? { status: 400, body: { error: { type: 'invalid_request_error', message: 'complete' } } }
        : { status: 200, body: { id: 'cs_open', object: 'checkout.session', status: 'expired' } },
    );
    await provider.expireCheckout('cs_open');
    await provider.expireCheckout('cs_done');
    expect(sent.map((s) => [s.method, s.path])).toEqual([
      ['POST', '/v1/checkout/sessions/cs_open/expire'],
      ['POST', '/v1/checkout/sessions/cs_done/expire'],
    ]);
  });

  it('cancelNow deletes the subscription', async () => {
    const { provider, sent } = setup(() => ({
      status: 200,
      body: { ...SUBSCRIPTION, status: 'canceled' },
    }));
    await provider.cancelNow('sub_fake1');
    expect(sent.map((s) => [s.method, s.path])).toEqual([
      ['DELETE', '/v1/subscriptions/sub_fake1'],
    ]);
  });

  it('verifies a signed event and names its subscription; a bad signature is refused', () => {
    const { provider } = setup(() => new Error('no calls'));
    const raw = JSON.stringify({
      id: 'evt_fake1',
      object: 'event',
      type: 'checkout.session.completed',
      data: { object: { id: 'cs_fake', object: 'checkout.session', subscription: 'sub_fake1' } },
    });
    const header = Stripe.webhooks.generateTestHeaderString({
      payload: raw,
      secret: WEBHOOK_SECRET,
    });
    expect(provider.verifyEvent(Buffer.from(raw), header)).toEqual({
      id: 'evt_fake1',
      type: 'checkout.session.completed',
      subscriptionId: 'sub_fake1',
    });
    expect(() => provider.verifyEvent(Buffer.from(`${raw} `), header)).toThrow(
      expect.objectContaining({ code: 'VALIDATION_FAILED' }) as Error,
    );
  });
  it('a subscription Stripe no longer has (404) is NOT_FOUND subscriptionGone', async () => {
    const { provider } = setup(() => ({
      status: 404,
      body: { error: { type: 'invalid_request_error', code: 'resource_missing' } },
    }));
    await expect(provider.getSubscription('sub_gone')).rejects.toMatchObject({
      code: 'NOT_FOUND',
      details: { reason: 'subscriptionGone' },
    });
  });

  it('cancelNow of a subscription already canceled (or gone) at Stripe is done', async () => {
    const { provider, sent } = setup((request) => {
      if (request.path.endsWith('sub_gone')) {
        return {
          status: 404,
          body: { error: { type: 'invalid_request_error', code: 'resource_missing' } },
        };
      }
      if (request.method === 'DELETE') {
        return {
          status: 400,
          body: { error: { type: 'invalid_request_error', message: 'already canceled' } },
        };
      }
      return { status: 200, body: { ...SUBSCRIPTION, status: 'canceled' } };
    });
    await provider.cancelNow('sub_fake1');
    await provider.cancelNow('sub_gone');
    expect(sent.map((s) => [s.method, s.path])).toEqual([
      ['DELETE', '/v1/subscriptions/sub_fake1'],
      ['GET', '/v1/subscriptions/sub_fake1'],
      ['DELETE', '/v1/subscriptions/sub_gone'],
    ]);
  });

  it('cancelNow refused while the subscription is still live is BILLING_UNAVAILABLE', async () => {
    const { provider } = setup((request) =>
      request.method === 'DELETE'
        ? { status: 400, body: { error: { type: 'invalid_request_error', message: 'nope' } } }
        : { status: 200, body: SUBSCRIPTION },
    );
    await expect(provider.cancelNow('sub_fake1')).rejects.toMatchObject({
      code: 'BILLING_UNAVAILABLE',
    });
  });
});
