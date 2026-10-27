import type { AdminSubscription, GrantRequest } from '@nextlevel/shared';
import type { ApiContext } from '../context.ts';
import { apiError } from '../errors.ts';
import { givesAccess, isPayingStripe } from '../subscriptions/current.ts';
import type { SubscriptionRow } from '../subscriptions/SubscriptionRepository.ts';
import { audited, type AuditInput } from './audit.ts';

// Complimentary grants (FR-SUB-4, FR-ADM-1, D35): a plan, an optional end and a note; revocable.
// One access-giving subscription per user: a grant replaces an active grant and is refused for
// someone paying through Stripe.

function toAdminSubscription(ctx: ApiContext, row: SubscriptionRow): AdminSubscription {
  const plan = ctx.plans.byId(row.planId);
  const giver = row.grantedBy ? ctx.users.byId(row.grantedBy) : undefined;
  return {
    id: row.id,
    source: row.source,
    status: row.status,
    plan: { slug: plan?.slug ?? '', name: plan?.name ?? '' },
    periodEnd: row.currentPeriodEnd,
    cancelAtPeriodEnd: row.cancelAtPeriodEnd,
    interval: row.interval,
    stripeSubscriptionId: row.stripeSubscriptionId,
    grantedBy: giver ? { id: giver.id, email: giver.email } : null,
    note: row.note,
    createdAt: row.createdAt,
  };
}

/** A user's subscriptions and grants, newest first (admin user detail). */
export function adminSubscriptions(ctx: ApiContext, userId: string): AdminSubscription[] {
  return ctx.subscriptions.forUser(userId).map((row) => toAdminSubscription(ctx, row));
}

const revokeEntry = (ctx: ApiContext, row: SubscriptionRow, now: Date): AuditInput => ({
  action: 'grant.revoke',
  targetType: 'subscription',
  targetId: row.id,
  before: toAdminSubscription(ctx, row),
  after: toAdminSubscription(ctx, { ...row, status: 'canceled', updatedAt: now.toISOString() }),
});

export function grantComp(
  ctx: ApiContext,
  actorId: string,
  userId: string,
  req: GrantRequest,
): AdminSubscription {
  if (!ctx.users.byId(userId)) throw apiError('NOT_FOUND');
  const plan = ctx.plans.bySlug(req.planSlug);
  if (!plan) throw apiError('VALIDATION_FAILED', 'Unknown plan.', { reason: 'unknownPlan' });
  if (plan.archived) throw apiError('CONFLICT', undefined, { reason: 'archived' });
  const now = ctx.clock();
  if (req.expiresAt !== null && Date.parse(req.expiresAt) <= now.getTime()) {
    throw apiError('VALIDATION_FAILED', 'The end date has passed.', { reason: 'past' });
  }
  const rows = ctx.subscriptions.forUser(userId);
  if (rows.some(isPayingStripe)) throw apiError('CONFLICT', undefined, { reason: 'subscribed' });
  const replaced = rows.filter((row) => row.source === 'comp' && givesAccess(row, now));
  const row: SubscriptionRow = {
    id: ctx.newId(),
    userId,
    planId: plan.id,
    source: 'comp',
    status: 'active',
    interval: null,
    currentPeriodEnd: req.expiresAt === null ? null : new Date(req.expiresAt).toISOString(),
    cancelAtPeriodEnd: false,
    stripeCustomerId: null,
    stripeSubscriptionId: null,
    grantedBy: actorId,
    note: req.note,
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
  };
  const after = toAdminSubscription(ctx, row);
  audited(
    ctx,
    actorId,
    [
      ...replaced.map((old) => revokeEntry(ctx, old, now)),
      { action: 'grant.create', targetType: 'subscription', targetId: row.id, before: null, after },
    ],
    () => {
      for (const old of replaced) ctx.subscriptions.setStatus(old.id, 'canceled', now);
      ctx.subscriptions.insertComp(row);
    },
  );
  return after;
}

export function revokeComp(
  ctx: ApiContext,
  actorId: string,
  userId: string,
  subscriptionId: string,
): void {
  const row = ctx.subscriptions.byId(subscriptionId);
  if (!row || row.userId !== userId || row.source !== 'comp') throw apiError('NOT_FOUND');
  if (row.status !== 'active') throw apiError('CONFLICT', undefined, { reason: 'notActive' });
  const now = ctx.clock();
  audited(ctx, actorId, [revokeEntry(ctx, row, now)], () => {
    ctx.subscriptions.setStatus(row.id, 'canceled', now);
  });
}
