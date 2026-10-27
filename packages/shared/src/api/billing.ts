import { z } from 'zod';

// Billing contracts between the launcher and the API (api-spec §2 Me billing, /v1/plans, FR-SUB-1..5).

const isoTime = z.iso.datetime();

export const PlanSlugSchema = z.string().regex(/^[a-z0-9-]{2,40}$/, 'lowercase slug expected');

export const BillingIntervalSchema = z.enum(['month', 'year']);

/** What gives the user access: a Stripe subscription or a complimentary grant (D35). */
export const SubscriptionSummarySchema = z.object({
  source: z.enum(['stripe', 'comp']),
  status: z.enum(['active', 'past_due', 'canceled', 'expired']),
  interval: BillingIntervalSchema.nullable(),
  /** Paid-until date (Stripe) or the grant's end; null = a grant until revoked. */
  periodEnd: isoTime.nullable(),
  cancelAtPeriodEnd: z.boolean(),
});

/** Integer minor units and a lowercase ISO 4217 currency, as Stripe reports them. */
export const PriceSchema = z.object({
  amount: z.number().int().min(0),
  currency: z.string().regex(/^[a-z]{3}$/),
});

export const PlanPricesSchema = z.object({
  month: PriceSchema.nullable(),
  year: PriceSchema.nullable(),
});

export const PublicPlanSchema = z.object({
  slug: z.string(),
  name: z.string(),
  deviceLimit: z.number().int().positive(),
  scopes: z.array(z.object({ slug: z.string(), name: z.string() })),
  prices: PlanPricesSchema,
});

export const PlansResponseSchema = z.object({
  billingEnabled: z.boolean(),
  plans: z.array(PublicPlanSchema),
});

export const CheckoutRequestSchema = z.strictObject({
  planSlug: PlanSlugSchema,
  interval: BillingIntervalSchema,
});

/** A Stripe Checkout or Customer Portal page (or the stub's) for the launcher to open. */
export const RedirectResponseSchema = z.object({ url: z.url() });

/** "Download my data" (security §5): the account as the service holds it, minus secrets. */
export const AccountExportSchema = z.object({
  exportedAt: isoTime,
  user: z.object({
    id: z.string(),
    email: z.string(),
    name: z.string(),
    avatarUrl: z.string().nullable(),
    role: z.enum(['admin', 'subscriber']),
    status: z.enum(['active', 'suspended']),
    createdAt: isoTime,
    lastSeenAt: isoTime.nullable(),
  }),
  devices: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      platform: z.string(),
      appVersion: z.string(),
      createdAt: isoTime,
      lastSeenAt: isoTime,
      revokedAt: isoTime.nullable(),
    }),
  ),
  subscriptions: z.array(
    z.object({
      source: SubscriptionSummarySchema.shape.source,
      status: SubscriptionSummarySchema.shape.status,
      plan: z.object({ slug: z.string(), name: z.string() }),
      interval: BillingIntervalSchema.nullable(),
      periodEnd: isoTime.nullable(),
      createdAt: isoTime,
    }),
  ),
  /** What admins changed about this account; who did it is not included. */
  audit: z.array(
    z.object({ action: z.string(), at: isoTime, before: z.unknown(), after: z.unknown() }),
  ),
});

/** Deleting an account is confirmed by typing its email (D36). */
export const DeleteAccountRequestSchema = z.strictObject({
  confirmEmail: z.string().trim().min(1).max(320),
});

/** Minor units → the locale's currency text, with the currency's own decimals (JPY 0, BHD 3). */
export function formatPrice(price: Price, locale: string): string {
  const format = new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: price.currency.toUpperCase(),
  });
  const digits = format.resolvedOptions().maximumFractionDigits ?? 2;
  return format.format(price.amount / 10 ** digits);
}

export type PlanSlug = z.output<typeof PlanSlugSchema>;
export type BillingInterval = z.output<typeof BillingIntervalSchema>;
export type SubscriptionSummary = z.output<typeof SubscriptionSummarySchema>;
export type Price = z.output<typeof PriceSchema>;
export type PlanPrices = z.output<typeof PlanPricesSchema>;
export type PublicPlan = z.output<typeof PublicPlanSchema>;
export type PlansResponse = z.output<typeof PlansResponseSchema>;
export type CheckoutRequest = z.output<typeof CheckoutRequestSchema>;
export type RedirectResponse = z.output<typeof RedirectResponseSchema>;
export type AccountExport = z.output<typeof AccountExportSchema>;
export type DeleteAccountRequest = z.output<typeof DeleteAccountRequestSchema>;
