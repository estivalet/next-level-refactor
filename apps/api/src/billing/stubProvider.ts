import { createHmac, timingSafeEqual } from 'node:crypto';
import { apiError } from '../errors.ts';
import {
  eventOf,
  type BillingEvent,
  type BillingProvider,
  type CheckoutInput,
  type ProviderPrice,
  type ProviderSubscription,
} from './provider.ts';

// The billing stub (D32, BILLING_STUB=1, never in production): a fake Checkout and Portal on the
// API itself that keep their state in memory and send Stripe-shaped, Stripe-signed webhooks to
// the API. Tests, CI and demos need no Stripe account. An API restart forgets everything.

export type StubAction =
  'cancelAtPeriodEnd' | 'resume' | 'switch' | 'paymentFails' | 'renew' | 'endNow';

export interface StubSession extends CheckoutInput {
  id: string;
}

export interface StubBilling extends BillingProvider {
  session(id: string): StubSession | undefined;
  /** Pays an open checkout session: creates the customer and the subscription. */
  pay(sessionId: string): Promise<ProviderSubscription>;
  subscriptionsOf(customerId: string): ProviderSubscription[];
  /** A Portal action; `switch` takes the new price id. */
  act(subscriptionId: string, action: StubAction, priceId?: string): Promise<void>;
  /** A `Stripe-Signature` header for `payload` at the clock's time. */
  sign(payload: string): string;
}

const PRICE = /^price_stub_(month|year)_(\d{1,9})_([a-z]{3})$/;
const TOLERANCE_S = 300;

function addInterval(iso: string, interval: 'month' | 'year'): string {
  const date = new Date(iso);
  if (interval === 'month') date.setUTCMonth(date.getUTCMonth() + 1);
  else date.setUTCFullYear(date.getUTCFullYear() + 1);
  return date.toISOString();
}

function parsePrice(id: string): ProviderPrice | null {
  const match = PRICE.exec(id);
  if (!match) return null;
  const [, interval, amount, currency] = match;
  return {
    id,
    amount: Number(amount),
    currency: currency ?? '',
    interval: interval === 'year' ? 'year' : 'month',
    active: true,
  };
}

export function stubProvider(deps: {
  publicUrl: string;
  webhookSecret: string;
  clock: () => Date;
  deliver: (raw: string, signature: string) => Promise<void>;
}): StubBilling {
  const sessions = new Map<string, StubSession>();
  const subscriptions = new Map<string, ProviderSubscription>();
  let counter = 0;
  const nextId = (prefix: string) => `${prefix}_stub_${String(++counter)}`;

  const hmac = (timestamp: string, payload: string) =>
    createHmac('sha256', deps.webhookSecret).update(`${timestamp}.${payload}`).digest('hex');

  const sign = (payload: string) => {
    const timestamp = String(Math.floor(deps.clock().getTime() / 1000));
    return `t=${timestamp},v1=${hmac(timestamp, payload)}`;
  };

  const emit = (type: string, object: Record<string, unknown>) => {
    const raw = JSON.stringify({
      id: nextId('evt'),
      object: 'event',
      type,
      created: Math.floor(deps.clock().getTime() / 1000),
      data: { object },
    });
    return deps.deliver(raw, sign(raw));
  };

  const subscriptionObject = (sub: ProviderSubscription) => ({
    id: sub.id,
    object: 'subscription',
  });
  const invoiceObject = (sub: ProviderSubscription) => ({
    id: nextId('in'),
    object: 'invoice',
    parent: { subscription_details: { subscription: sub.id } },
  });

  const subscription = (id: string) => {
    const sub = subscriptions.get(id);
    if (!sub) throw apiError('NOT_FOUND', 'No such stub subscription.');
    return sub;
  };

  const intervalOf = (sub: ProviderSubscription) => parsePrice(sub.priceId)?.interval ?? 'month';

  return {
    getPrice: (priceId) => {
      const price = parsePrice(priceId);
      if (!price) {
        return Promise.reject(apiError('VALIDATION_FAILED', undefined, { reason: 'unknownPrice' }));
      }
      return Promise.resolve(price);
    },

    createCheckout: (input) => {
      const id = nextId('cs');
      sessions.set(id, { ...input, id });
      return Promise.resolve({ url: `${deps.publicUrl}/v1/billing/stub/checkout/${id}` });
    },

    createPortal: ({ customerId }) =>
      Promise.resolve({ url: `${deps.publicUrl}/v1/billing/stub/portal/${customerId}` }),

    getSubscription: (id) => Promise.resolve().then(() => ({ ...subscription(id) })),

    cancelNow: async (id) => {
      const sub = subscription(id);
      sub.status = 'canceled';
      await emit('customer.subscription.deleted', subscriptionObject(sub));
    },

    verifyEvent: (rawBody, header) => {
      const parts = new Map(
        header.split(',').map((part) => {
          const [key = '', ...rest] = part.split('=');
          return [key.trim(), rest.join('=')] as const;
        }),
      );
      const timestamp = parts.get('t') ?? '';
      const given = Buffer.from(parts.get('v1') ?? '', 'hex');
      const expected = Buffer.from(hmac(timestamp, rawBody.toString('utf8')), 'hex');
      const age = Math.abs(deps.clock().getTime() / 1000 - Number(timestamp));
      if (
        !/^\d+$/.test(timestamp) ||
        given.length !== expected.length ||
        !timingSafeEqual(given, expected) ||
        age > TOLERANCE_S
      ) {
        throw apiError('VALIDATION_FAILED', 'Bad webhook signature.');
      }
      const event: BillingEvent | null = eventOf(JSON.parse(rawBody.toString('utf8')));
      if (!event) throw apiError('VALIDATION_FAILED', 'Not an event.');
      return event;
    },

    session: (id) => sessions.get(id),

    pay: async (sessionId) => {
      const session = sessions.get(sessionId);
      if (!session) throw apiError('NOT_FOUND', 'No such stub checkout session.');
      sessions.delete(sessionId);
      const now = deps.clock().toISOString();
      const sub: ProviderSubscription = {
        id: nextId('sub'),
        customerId: session.customerId ?? nextId('cus'),
        userId: session.userId,
        status: 'active',
        priceId: session.priceId,
        currentPeriodEnd: addInterval(now, parsePrice(session.priceId)?.interval ?? 'month'),
        cancelAtPeriodEnd: false,
      };
      subscriptions.set(sub.id, sub);
      await emit('checkout.session.completed', {
        id: session.id,
        object: 'checkout.session',
        subscription: sub.id,
      });
      await emit('customer.subscription.created', subscriptionObject(sub));
      return { ...sub };
    },

    subscriptionsOf: (customerId) =>
      [...subscriptions.values()].filter((sub) => sub.customerId === customerId),

    act: async (id, action, priceId) => {
      const sub = subscription(id);
      switch (action) {
        case 'cancelAtPeriodEnd':
        case 'resume':
          sub.cancelAtPeriodEnd = action === 'cancelAtPeriodEnd';
          return emit('customer.subscription.updated', subscriptionObject(sub));
        case 'switch':
          if (!priceId || !parsePrice(priceId)) throw apiError('VALIDATION_FAILED');
          sub.priceId = priceId;
          return emit('customer.subscription.updated', subscriptionObject(sub));
        case 'paymentFails':
          sub.status = 'past_due';
          return emit('invoice.payment_failed', invoiceObject(sub));
        case 'renew':
          sub.status = 'active';
          sub.currentPeriodEnd = addInterval(sub.currentPeriodEnd, intervalOf(sub));
          return emit('invoice.paid', invoiceObject(sub));
        case 'endNow':
          sub.status = 'canceled';
          return emit('customer.subscription.deleted', subscriptionObject(sub));
      }
    },

    sign,
  };
}
