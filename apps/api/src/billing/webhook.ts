import type { FastifyBaseLogger } from 'fastify';
import type { ApiContext } from '../context.ts';
import type { SubscriptionRow } from '../subscriptions/SubscriptionRepository.ts';
import type { BillingEvent, ProviderSubscriptionStatus } from './provider.ts';

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
  if (!HANDLED_EVENTS.has(event.type) || !event.subscriptionId || !ctx.billing) return 'ignored';
  const sub = await ctx.billing.getSubscription(event.subscriptionId);
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
