import type { AdminStats } from '@nextlevel/shared';
import { desc, gte } from 'drizzle-orm';
import type { ApiDb } from '../db/open.ts';
import { catalogItems, downloads, plans, users } from '../db/schema.ts';
import { currentSubscriptions } from '../subscriptions/currentAll.ts';

// The console dashboard (FR-ADM-6, D38, D49), computed on request: no stored aggregates.

const DAY_MS = 24 * 60 * 60 * 1000;

/** `YYYY-MM-DD` of the UTC day `days` before `now`'s. */
const utcDay = (now: Date, days: number) =>
  new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()) - days * DAY_MS)
    .toISOString()
    .slice(0, 10);

/**
 * Subscribers and MRR: each user's current subscription, admins and suspended users left out.
 * Stripe `active` and `past_due` users are paying (they keep access); MRR counts `active` ones
 * only, at their plan's stored price.
 */
function subscriberStats(db: ApiDb, now: Date) {
  const people = new Map(
    db
      .select()
      .from(users)
      .all()
      .map((user) => [user.id, user]),
  );
  const priced = new Map(
    db
      .select()
      .from(plans)
      .all()
      .map((plan) => [plan.id, plan]),
  );
  const subscribers = { paying: 0, comp: 0 };
  const monthly = new Map<string, number>();
  const pastDue: AdminStats['pastDue'] = [];
  for (const [userId, row] of currentSubscriptions(db, now)) {
    const user = people.get(userId);
    if (!user || user.role === 'admin' || user.status === 'suspended') continue;
    if (row.source === 'comp') {
      subscribers.comp += 1;
      continue;
    }
    subscribers.paying += 1;
    if (row.status === 'past_due') {
      pastDue.push({ userId, email: user.email, periodEnd: row.currentPeriodEnd });
      continue;
    }
    const plan = priced.get(row.planId);
    const amount = row.interval === 'year' ? plan?.priceYearlyAmount : plan?.priceMonthlyAmount;
    if (!plan?.currency || amount == null) continue;
    const perMonth = row.interval === 'year' ? amount / 12 : amount;
    monthly.set(plan.currency, (monthly.get(plan.currency) ?? 0) + perMonth);
  }
  const mrr = [...monthly]
    .map(([currency, amount]) => ({ currency, amount: Math.round(amount) }))
    .sort((a, b) => a.currency.localeCompare(b.currency));
  pastDue.sort((a, b) => a.email.localeCompare(b.email));
  return { subscribers, mrr, pastDue };
}

/**
 * Downloads in the last 30 UTC days. A request writes one row per file with the same time, so
 * one request = one (user, device, item, time).
 */
function downloadStats(db: ApiDb, now: Date) {
  const first = utcDay(now, 29);
  const rows = db
    .selectDistinct({
      userId: downloads.userId,
      deviceId: downloads.deviceId,
      itemId: downloads.itemId,
      issuedAt: downloads.issuedAt,
    })
    .from(downloads)
    .where(gte(downloads.issuedAt, `${first}T00:00:00.000Z`))
    .all();
  const days = Array.from({ length: 30 }, (_, i) => utcDay(now, 29 - i));
  const perDay = new Map(days.map((date) => [date, 0]));
  const perItem = new Map<string, number>();
  for (const row of rows) {
    const date = row.issuedAt.slice(0, 10);
    const known = perDay.get(date);
    if (known === undefined) continue;
    perDay.set(date, known + 1);
    if (row.itemId) perItem.set(row.itemId, (perItem.get(row.itemId) ?? 0) + 1);
  }
  const weekStart = utcDay(now, 6);
  const titles = new Map(
    db
      .select({ id: catalogItems.id, title: catalogItems.title })
      .from(catalogItems)
      .all()
      .map((item) => [item.id, item.title]),
  );
  const topItems = [...perItem]
    .flatMap(([itemId, count]) => {
      const title = titles.get(itemId);
      return title === undefined ? [] : [{ itemId, title, downloads: count }];
    })
    .sort((a, b) => b.downloads - a.downloads || a.title.localeCompare(b.title))
    .slice(0, 10);
  return {
    downloads7d: days
      .filter((date) => date >= weekStart)
      .reduce((sum, date) => sum + (perDay.get(date) ?? 0), 0),
    downloadsPerDay: days.map((date) => ({ date, count: perDay.get(date) ?? 0 })),
    topItems,
  };
}

/** The dashboard's numbers (api-spec `GET /v1/admin/stats`). */
export function adminStats(db: ApiDb, now: Date): AdminStats {
  const recentSignups = db
    .select({ id: users.id, email: users.email, createdAt: users.createdAt })
    .from(users)
    .orderBy(desc(users.createdAt), desc(users.id))
    .limit(10)
    .all();
  return { ...subscriberStats(db, now), ...downloadStats(db, now), recentSignups };
}
