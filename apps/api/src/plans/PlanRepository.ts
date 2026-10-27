import type { PlanPrices } from '@nextlevel/shared';
import { and, asc, count, eq, gt, inArray, isNull, or, sql } from 'drizzle-orm';
import type { ApiDb } from '../db/open.ts';
import { plans, subscriptions } from '../db/schema.ts';
import type { PlanSummary } from '../entitlements/entitlement.ts';
import type { ScopeRow } from './ScopeRepository.ts';

export type PlanRow = typeof plans.$inferSelect;

/** The `plans` table (data model §5). The `default` plan is seeded by `openDb` (D21). */
export class PlanRepository {
  readonly #db: ApiDb;

  constructor(db: ApiDb) {
    this.#db = db;
  }

  /** The Default plan first, then oldest first. */
  list(): PlanRow[] {
    return this.#db
      .select()
      .from(plans)
      .orderBy(sql`${plans.slug} <> 'default'`, asc(plans.createdAt), asc(plans.id))
      .all();
  }

  byId(id: string): PlanRow | undefined {
    return this.#db.select().from(plans).where(eq(plans.id, id)).get();
  }

  bySlug(slug: string): PlanRow | undefined {
    return this.#db.select().from(plans).where(eq(plans.slug, slug)).get();
  }

  /** The plan selling a Stripe price, and which of its two prices it is. */
  byPriceId(priceId: string): { plan: PlanRow; interval: 'month' | 'year' } | undefined {
    const plan = this.#db
      .select()
      .from(plans)
      .where(or(eq(plans.stripePriceMonthly, priceId), eq(plans.stripePriceYearly, priceId)))
      .get();
    if (!plan) return undefined;
    return { plan, interval: plan.stripePriceMonthly === priceId ? 'month' : 'year' };
  }

  insert(row: PlanRow): void {
    this.#db.insert(plans).values(row).run();
  }

  update(id: string, patch: Partial<Omit<PlanRow, 'id' | 'slug' | 'createdAt'>>): void {
    this.#db.update(plans).set(patch).where(eq(plans.id, id)).run();
  }

  /** Access-giving subscriptions per plan id (the `currentSubscription` rule, in SQL). */
  subscriberCounts(now: Date): Map<string, number> {
    const rows = this.#db
      .select({ planId: subscriptions.planId, n: count() })
      .from(subscriptions)
      .where(
        or(
          and(
            eq(subscriptions.source, 'comp'),
            eq(subscriptions.status, 'active'),
            or(
              isNull(subscriptions.currentPeriodEnd),
              gt(subscriptions.currentPeriodEnd, now.toISOString()),
            ),
          ),
          and(
            eq(subscriptions.source, 'stripe'),
            inArray(subscriptions.status, ['active', 'past_due']),
          ),
        ),
      )
      .groupBy(subscriptions.planId)
      .all();
    return new Map(rows.map((row) => [row.planId, row.n]));
  }
}

export function pricesOf(row: PlanRow): PlanPrices {
  const price = (amount: number | null) =>
    amount === null || row.currency === null ? null : { amount, currency: row.currency };
  return { month: price(row.priceMonthlyAmount), year: price(row.priceYearlyAmount) };
}

/** What the entitlement needs: scope ids become slugs (unknown ids are dropped). */
export function toPlanSummary(row: PlanRow, scopes: ScopeRow[]): PlanSummary {
  const slugs = new Map(scopes.map((scope) => [scope.id, scope.slug]));
  return {
    slug: row.slug,
    name: row.name,
    deviceLimit: row.deviceLimit,
    scopes: row.scopeIds.flatMap((id) => slugs.get(id) ?? []),
  };
}
