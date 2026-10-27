import type { CheckoutRequest } from '@nextlevel/shared';
import type { ApiContext } from '../context.ts';
import { apiError } from '../errors.ts';
import { givesAccess } from '../subscriptions/current.ts';
import type { UserRow } from '../users/UserRepository.ts';
import type { BillingProvider } from './provider.ts';

// Checkout and Customer Portal for the signed-in launcher (FR-SUB-2, api-spec §2 Me billing).

function provider(ctx: ApiContext): BillingProvider {
  if (!ctx.env.billing.enabled || !ctx.billing) {
    throw apiError('CONFLICT', undefined, { reason: 'billingOff' });
  }
  return ctx.billing;
}

const returnUrl = (ctx: ApiContext, result: 'success' | 'cancelled' | 'portal') =>
  `${ctx.env.publicUrl}/v1/billing/return?result=${result}`;

/**
 * A Checkout page for a plan's monthly or yearly price. Refused while the user already has
 * access-giving billing or a comp grant (Review Focus 3: never two sessions that could both be
 * paid for someone who has access).
 */
export async function startCheckout(
  ctx: ApiContext,
  user: UserRow,
  req: CheckoutRequest,
): Promise<{ url: string }> {
  if (user.status === 'suspended') throw apiError('SUSPENDED');
  const billing = provider(ctx);
  const plan = ctx.plans.bySlug(req.planSlug);
  const priceId = req.interval === 'month' ? plan?.stripePriceMonthly : plan?.stripePriceYearly;
  if (!plan || plan.archived || !priceId) throw apiError('NOT_FOUND');
  const now = ctx.clock();
  if (ctx.subscriptions.forUser(user.id).some((row) => givesAccess(row, now))) {
    throw apiError('CONFLICT', undefined, { reason: 'subscribed' });
  }
  return billing.createCheckout({
    userId: user.id,
    email: user.email,
    customerId: ctx.subscriptions.latestCustomerId(user.id),
    priceId,
    successUrl: returnUrl(ctx, 'success'),
    cancelUrl: returnUrl(ctx, 'cancelled'),
  });
}

/** The Customer Portal of the user's Stripe customer (manage, switch, cancel). */
export async function openPortal(ctx: ApiContext, user: UserRow): Promise<{ url: string }> {
  if (user.status === 'suspended') throw apiError('SUSPENDED');
  const billing = provider(ctx);
  const customerId = ctx.subscriptions.latestCustomerId(user.id);
  if (!customerId) throw apiError('CONFLICT', undefined, { reason: 'noCustomer' });
  return billing.createPortal({ customerId, returnUrl: returnUrl(ctx, 'portal') });
}
