# ADR-009: Stripe hosted Checkout/Portal for billing

- **Status:** Proposed (confirm before M8)
- **Date:** 2026-10-20

## Context
Paid subscriptions require payment collection, recurring billing, sales-tax handling and card security.

## Decision
Use Stripe Checkout for sign-up, the Customer Portal for plan changes/cancellation/payment
methods, and webhooks as the source of truth for subscription state. Billing sits behind a
switch (FR-SUB-5) so earlier milestones run without it.

## Consequences
- No card data touches our systems (minimal PCI scope).
- Webhook handling must be idempotent and signature-verified.
- Stripe availability in the owner's country and tax/VAT setup must be checked.

## Alternatives considered
- **Paddle / Lemon Squeezy (merchant of record)**: they handle global sales tax for us, at higher fees. A strong option for an individual selling worldwide; decide before M8.
- **Manual payments + admin grants**: fine for a closed beta using complimentary grants.
