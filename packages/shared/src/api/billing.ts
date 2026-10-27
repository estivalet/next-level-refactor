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

export type PlanSlug = z.output<typeof PlanSlugSchema>;
export type BillingInterval = z.output<typeof BillingIntervalSchema>;
export type SubscriptionSummary = z.output<typeof SubscriptionSummarySchema>;
export type Price = z.output<typeof PriceSchema>;
export type PlanPrices = z.output<typeof PlanPricesSchema>;
export type PublicPlan = z.output<typeof PublicPlanSchema>;
export type PlansResponse = z.output<typeof PlansResponseSchema>;
export type CheckoutRequest = z.output<typeof CheckoutRequestSchema>;
export type RedirectResponse = z.output<typeof RedirectResponseSchema>;
