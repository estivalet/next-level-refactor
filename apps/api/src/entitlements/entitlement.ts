import type { AppSettings, Entitlement, SubscriptionSummary } from '@nextlevel/shared';
import type { SubscriptionRow } from '../subscriptions/SubscriptionRepository.ts';
import type { UserRow } from '../users/UserRepository.ts';

export interface PlanSummary {
  slug: string;
  name: string;
  deviceLimit: number;
  /** Catalog scope slugs. */
  scopes: string[];
}

export interface EntitlementInput {
  user: UserRow;
  /** `BILLING_ENABLED` (D33). */
  billing: boolean;
  defaultPlan: PlanSummary;
  /** The current subscription (`currentSubscription`) and its plan; ignored with billing off. */
  current: { row: SubscriptionRow; plan: PlanSummary } | null;
  /** Every catalog scope slug: admins get them all. */
  allScopes: string[];
  settings: AppSettings;
  now: Date;
}

const DAY_MS = 24 * 3600_000;

function summaryOf(row: SubscriptionRow): SubscriptionSummary {
  return {
    source: row.source,
    status: row.status,
    interval: row.interval,
    periodEnd: row.currentPeriodEnd,
    cancelAtPeriodEnd: row.cancelAtPeriodEnd,
  };
}

/** A known end of access: a comp grant's end, or the period end of a cancelled subscription. */
function knownEnd(row: SubscriptionRow): number | null {
  if (row.currentPeriodEnd === null) return null;
  if (row.source === 'comp' || row.cancelAtPeriodEnd) return Date.parse(row.currentPeriodEnd);
  return null;
}

const planView = (plan: PlanSummary) => ({
  slug: plan.slug,
  name: plan.name,
  deviceLimit: plan.deviceLimit,
});

/**
 * What a user may do right now (data model §5). Suspension wins; admins are active without a
 * plan and with every scope; while billing is off every other user is active on the Default plan
 * (FR-SUB-5, D21). With billing on, the current subscription decides: Stripe `past_due` is
 * `grace` (FR-SUB-3), no subscription is `none`. `offlineUntil` bounds how long the launcher may
 * run without checking again (FR-AUTH-5), never past a known end of access (US-F2).
 */
export function computeEntitlement(input: EntitlementInput): Entitlement {
  const { user, settings, now } = input;
  const graceEnd = now.getTime() + settings.graceDays * DAY_MS;
  const base = { userId: user.id, role: user.role, checkedAt: now.toISOString() };
  const offline = (end: number | null) =>
    new Date(end === null ? graceEnd : Math.min(graceEnd, end)).toISOString();
  const billing = input.billing ? { subscription: null } : {};
  if (user.status === 'suspended') {
    return {
      ...base,
      offlineUntil: offline(null),
      status: 'suspended',
      plan: null,
      scopes: [],
      ...billing,
    };
  }
  if (user.role === 'admin') {
    return {
      ...base,
      offlineUntil: offline(null),
      status: 'active',
      plan: null,
      scopes: input.allScopes,
      ...billing,
    };
  }
  if (!input.billing) {
    return {
      ...base,
      offlineUntil: offline(null),
      status: 'active',
      plan: planView(input.defaultPlan),
      scopes: input.defaultPlan.scopes,
    };
  }
  const { current } = input;
  if (!current) {
    return {
      ...base,
      offlineUntil: offline(null),
      status: 'none',
      plan: null,
      scopes: [],
      ...billing,
    };
  }
  return {
    ...base,
    offlineUntil: offline(knownEnd(current.row)),
    status: current.row.status === 'past_due' ? 'grace' : 'active',
    plan: planView(current.plan),
    scopes: current.plan.scopes,
    subscription: summaryOf(current.row),
  };
}
