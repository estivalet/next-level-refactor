import { inArray } from 'drizzle-orm';
import type { ApiDb } from '../db/open.ts';
import { subscriptions } from '../db/schema.ts';
import { currentSubscription } from './current.ts';
import type { SubscriptionRow } from './SubscriptionRepository.ts';

/**
 * The current subscription of many users in one query (FR-ADM-6, D38): the same rule as
 * `currentSubscription`, per user. `userIds` limits it to those users; users with no current
 * subscription are left out of the map.
 */
export function currentSubscriptions(
  db: ApiDb,
  now: Date,
  userIds?: readonly string[],
): Map<string, SubscriptionRow> {
  if (userIds?.length === 0) return new Map();
  const rows = db
    .select()
    .from(subscriptions)
    .where(userIds ? inArray(subscriptions.userId, [...userIds]) : undefined)
    .all();
  const byUser = new Map<string, SubscriptionRow[]>();
  for (const row of rows) byUser.set(row.userId, [...(byUser.get(row.userId) ?? []), row]);
  const current = new Map<string, SubscriptionRow>();
  for (const [userId, own] of byUser) {
    const row = currentSubscription(own, now);
    if (row) current.set(userId, row);
  }
  return current;
}
