import Stripe from 'stripe';
import { ApiError, apiError } from '../errors.ts';
import {
  eventOf,
  type BillingProvider,
  type ProviderSubscription,
  type ProviderSubscriptionStatus,
} from './provider.ts';

// Stripe Checkout, Customer Portal and subscriptions (ADR-009, D31: test mode in M8). The API
// version is pinned to the one this SDK ships with; card data never reaches us.

const API_VERSION = Stripe.API_VERSION;

/** Statuses Stripe can't cancel again. */
const ENDED = new Set<string>(['canceled', 'incomplete_expired']);

export interface WarnLog {
  warn(fields: Record<string, unknown>, message?: string): void;
}

/**
 * Every Stripe failure (network, 5xx, rate limit, a request Stripe refused) is "billing
 * unavailable, try again" for the caller, except a 404 the caller maps itself (unknown price).
 * The failure is logged with Stripe's status, type, code and request id: never the key or body.
 */
async function call<T>(
  log: WarnLog | undefined,
  request: () => Promise<T>,
  notFound?: () => Error,
): Promise<T> {
  try {
    return await request();
  } catch (error) {
    if (!(error instanceof Stripe.errors.StripeError)) throw error;
    if (notFound && error.statusCode === 404) throw notFound();
    log?.warn(
      {
        statusCode: error.statusCode,
        type: error.type,
        code: error.code,
        requestId: error.requestId,
      },
      'stripe request failed',
    );
    throw apiError('BILLING_UNAVAILABLE');
  }
}

const STATUSES: readonly ProviderSubscriptionStatus[] = [
  'active',
  'trialing',
  'past_due',
  'canceled',
  'unpaid',
  'incomplete',
  'incomplete_expired',
  'paused',
];

/** A status this code doesn't know gives no access (treated as ended). */
const statusOf = (status: string): ProviderSubscriptionStatus =>
  STATUSES.find((known) => known === status) ?? 'incomplete_expired';

const intervalOf = (interval: string | undefined): 'month' | 'year' | null =>
  interval === 'month' ? 'month' : interval === 'year' ? 'year' : null;

const isoOf = (seconds: number) => new Date(seconds * 1000).toISOString();

function toSubscription(sub: Stripe.Subscription): ProviderSubscription {
  const item = sub.items.data[0];
  if (!item) throw new Error(`Stripe subscription ${sub.id} has no items`);
  return {
    id: sub.id,
    customerId: typeof sub.customer === 'string' ? sub.customer : sub.customer.id,
    userId: sub.metadata['userId'] ?? null,
    status: statusOf(sub.status),
    priceId: item.price.id,
    currentPeriodEnd: isoOf(item.current_period_end),
    cancelAtPeriodEnd: sub.cancel_at_period_end,
  };
}

const unknownPrice = () => apiError('VALIDATION_FAILED', undefined, { reason: 'unknownPrice' });

export function stripeProvider(config: {
  secretKey: string;
  webhookSecret: string;
  /** Tests inject a fake HTTP client; production uses the SDK's own. */
  httpClient?: ReturnType<typeof Stripe.createFetchHttpClient>;
  maxNetworkRetries?: number;
  log?: WarnLog;
}): BillingProvider {
  const stripe = new Stripe(config.secretKey, {
    apiVersion: API_VERSION,
    maxNetworkRetries: config.maxNetworkRetries ?? 2,
    ...(config.httpClient ? { httpClient: config.httpClient } : {}),
  });
  return {
    getPrice: (priceId) =>
      call(
        config.log,
        async () => {
          const price = await stripe.prices.retrieve(priceId);
          return {
            id: price.id,
            amount: price.unit_amount ?? 0,
            currency: price.currency,
            interval: intervalOf(price.recurring?.interval),
            active: price.active,
          };
        },
        unknownPrice,
      ),

    createCheckout: (input) =>
      call(config.log, async () => {
        const session = await stripe.checkout.sessions.create({
          mode: 'subscription',
          line_items: [{ price: input.priceId, quantity: 1 }],
          client_reference_id: input.userId,
          subscription_data: { metadata: { userId: input.userId } },
          ...(input.customerId ? { customer: input.customerId } : { customer_email: input.email }),
          success_url: input.successUrl,
          cancel_url: input.cancelUrl,
        });
        if (!session.url) throw apiError('BILLING_UNAVAILABLE');
        return { id: session.id, url: session.url };
      }),

    expireCheckout: async (sessionId) => {
      try {
        await stripe.checkout.sessions.expire(sessionId);
      } catch (error) {
        // Already completed or expired: nothing left to close.
        if (error instanceof Stripe.errors.StripeInvalidRequestError) return;
        await call(config.log, () => Promise.reject(error as Error));
      }
    },

    createPortal: ({ customerId, returnUrl }) =>
      call(config.log, async () => {
        const session = await stripe.billingPortal.sessions.create({
          customer: customerId,
          return_url: returnUrl,
        });
        return { url: session.url };
      }),

    getSubscription: (id) =>
      call(
        config.log,
        async () => toSubscription(await stripe.subscriptions.retrieve(id)),
        () => apiError('NOT_FOUND', undefined, { reason: 'subscriptionGone' }),
      ),

    cancelNow: async (id) => {
      try {
        await stripe.subscriptions.cancel(id);
      } catch (error) {
        const fail = (): Promise<never> => call(config.log, () => Promise.reject(error as Error));
        if (!(error instanceof Stripe.errors.StripeInvalidRequestError)) return fail();
        // Stripe refuses to cancel one deleted (404) or already canceled (400): both are done.
        if (error.statusCode === 404) return;
        const gone = () => apiError('NOT_FOUND');
        const current = await call(config.log, () => stripe.subscriptions.retrieve(id), gone).catch(
          (failure: unknown) => {
            if (failure instanceof ApiError && failure.code === 'NOT_FOUND') return null;
            throw failure;
          },
        );
        if (current === null || ENDED.has(current.status)) return;
        return fail();
      }
    },

    verifyEvent: (rawBody, signature) => {
      let payload: unknown;
      try {
        payload = stripe.webhooks.constructEvent(rawBody, signature, config.webhookSecret);
      } catch {
        throw apiError('VALIDATION_FAILED', 'Bad webhook signature.');
      }
      const event = eventOf(payload);
      if (!event) throw apiError('VALIDATION_FAILED', 'Not an event.');
      return event;
    },
  };
}
