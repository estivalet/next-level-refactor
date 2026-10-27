import type { AdminUserQuery } from '@nextlevel/shared';
import { inArray, type SQL } from 'drizzle-orm';
import { defaultPlanOf } from '../auth/session.ts';
import type { ApiContext } from '../context.ts';
import { users } from '../db/schema.ts';
import { computeEntitlement } from '../entitlements/entitlement.ts';
import { toPlanSummary } from '../plans/PlanRepository.ts';
import { currentSubscription } from '../subscriptions/current.ts';
import type { SubscriptionRow } from '../subscriptions/SubscriptionRepository.ts';

/**
 * The users list's `plan` and `access` filters (D38) as an id set. They follow the entitlement
 * rule exactly (billing switch, current subscription, admins, suspension), so it is applied per
 * user rather than restated in SQL. `access=comp` = the current subscription is a comp grant.
 */
export function planAccessFilter(ctx: ApiContext, query: AdminUserQuery): SQL | undefined {
  if (!query.plan && !query.access) return undefined;
  const now = ctx.clock();
  const settings = ctx.settings();
  const billing = ctx.env.billing.enabled;
  const scopes = ctx.scopes.list();
  const plans = new Map(ctx.plans.list().map((row) => [row.id, toPlanSummary(row, scopes)]));
  const rowsByUser = new Map<string, SubscriptionRow[]>();
  for (const row of billing ? ctx.subscriptions.all() : []) {
    rowsByUser.set(row.userId, [...(rowsByUser.get(row.userId) ?? []), row]);
  }
  const defaultPlan = defaultPlanOf(ctx);
  const allScopes = scopes.map((scope) => scope.slug);
  const ids = ctx.db
    .select()
    .from(users)
    .all()
    .filter((user) => {
      const row = currentSubscription(rowsByUser.get(user.id) ?? [], now);
      const plan = row ? plans.get(row.planId) : undefined;
      const current = row && plan ? { row, plan } : null;
      const entitlement = computeEntitlement({
        user,
        billing,
        defaultPlan,
        current,
        allScopes,
        settings,
        now,
      });
      if (query.plan && entitlement.plan?.slug !== query.plan) return false;
      if (query.access === 'comp') return entitlement.subscription?.source === 'comp';
      return !query.access || entitlement.status === query.access;
    })
    .map((user) => user.id);
  return inArray(users.id, ids);
}
