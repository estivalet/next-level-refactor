import type { FastifyBaseLogger } from 'fastify';
import type { ApiContext } from '../context.ts';
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
  const sub = await billing.getSubscription(subscriptionId);
  const status = ourStatus(sub.status);
  if (status === null) return 'ignored';
  const notApplied = (reason: string) => {
    log.warn({ eventId: event.id, subscriptionId: sub.id, reason }, 'stripe event not applied');
    return 'ignored' as const;
  };
  const priced = ctx.plans.byPriceId(sub.priceId);
  if (!priced) return notApplied('unknownPrice');
  const user = sub.userId ? ctx.users.byId(sub.userId) : undefined;
  if (!user) return notApplied('unknownUser');
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
  return 'applied';
}
