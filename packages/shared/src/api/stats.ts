import { z } from 'zod';

// The console dashboard (api-spec Admin stats, FR-ADM-6, D38, D49). Computed on request.

const count = z.number().int().min(0);
const isoTime = z.iso.datetime();

export const AdminStatsSchema = z.object({
  /** Users with a current subscription, not admins and not suspended. */
  subscribers: z.object({ paying: count, comp: count }),
  /** Active Stripe subscriptions: monthly amounts + yearly ÷ 12, in minor units, per currency. */
  mrr: z.array(z.object({ currency: z.string(), amount: count })),
  /** Download requests (one per item, however many files) in the last 7 UTC days. */
  downloads7d: count,
  /** The last 30 UTC days, oldest first, days without downloads included as 0. */
  downloadsPerDay: z.array(z.object({ date: z.iso.date(), count })),
  /** At most 10, most downloaded in the last 30 days first. */
  topItems: z.array(z.object({ itemId: z.string(), title: z.string(), downloads: count })),
  /** The 10 newest accounts. */
  recentSignups: z.array(z.object({ id: z.string(), email: z.string(), createdAt: isoTime })),
  /** Users whose current subscription is a Stripe `past_due` one. */
  pastDue: z.array(
    z.object({ userId: z.string(), email: z.string(), periodEnd: isoTime.nullable() }),
  ),
});

export type AdminStats = z.output<typeof AdminStatsSchema>;
