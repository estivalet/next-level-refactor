# ADR-009: Stripe hosted Checkout/Portal for billing

- **Status:** Accepted (2026-10-27, M8: D31, D32)
- **Date:** 2026-10-20

## Context
Paid subscriptions require payment collection, recurring billing, sales-tax handling and card security.

## Decision
Use Stripe Checkout for sign-up, the Customer Portal for plan changes/cancellation/payment
methods, and webhooks as the source of truth for subscription state. Billing sits behind a
switch (FR-SUB-5) so earlier milestones run without it.

M8 decisions: Stripe in **test mode only** (D31); live keys, Stripe Tax and checking that the
owner's Stripe account is eligible (Brazil) are M10 go-live steps after the security §6
checklist. The code sits behind a `BillingProvider` interface (`stripeProvider`,
`stubProvider`). `BILLING_STUB=1` (refused in production) serves a fake Checkout and Portal
that send signed webhooks to the API itself, so tests, CI and demos need no Stripe account
(D32). Webhook events are only triggers: the API re-reads the subscription from the provider
and upserts it, so duplicate and out-of-order events are harmless.

## Consequences
- No card data touches our systems (minimal PCI scope).
- Webhook handling must be idempotent and signature-verified.
- Stripe availability in the owner's country and tax/VAT setup must be checked.

## Alternatives considered
- **Paddle / Lemon Squeezy (merchant of record)**: they handle global sales tax for us, at higher fees. A strong option for an individual selling worldwide; decide before M8.
- **Manual payments + admin grants**: fine for a closed beta using complimentary grants.
