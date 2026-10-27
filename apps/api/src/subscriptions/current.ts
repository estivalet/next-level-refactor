import type { SubscriptionRow } from './SubscriptionRepository.ts';

// Which subscription row gives a user access (data model §5, FR-SUB-3, D35). Pure: the same
// rule backs the entitlement, the admin filters and the "already subscribed" checks.

/** A comp grant `active` with no end or an end still ahead; a Stripe row `active`/`past_due`. */
export function givesAccess(row: SubscriptionRow, now: Date): boolean {
  if (row.source === 'comp') {
    return (
      row.status === 'active' &&
      (row.currentPeriodEnd === null || Date.parse(row.currentPeriodEnd) > now.getTime())
    );
  }
  return row.status === 'active' || row.status === 'past_due';
}

/** A Stripe subscription that is still billing: no comp grant or second checkout on top (D35). */
export function isPayingStripe(row: SubscriptionRow): boolean {
  return row.source === 'stripe' && (row.status === 'active' || row.status === 'past_due');
}

const newestFirst = (a: SubscriptionRow, b: SubscriptionRow) =>
  b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id);

/** The newest row that gives access, or null. */
export function currentSubscription(
  rows: readonly SubscriptionRow[],
  now: Date,
): SubscriptionRow | null {
  return [...rows].sort(newestFirst).find((row) => givesAccess(row, now)) ?? null;
}
