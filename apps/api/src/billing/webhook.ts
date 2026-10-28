import type { FastifyBaseLogger } from 'fastify';
import type { ApiContext } from '../context.ts';
import { ApiError } from '../errors.ts';
import { isPayingStripe } from '../subscriptions/current.ts';
import type { SubscriptionRow } from '../subscriptions/SubscriptionRepository.ts';
import type { BillingEvent, BillingProvider, ProviderSubscriptionStatus } from './provider.ts';

// Webhook events are only triggers (ADR-009): the subscription they name is re-read from the
// provider and upserted, so duplicates and out-of-order delivery end in the provider's state.

export const HANDLED_EVENTS = new Set([
  'checkout.session.completed',
  'customer.subscription.created',
  'customer.subscription.updated',
  'customer.subscription.deleted',
  'invoice.payment_failed',
  'invoice.paid',
]);

/** Stripe → ours; `incomplete` (not paid yet) is not stored. */
export function ourStatus(status: ProviderSubscriptionStatus): SubscriptionRow['status'] | null {
  switch (status) {
    case 'active':
    case 'trialing':
      return 'active';
    case 'past_due':
      return 'past_due';
    case 'canceled':
      return 'canceled';
    case 'unpaid':
    case 'incomplete_expired':
    case 'paused':
      return 'expired';
    case 'incomplete':
      return null;
  }
}

/** Per context: the last read-and-write of each subscription, so they run one at a time. */
const chains = new WeakMap<ApiContext, Map<string, Promise<unknown>>>();

/**
 * Runs `task` after every earlier task for the same subscription. A read started later then
 * always sees at least what an earlier read saw, so a slow stale read can't overwrite a newer
 * state (Review Focus 1: concurrent deliveries).
 */
function inTurn<T>(ctx: ApiContext, key: string, task: () => Promise<T>): Promise<T> {
  const byKey = chains.get(ctx) ?? new Map<string, Promise<unknown>>();
  chains.set(ctx, byKey);
  const previous = byKey.get(key) ?? Promise.resolve();
  const run = previous.then(task, task);
  const settled = run.catch(() => undefined);
  byKey.set(key, settled);
  void settled.then(() => {
    if (byKey.get(key) === settled) byKey.delete(key);
  });
  return run;
}

/**
 * Applies one verified event. Unknown prices and users are logged (Stripe ids only, never
 * emails) and change nothing: access follows our plans, and the runbook says the Portal's
 * products must match them.
 */
export async function processEvent(
  ctx: ApiContext,
  event: BillingEvent,
  log: FastifyBaseLogger,
): Promise<'applied' | 'ignored'> {
  const { subscriptionId } = event;
  const billing = ctx.billing;
  if (!HANDLED_EVENTS.has(event.type) || !subscriptionId || !billing) return 'ignored';
  return inTurn(ctx, subscriptionId, () => apply(ctx, event, subscriptionId, billing, log));
}

async function apply(
  ctx: ApiContext,
  event: BillingEvent,
  subscriptionId: string,
  billing: BillingProvider,
  log: FastifyBaseLogger,
): Promise<'applied' | 'ignored'> {
  const notApplied = (reason: string) => {
    log.warn({ eventId: event.id, subscriptionId, reason }, 'stripe event not applied');
    return 'ignored' as const;
  };
  let sub;
  try {
    sub = await billing.getSubscription(subscriptionId);
  } catch (error) {
    // Deleted in Stripe: nothing left to read, and retrying for days won't bring it back.
    if (error instanceof ApiError && error.code === 'NOT_FOUND') {
      return notApplied('subscriptionGone');
    }
    throw error;
  }
  const status = ourStatus(sub.status);
  if (status === null) return 'ignored';
  const priced = ctx.plans.byPriceId(sub.priceId);
  if (!priced) return notApplied('unknownPrice');
  const user = sub.userId ? ctx.users.byId(sub.userId) : undefined;
  // A deleted account kept as a tombstone is nobody's: a late event must not attach rows to it.
  if (!user || user.email.endsWith('@deleted.invalid')) return notApplied('unknownUser');
  const existing = ctx.subscriptions.byStripeId(sub.id);
  if (existing && existing.userId !== user.id) return notApplied('userChanged');
  const now = ctx.clock().toISOString();
  ctx.subscriptions.upsertStripe({
    id: existing?.id ?? ctx.newId(),
    userId: user.id,
    planId: priced.plan.id,
    source: 'stripe',
    status,
    interval: priced.interval,
    currentPeriodEnd: sub.currentPeriodEnd,
    cancelAtPeriodEnd: sub.cancelAtPeriodEnd,
    stripeCustomerId: sub.customerId,
    stripeSubscriptionId: sub.id,
    grantedBy: null,
    note: null,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  });
  const row = ctx.subscriptions.byStripeId(sub.id);
  if (row && isPayingStripe(row)) {
    const others = ctx.subscriptions
      .forUser(user.id)
      .filter((other) => other.id !== row.id && isPayingStripe(other));
    // Checkout refuses a second one (D35); one still appearing needs an operator to refund it.
    if (others.length > 0) {
      log.warn(
        { eventId: event.id, subscriptionId: sub.id, reason: 'duplicateSubscription' },
        'second paying subscription for one user',
      );
    }
  }
  return 'applied';
}
