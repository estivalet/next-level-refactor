import { and, desc, eq, isNotNull } from 'drizzle-orm';
import type { ApiDb } from '../db/open.ts';
import { subscriptions } from '../db/schema.ts';

export type SubscriptionRow = typeof subscriptions.$inferSelect;
export type SubscriptionStatus = SubscriptionRow['status'];

/** The `subscriptions` table (data model §5): Stripe subscriptions and comp grants. */
export class SubscriptionRepository {
  readonly #db: ApiDb;

  constructor(db: ApiDb) {
    this.#db = db;
  }

  /** Newest first (uuid v7 ids break ties in creation order). */
  forUser(userId: string): SubscriptionRow[] {
    return this.#db
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.userId, userId))
      .orderBy(desc(subscriptions.createdAt), desc(subscriptions.id))
      .all();
  }

  /** Every row, for list filters that apply the current-subscription rule per user. */
  all(): SubscriptionRow[] {
    return this.#db.select().from(subscriptions).all();
  }

  byId(id: string): SubscriptionRow | undefined {
    return this.#db.select().from(subscriptions).where(eq(subscriptions.id, id)).get();
  }

  byStripeId(stripeSubscriptionId: string): SubscriptionRow | undefined {
    return this.#db
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.stripeSubscriptionId, stripeSubscriptionId))
      .get();
  }

  /** One row per Stripe subscription: insert, or update its billing fields. */
  upsertStripe(row: SubscriptionRow): void {
    const changes = {
      planId: row.planId,
      status: row.status,
      interval: row.interval,
      currentPeriodEnd: row.currentPeriodEnd,
      cancelAtPeriodEnd: row.cancelAtPeriodEnd,
      stripeCustomerId: row.stripeCustomerId,
      updatedAt: row.updatedAt,
    };
    this.#db
      .insert(subscriptions)
      .values(row)
      .onConflictDoUpdate({ target: subscriptions.stripeSubscriptionId, set: changes })
      .run();
  }

  insertComp(row: SubscriptionRow): void {
    this.#db.insert(subscriptions).values(row).run();
  }

  setStatus(id: string, status: SubscriptionStatus, now: Date): void {
    this.#db
      .update(subscriptions)
      .set({ status, updatedAt: now.toISOString() })
      .where(eq(subscriptions.id, id))
      .run();
  }

  /** The Stripe customer of the user's newest Stripe row, reused for the next checkout. */
  latestCustomerId(userId: string): string | null {
    const row = this.#db
      .select({ customer: subscriptions.stripeCustomerId })
      .from(subscriptions)
      .where(and(eq(subscriptions.userId, userId), isNotNull(subscriptions.stripeCustomerId)))
      .orderBy(desc(subscriptions.createdAt), desc(subscriptions.id))
      .get();
    return row?.customer ?? null;
  }

  deleteForUser(userId: string): void {
    this.#db.delete(subscriptions).where(eq(subscriptions.userId, userId)).run();
  }
}
