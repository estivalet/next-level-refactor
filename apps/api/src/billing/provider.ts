// The billing provider behind the API (ADR-009, D31/D32): Stripe in test mode, or the stub.
// Every method rejects with `BILLING_UNAVAILABLE` when the provider can't be reached.

/** A recurring price as the provider reports it: minor units, lowercase ISO 4217 currency. */
export interface ProviderPrice {
  id: string;
  amount: number;
  currency: string;
  /** Null for a one-time price. */
  interval: 'month' | 'year' | null;
  active: boolean;
}

export type ProviderSubscriptionStatus =
  | 'active'
  | 'trialing'
  | 'past_due'
  | 'canceled'
  | 'unpaid'
  | 'incomplete'
  | 'incomplete_expired'
  | 'paused';

export interface ProviderSubscription {
  id: string;
  customerId: string;
  /** `metadata.userId`, set by our checkout; null when someone made it elsewhere. */
  userId: string | null;
  status: ProviderSubscriptionStatus;
  priceId: string;
  currentPeriodEnd: string;
  cancelAtPeriodEnd: boolean;
}

/** A verified webhook event: only a trigger to re-read the subscription it names. */
export interface BillingEvent {
  id: string;
  type: string;
  subscriptionId: string | null;
}

export interface CheckoutInput {
  userId: string;
  email: string;
  customerId: string | null;
  priceId: string;
  successUrl: string;
  cancelUrl: string;
}

export interface BillingProvider {
  /** Rejects with `VALIDATION_FAILED` (`reason: 'unknownPrice'`) for an unknown price. */
  getPrice(priceId: string): Promise<ProviderPrice>;
  createCheckout(input: CheckoutInput): Promise<{ id: string; url: string }>;
  /** Closes an open Checkout session; one already completed or expired is fine. */
  expireCheckout(sessionId: string): Promise<void>;
  createPortal(input: { customerId: string; returnUrl: string }): Promise<{ url: string }>;
  getSubscription(id: string): Promise<ProviderSubscription>;
  cancelNow(subscriptionId: string): Promise<void>;
  /** Throws `VALIDATION_FAILED` on a bad or stale signature. */
  verifyEvent(rawBody: Buffer, signature: string): BillingEvent;
}

/**
 * The subscription an event is about: a subscription's own id, a checkout session's
 * `subscription`, or an invoice's (`parent.subscription_details.subscription` in current API
 * versions, `subscription` in older ones).
 */
export function eventOf(payload: unknown): BillingEvent | null {
  if (typeof payload !== 'object' || payload === null) return null;
  const event = payload as { id?: unknown; type?: unknown; data?: { object?: unknown } };
  if (typeof event.id !== 'string' || typeof event.type !== 'string') return null;
  const object = (event.data?.object ?? {}) as {
    id?: unknown;
    object?: unknown;
    subscription?: unknown;
    parent?: { subscription_details?: { subscription?: unknown } | null } | null;
  };
  const candidates = [
    object.object === 'subscription' ? object.id : undefined,
    object.subscription,
    object.parent?.subscription_details?.subscription,
  ];
  const subscriptionId = candidates.find((id): id is string => typeof id === 'string') ?? null;
  return { id: event.id, type: event.type, subscriptionId };
}
