# M8 Subscriptions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Paid access works end to end in Stripe test mode. Admins manage plans, catalog scopes and
complimentary grants. A user without access subscribes from the launcher through Stripe Checkout,
manages billing in the Customer Portal, and the API's subscription state follows Stripe webhooks.
Before anyone is charged, users can download their data and delete their account.

**Architecture:**
- `apps/api`: new modules `billing/` (a `BillingProvider` interface with `stripeProvider` and
  `stubProvider`, checkout/portal, a webhook processor, return pages), `plans/` (plans, scopes,
  public plan list), `subscriptions/` (repository, comp grants, current-subscription rule),
  `account/` (export, delete). `computeEntitlement` reads the current subscription when
  `BILLING_ENABLED=true`. Webhook events are only triggers: the processor re-reads the
  subscription from the provider and upserts it. That makes duplicate and out-of-order events
  harmless.
- `apps/launcher`: `AuthService` is split first (M8-0). Billing and account calls go to a new
  `main/auth/BillingService.ts`, with the IPC channels `auth.plans`, `auth.openCheckout`,
  `auth.openPortal`, `auth.stopWaiting`, `account.export` and `account.delete`. Renderer: the real S3 Subscribe
  screen, plus billing lines and data/delete sections in the Account app.
- `apps/admin`: Plans and Scopes pages; Subscription panel (grant/revoke) and Delete account on
  user detail; Users filters for plan and access.
- **Six PRs**, same loop as M7 (inline TDD with the ledger
  `.superpowers/sdd/2026-10-27-m8-subscriptions/progress.md` → lint, typecheck, test, test:e2e →
  fresh Opus reviewer per branch → re-grade by effect, fix Critical/Important failing-first → PR →
  `gh pr checks <n>` → owner OK → squash-merge → main push run):
  **M8-0** M7 minors + AuthService split + this plan (Tasks 0–1, `fix/m7-minors`);
  **M8a** plans, scopes, subscriptions, comp grants, entitlement (Tasks 2–4, `feat/m8a-plans-grants`);
  **M8b** billing provider, checkout/portal, webhooks (Tasks 5–7, `feat/m8b-billing`);
  **M8c** launcher Subscribe screen + Account billing (Tasks 8–9, `feat/m8c-launcher-billing`);
  **M8d** admin console Plans, Scopes, grants (Tasks 10–11, `feat/m8d-admin-plans`);
  **M8e** data export + account deletion, docs, v0.8.0 (Tasks 12–14, `feat/m8e-account-data`).

**Tech Stack:** one new API runtime dependency: `stripe` (latest major, 23.x at planning time;
pin it in the lockfile). Pin the Stripe `apiVersion` in code to the version the SDK ships with. No
other new runtime dependencies.

**Spec:**
- FR-SUB-1..5, FR-ADM-1 (comp grants), FR-ADM-2; US-A2, US-F2, US-F4; security-and-privacy §4
  (webhooks), §5 data subject rights (export, deletion), §6 (stays a go-live checklist, D31);
  ADR-009 (→ Accepted); data model §5 (`plans`, `subscriptions`, `catalog_scopes`,
  `stripe_events`, Entitlement); api-spec §2 (Me billing, `/v1/plans`, Admin plans/scopes/grants,
  webhooks); IA F7; screens S3, S12, S13 (Plans, Users detail); deployment §5–6 (webhook
  monitoring, runbook); environment-setup (Stripe variables, Stripe CLI).
- No NextLevelOS reference: NextLevelOS has no billing. Nothing is ported in M8.

## Owner decisions

Asked in one batch on 2026-10-27; all answered "recommended".

- **D31 Provider: Stripe, test mode only in M8.** ADR-009 becomes Accepted. Code sits behind a
  `BillingProvider` interface. Live keys, Stripe Tax and checking that the owner's Stripe account
  is eligible (Brazil) are M10 go-live steps, after the security §6 checklist.
- **D32 Billing stub.** `BILLING_STUB=1` (refused in production, like `AUTH_STUB`) serves a fake
  checkout and portal that send signed webhooks to the API itself. Tests, CI and demos need no
  Stripe account. The owner checks real Stripe test mode by hand once (Stripe CLI) before v0.8.0,
  like D26.
- **D33 Billing switch.** `BILLING_ENABLED` stays an env variable. When on, access needs an active
  or past-due Stripe subscription or an active comp grant; everyone else sees Subscribe. The
  Default plan is the billing-off plan only, so existing testers get comp grants. Sign-up mode is
  independent (owner sets `open` at launch).
- **D34 No free trial** in M8.
- **D35 Comp grants:** plan + optional end date (empty = until revoked) + required note
  (1–500 chars); revocable. Granting to a user with an active or past-due Stripe subscription is
  refused (`CONFLICT`, `details.reason: 'subscribed'`): one access-giving subscription per user.
- **D36 Download my data / Delete account** in the launcher Account app (JSON through a Save
  dialog; delete asks the user to type their email). Delete cancels any Stripe subscription
  immediately with no automatic refund (refunds by hand in Stripe), deletes the user's rows and
  pseudonymizes audit entries about them. Admin console user detail gets the same Delete account.
- **D37 Catalog scopes in M8:** `catalog_scopes` table + admin list/create/edit so plans can pick
  scopes (US-F4). Scopes do nothing until M9 catalog items.
- **D38 No dashboard** (FR-ADM-6 → M9). Users list gains plan and access filters.
- **D39 M8-0 cleanup PR:** M7 deferred minors + AuthService split + this plan.

**Calls made in planning (no owner decision; reviewers may challenge):**
- Stripe status → ours: `active`/`trialing` → `active`; `past_due` → `past_due`; `canceled` →
  `canceled`; `unpaid`/`incomplete_expired`/`paused` → `expired`; `incomplete` → not stored (no access
  yet). Entitlement: `active` → `active`; `past_due` → `grace` (Stripe's retry window, FR-SUB-3);
  anything else → `none`.
- Cancelling in the Portal is "at period end": Stripe keeps `active` with
  `cancel_at_period_end`, so access lasts to the paid date; the Account app says "Ends on …".
- `offlineUntil` is capped at the subscription's known end (comp end date, or period end when
  `cancelAtPeriodEnd`), so a comp grant ending 2027-01-31 doesn't run 14 more days offline
  (US-F2).
- The device limit comes from the entitlement's plan. Users with no plan (status `none`, still
  allowed to sign in and see Subscribe) use the Default plan's limit. A downgrade keeps existing
  devices; new sign-ins hit `DEVICE_LIMIT`.
- Saving a Stripe price id on a plan reads the price from the provider: it must be active and
  recurring with the matching interval, and both prices must share one currency. Amount, currency
  and interval are stored on the plan; `GET /v1/plans` never calls Stripe.
- Checkout and portal return to an API page `GET /v1/billing/return?result=success|cancelled|portal`
  ("You can return to NextLevel", en/pt-BR by `Accept-Language`). The launcher polls the
  entitlement every 3 s for up to 2 min after opening checkout (IA F7).
- A user's Stripe customer id is reused from their latest Stripe subscription row. The first
  checkout lets Checkout create the customer (`customer_email`).
- Checkout is refused while the user already has access-giving billing (`CONFLICT`,
  `reason: 'subscribed'`; the launcher offers Manage billing). The portal needs a customer
  (`CONFLICT`, `reason: 'noCustomer'`). Both need billing on (`CONFLICT`, `reason: 'billingOff'`).
- An event for a price no plan carries, or with no `userId` metadata / an unknown user, is
  stored as processed with a warning log; access doesn't change. The ops runbook says the Portal's
  products must match the plans.
- Admins can't delete their own account or be deleted (`CONFLICT`, `reason: 'admin'`): demote
  first. A user who was ever an audit actor or a grant's `granted_by` (a former admin) is not
  deleted but **tombstoned**: the row stays (FKs from the append-only `audit_log` and
  `subscriptions.granted_by` keep pointing at it), with `email` → `deleted-<id>@deleted.invalid`,
  `name` → `Deleted user`, `avatar_url` null, `google_sub` → `deleted:<id>` (so signing in again
  creates a new account), `status` `suspended`, `suspended_reason` null. Everyone else's row is
  deleted. Self-deletion from the launcher is not an admin action and writes no audit entry; an
  admin deletion writes `user.delete` with the email removed from `before`.
- The `default` plan can't be archived (`CONFLICT`, `reason: 'defaultPlan'`). Archived plans keep
  working for existing subscriptions and comp grants, but they don't appear in `/v1/plans` and
  can't be granted or bought.
- Stub billing state is kept in memory. An API restart forgets stub subscriptions, which is fine
  for development; tests never restart.

## Global Constraints

- Everything from the M7 plan still holds: Node 24 erasable TS in `apps/api`, every route declares
  `config.role`, error envelope via `apiError(code)`, response schemas without
  transforms/preprocess, `audited(ctx, actor, entries, mutate)` for every admin write (one
  transaction), request logs by method + path only, files ≤ 400 lines and components ≤ 200,
  every string in i18n (`en.json`/`pt-BR.json`, `admin.en.json`/`admin.pt-BR.json`; edit with a
  `python -I` script, `ensure_ascii=False`, `newline=''`), `*.test` emails only, no network in
  tests.
- **Env (new/changed):** `BILLING_ENABLED` `true|false` (the M7 "must be false" refusal goes);
  `BILLING_STUB` `0|1` (refused with `NODE_ENV=production`); `STRIPE_SECRET_KEY`
  (`sk_test_…` or `sk_live_…`) and `STRIPE_WEBHOOK_SECRET` (`whsec_…`) are required when
  `BILLING_ENABLED=true` and `BILLING_STUB` is not 1. With the stub, the webhook secret defaults
  to a fixed dev value. `Env.billing: { enabled: boolean; mode: 'stripe' | 'stub' | 'none' }`.
  `none` = no keys and no stub: price ids can't be set, checkout refused.
- **Webhooks:** `POST /v1/webhooks/stripe`, role `public`, raw body (buffer content-type parser
  in an encapsulated plugin), `Stripe-Signature` verified (`400 VALIDATION_FAILED` when bad),
  handled types `checkout.session.completed`, `customer.subscription.created|updated|deleted`,
  `invoice.payment_failed`, `invoice.paid`; others → 200 and ignored. Idempotency: a
  `stripe_events` row with `processed_at` set → 200 without work; processing failure → 500
  (Stripe retries) and `processed_at` stays null.
- **Never** log card data, Stripe secrets, `Stripe-Signature` or customer emails. Stripe ids may
  be logged.
- **Audit actions (new):** `plan.create`, `plan.update`, `scope.create`, `scope.update`,
  `grant.create`, `grant.revoke`, `user.delete`; target types gain `plan`, `scope`,
  `subscription`.
- **URL allow-list in the launcher:** checkout URLs must be `https://checkout.stripe.com/…`,
  portal URLs `https://billing.stripe.com/…`, or (stub) the API origin. Anything else is refused
  and logged, never opened.
- **Money:** amounts are integer minor units + ISO 4217 lowercase currency from Stripe; display
  with `Intl.NumberFormat(locale, { style: 'currency', currency })`.

## Review Focus

1. **Webhook delivered twice, or `subscription.updated` before `checkout.session.completed`:**
   the end state must equal the provider's current subscription, with one row per Stripe
   subscription. Pinned in Task 6 (duplicate id → no second processing; reversed order → same row).
2. **A comp grant ends while the launcher is offline:** access must stop at the end date, not
   14 days later. Pinned in Task 4 (`offlineUntil` capped).
3. **Double-click on Choose plan, or Choose plan while already paying:** never two Checkout
   sessions that could both be paid. The API refuses checkout for an already-subscribed user;
   main single-flights `openCheckout`. Pinned in Tasks 5 and 8.
4. **Deleting an account that has a live Stripe subscription when Stripe is down:** deletion must
   not leave a paying subscription without an account. Cancel at Stripe first; if that fails,
   nothing is deleted (`BILLING_UNAVAILABLE`, retry). Pinned in Task 12.
5. **An admin archives a plan or changes its scopes while people are on it:** existing
   subscribers keep the plan and see the new scopes at their next check. The plan disappears
   from `/v1/plans` and grant pickers. Pinned in Task 3.

---

## M8-0 — M7 minors, AuthService split, plan (`fix/m7-minors`)

### Task 0: M7 deferred minors

**Files:**
- Modify: `apps/api/src/admin/users.ts` (demote/suspend deletes that admin's `admin_sessions`),
  `apps/api/src/auth/adminSession.ts` (expired sessions deleted when seen + a prune on sign-in;
  CSRF compare with `crypto.timingSafeEqual` on equal-length buffers),
  `apps/api/src/routes/adminStatic.ts` (bad `%` escapes → 404, `Cache-Control`),
  `apps/api/src/auth/google.ts` (`algorithms: ['RS256']`), `apps/api/src/auth/TokenService.ts`
  (prune), `apps/launcher/src/renderer/features/auth/AccountScreens.tsx` (DeviceLimitScreen
  focus), `apps/launcher/src/renderer/features/account/AccountApp.tsx` (revoke error),
  `apps/admin/src/pages/SettingsPage.tsx`, `SuspendDialog.tsx` and launcher gate fields
  (`aria-describedby` → hint/error ids)
- Test: the co-located tests of each file

- [ ] **Step 1: Failing tests**, one per item:
  - `routes/admin.test.ts`: demoting an admin, or suspending one, deletes their console sessions;
    their next `GET /v1/auth/session` → 401.
  - `routes/adminAuth.test.ts`: a session idle > 8 h is deleted from `admin_sessions` when
    presented; a new admin sign-in deletes every idle-expired session.
  - `auth/adminSession` CSRF: a header of a different length than the cookie → `FORBIDDEN` (no
    throw from `timingSafeEqual`).
  - `routes/adminStatic.test.ts`: `GET /%E0%A4%A` → 400 `VALIDATION_FAILED` envelope (Fastify's router refuses it; ledger ruling); `/assets/x.js` has
    `Cache-Control: public, max-age=31536000, immutable`; `index.html` (and the fallback) has
    `no-cache`.
  - `auth/google.test.ts`: an ID token signed HS256 with a key from the JWKS → `UNAUTHENTICATED`.
  - `auth/TokenService.test.ts`: `issue()` for a device deletes that device's tokens that expired
    more than 1 day ago, or were replaced/revoked more than 1 day ago.
  - `AccountScreens`: DeviceLimitScreen puts focus on the first **Remove and continue**.
  - `AccountApp`: a revoke that fails shows the error text (`role="alert"`) under the list.
  - Admin `SettingsPage`/`SuspendDialog` and launcher sign-in fields: inputs with a hint or
    error carry `aria-describedby` pointing at it; with an error they also carry
    `aria-invalid="true"`.
- [ ] **Step 2: Run** `npx vitest run apps/api apps/admin apps/launcher` → the new tests FAIL.
- [ ] **Step 3: Implement** the smallest change for each.
- [ ] **Step 4: Run** `npx vitest run apps/api apps/admin apps/launcher` → PASS.
- [ ] **Step 5: Commit** `fix: M7 deferred minors (FR-AUTH-7, FR-ADM-1)`.

### Task 1: Split AuthService before adding billing

**Files:**
- Create: `apps/launcher/src/main/auth/SessionVault.ts` (load/store/clear of `auth.session`,
  `remembered`), `apps/launcher/src/main/auth/AccessTokens.ts` (single-flight refresh +
  `withAccess`), `apps/launcher/src/main/auth/browserSignIn.ts` (config → PKCE → loopback →
  browser → code)
- Modify: `apps/launcher/src/main/auth/AuthService.ts` (state machine only, ≤ 250 lines),
  `startAuth.ts`, `testing.ts`; add this plan to the repo
- Test: `SessionVault.test.ts`, `AccessTokens.test.ts`; `AuthService.test.ts` unchanged and green

**Interfaces:**
- Produces:
  - `class SessionVault { constructor(secrets: SecretsLike, log); load(): Promise<SessionRecord | null>; store(s: SessionRecord): Promise<void>; clear(): Promise<void>; current(): SessionRecord | null; remembered(): boolean; probe(): Promise<void> /* sets remembered from secrets.available() */ }`
  - `class AccessTokens { constructor(deps: { api: Pick<ApiClient,'refresh'>; vault: SessionVault; clock; generation: () => number }); withAccess<T>(call: (token: string) => Promise<T>): Promise<T> /* refreshes when older than 13 min */; refresh(): Promise<void> /* single-flight */; set(token: string): void; reset(): void }`
  - `browserSignIn(deps, hooks: { cancelled(); onLoop(loop | null); onBanner(banner) }): Promise<{ code; verifier; redirectUri } | { outcome: SignedOutReason }>`
  - `AuthService` keeps its public methods unchanged. Task 8 adds `accessCall<T>(call: (token: string) => Promise<T>): Promise<T>` (public; wraps `withAccess` with the 401 → `revoked` handling), so BillingService needs no token handling of its own.

- [ ] **Step 1: Failing tests:** `SessionVault`: a store failure flips `remembered()` to false and
  keeps the session in memory; `load()` of invalid JSON → null. `AccessTokens`: two concurrent
  `withAccess` calls with a stale token make exactly one `api.refresh`; a refresh whose
  generation changed meanwhile rejects and doesn't store.
- [ ] **Step 2: Run** `npx vitest run apps/launcher/src/main/auth` → the new tests FAIL.
- [ ] **Step 3: Implement** by moving the code (no behaviour change); `AuthService.test.ts` stays
  as is.
- [ ] **Step 4: Run** `npm run lint && npm run typecheck && npm test && npm run test:e2e` → PASS.
- [ ] **Step 5: Commit** `refactor(launcher): split AuthService (session vault, access tokens, browser sign-in)`
  and `docs: M8 plan (D31–D39)`; fresh Opus review; fixes; PR "M8-0"; CI; owner OK; merge; main run.

---

## M8a — Plans, scopes, subscriptions, comp grants (`feat/m8a-plans-grants`)

### Task 2: Contracts, schema, migration, docs

**Files:**
- Modify: `packages/shared/src/api/auth.ts` (Entitlement `subscription`),
  `packages/shared/src/api/admin.ts`, `packages/shared/src/errors.ts`
  (`BILLING_UNAVAILABLE` 503), `apps/api/src/db/schema.ts`, `apps/api/src/db/open.ts`, docs
  (data model §5, api-spec §2, ADR-009 → Accepted with D31/D32, roadmap M8 ◐,
  environment-setup env table, `.env.example`), i18n
- Create: `packages/shared/src/api/billing.ts`, `apps/api/src/db/migrations/0001_*.sql`
- Test: `packages/shared/src/api/billing.test.ts`, `apps/api/src/db/open.test.ts`

**Interfaces:**
- Produces (shared, Zod + inferred types):
  - `EntitlementSchema` gains `subscription: SubscriptionSummarySchema.nullable().optional()`
    (optional so stored launcher sessions from v0.7 still parse) where
    `SubscriptionSummarySchema { source: 'stripe'|'comp'; status: 'active'|'past_due'|'canceled'|'expired'; interval: 'month'|'year'|null; periodEnd: iso|null; cancelAtPeriodEnd: boolean }`.
  - `PriceSchema { amount: int ≥ 0; currency: string (3 lowercase) }`;
    `PublicPlanSchema { slug; name; deviceLimit; scopes: { slug; name }[]; prices: { month: Price|null; year: Price|null } }`;
    `PlansResponseSchema { billingEnabled: boolean; plans: PublicPlan[] }`.
  - `CheckoutRequestSchema` strict `{ planSlug: slug; interval: 'month'|'year' }`; `RedirectResponseSchema { url: string (url) }`.
  - Admin: `AdminPlanSchema { id; slug; name; deviceLimit; scopeIds: string[]; stripePriceMonthly: string|null; stripePriceYearly: string|null; prices: { month: Price|null; year: Price|null }; archived: boolean; subscribers: int }`;
    `AdminPlanCreateSchema` strict `{ slug (/^[a-z0-9-]{2,40}$/); name (1–60); deviceLimit (int 1–20); scopeIds (≤ 50); stripePriceMonthly?: string|null; stripePriceYearly?: string|null }`;
    `AdminPlanPatchSchema` = partial of create minus `slug`, plus `archived?: boolean`;
    `CatalogScopeSchema { id; slug; name; description: string }` + create (slug/name/description ≤ 500) and patch (no slug);
    `GrantRequestSchema` strict `{ planSlug; expiresAt: iso date-time | null; note: 1–500 }`;
    `AdminSubscriptionSchema { id; source; status; plan: { slug; name }; periodEnd; cancelAtPeriodEnd; interval; stripeSubscriptionId: string|null; grantedBy: { id; email }|null; note: string|null; createdAt }`;
    `AdminUserDetailSchema` gains `subscriptions: AdminSubscription[]` (newest first);
    `AdminUserQuerySchema` gains `plan?: slug` and `access?: 'active'|'grace'|'none'|'comp'`;
    `AuditEntrySchema.targetType` gains `'plan'|'scope'|'subscription'`.
- DB (migration 0001): `plans` + `price_monthly_amount int?`, `price_yearly_amount int?`,
  `currency text?`, `created_at text` (backfilled); `catalog_scopes { id PK, slug UNIQUE, name,
  description, created_at }`; `subscriptions { id PK, user_id FK, plan_id FK, source
  ('stripe'|'comp'), status ('active'|'past_due'|'canceled'|'expired'), interval ('month'|'year')?,
  current_period_end?, cancel_at_period_end bool default false, stripe_customer_id?,
  stripe_subscription_id UNIQUE?, granted_by FK users?, note?, created_at, updated_at }` with
  index `(user_id)`; `stripe_events { id PK, type, received_at, processed_at? }`; `audit_log`
  target enum widened.

- [ ] **Step 1: Failing tests:** `billing.test.ts`: a v0.7 entitlement without `subscription`
  parses; `GrantRequestSchema` refuses an empty note and an unknown key;
  `AdminPlanCreateSchema` refuses slug `Basic Plan` and `deviceLimit: 0`. `open.test.ts`: a DB
  created by migration 0000 with a plan row migrates to 0001 and keeps the Default plan,
  `created_at` set.
- [ ] **Step 2: Run** `npx vitest run packages/shared apps/api/src/db` → FAIL.
- [ ] **Step 3: Implement** schemas and Drizzle tables, then `npm run db:generate -w apps/api`
  and run Prettier on the generated files. Delete `node_modules/.vitest-cache`. Write the docs:
  data model rows, api-spec rows (routes in Tasks 3–7, 12), ADR-009 Accepted, env table.
- [ ] **Step 4: Run** `npm run typecheck && npx vitest run packages/shared apps/api` → PASS.
- [ ] **Step 5: Commit** `feat(shared): billing contracts and subscriptions schema (FR-SUB-1..5)`.

### Task 3: Plans and scopes — admin routes and the public plan list

**Files:**
- Create: `apps/api/src/plans/PlanRepository.ts`, `apps/api/src/plans/ScopeRepository.ts`,
  `apps/api/src/plans/plans.ts` (admin create/update with price checks),
  `apps/api/src/routes/adminPlans.ts`, `apps/api/src/routes/plans.ts`
- Modify: `apps/api/src/context.ts` (`plans`, `scopes`, `billing` provider placeholder
  `ctx.billing: BillingProvider | null`; the interface is defined in Task 5, so here only
  `getPrice` is used and tests inject a fake), `apps/api/src/app.ts`
- Test: `apps/api/src/routes/adminPlans.test.ts`, `apps/api/src/routes/plans.test.ts`

**Interfaces:**
- Consumes: `audited`, `apiError`, Task 2 schemas.
- Produces:
  - `PlanRepository { bySlug(slug): PlanRow|undefined; byId(id); byPriceId(priceId): { plan: PlanRow; interval: 'month'|'year' }|undefined; list(): PlanRow[]; insert(row); update(id, patch) }`;
    `toPlanSummary(row, scopes: ScopeRow[]): PlanSummary` (scopes as slugs).
  - `ScopeRepository { list(); byId(id); bySlug(slug); insert(row); update(id, patch) }`.
  - `ctx.billing?.getPrice(priceId): Promise<{ id; amount; currency; interval: 'month'|'year'|null; active: boolean }>` (the only provider call in this task).
  - Routes: `GET/POST /v1/admin/plans`, `PATCH /v1/admin/plans/:id`, `GET/POST /v1/admin/scopes`,
    `PATCH /v1/admin/scopes/:id` (role `admin`, audited); `GET /v1/plans` (role `public`) →
    `PlansResponse`.

- [ ] **Step 1: Failing tests** (`FR-SUB-1, FR-ADM-2, US-F4`):
  - Create plan → 200 `AdminPlan`; audit `plan.create` with `after`; duplicate slug → `CONFLICT`
    (`reason: 'slugTaken'`); unknown scope id → `VALIDATION_FAILED`.
  - Setting `stripePriceMonthly` reads the price through the fake provider: a yearly price in the
    monthly slot → `VALIDATION_FAILED` (`details.reason: 'interval'`); an inactive price →
    `reason: 'inactive'`; monthly in `brl` and yearly in `usd` → `reason: 'currency'`; with
    `ctx.billing === null` → `CONFLICT` `reason: 'billingOff'`. A good price stores
    amount + currency.
  - Archiving `default` → `CONFLICT` `reason: 'defaultPlan'`.
  - `GET /v1/plans` without auth lists only non-archived plans that have at least one price, with
    scope names; `billingEnabled` mirrors env. **Review Focus 5:** archiving a plan someone is on
    removes it from `/v1/plans`, and that user's entitlement still names it (Task 4 helper); after
    the plan's scopes change, the next `/v1/me/entitlement` has the new scope slugs.
  - Scopes: create/patch audited (`scope.create`/`scope.update`); duplicate slug → `CONFLICT`.
  - A non-admin → `FORBIDDEN` on every admin route (contract test over the route list).
- [ ] **Step 2: Run** `npx vitest run apps/api/src/routes/adminPlans.test.ts apps/api/src/routes/plans.test.ts` → FAIL.
- [ ] **Step 3: Implement.** Price checks happen before the transaction (network), then
  `audited(...)` writes. `subscribers` = count of access-giving subscriptions on the plan.
- [ ] **Step 4: Run** the same → PASS.
- [ ] **Step 5: Commit** `feat(api): plans and catalog scopes admin, public plan list (FR-SUB-1, FR-ADM-2, US-F4)`.

### Task 4: Subscriptions, entitlement with billing, comp grants

**Files:**
- Create: `apps/api/src/subscriptions/SubscriptionRepository.ts`,
  `apps/api/src/subscriptions/current.ts` (pure: which row gives access),
  `apps/api/src/admin/grants.ts`
- Modify: `apps/api/src/entitlements/entitlement.ts`, `apps/api/src/auth/session.ts`
  (`entitlementOf`, `assertDeviceSlot` from the entitlement's plan), `apps/api/src/context.ts`
  (drop `defaultPlan()` callers in favour of `ctx.plans`), `apps/api/src/admin/users.ts`
  (detail `subscriptions`, list filters `plan`/`access`, plan column from entitlement),
  `apps/api/src/routes/admin.ts` (grant routes), `apps/api/src/env.ts` (BILLING_ENABLED true
  allowed; `billing` block)
- Test: `apps/api/src/subscriptions/current.test.ts`, `entitlements/entitlement.test.ts`,
  `routes/adminGrants.test.ts`, `routes/me.test.ts`, `env.test.ts`, `routes/launcherAuth.test.ts`

**Interfaces:**
- Produces:
  - `currentSubscription(rows: SubscriptionRow[], now: Date): SubscriptionRow | null` — the newest
    row that gives access: comp `active` with `current_period_end` null or > now; stripe
    `active` or `past_due`.
  - `computeEntitlement(input: { user: UserRow; billing: boolean; defaultPlan: PlanSummary; current: { row: SubscriptionRow; plan: PlanSummary } | null; allScopes: string[]; settings: AppSettings; now: Date }): Entitlement`
    — suspended → `suspended`; admin → `active`, `plan: null`, `scopes: allScopes`; billing off →
    `active` on Default; `current` stripe `past_due` → `grace`; `current` → `active`; else
    `none` (`plan: null`, `scopes: []`). `offlineUntil = min(now + graceDays, end)` where `end` is
    the comp `current_period_end`, or the period end when `cancelAtPeriodEnd`.
  - `SubscriptionRepository { forUser(userId): SubscriptionRow[]; byStripeId(id); upsertStripe(row); insertComp(row); setStatus(id, status, now); latestCustomerId(userId): string|null; deleteForUser(userId) }`.
  - `grantComp(ctx, actorId, userId, req: GrantRequest): AdminSubscription`;
    `revokeComp(ctx, actorId, userId, subscriptionId): void`.
  - Routes: `POST /v1/admin/users/:id/grants` → `AdminSubscription`;
    `DELETE /v1/admin/users/:id/grants/:subscriptionId` → 204.

- [ ] **Step 1: Failing tests:**
  - `current.test.ts`: expired comp ignored; stripe `canceled` ignored; newest of two wins.
  - `entitlement.test.ts` (`FR-SUB-3, FR-SUB-5`): billing off → Default (M7 tests still pass);
    billing on, no rows → `none`; stripe `past_due` → `grace`; admin → all scope slugs.
    **Review Focus 2:** comp ending in 3 days with `graceDays: 14` → `offlineUntil` = the comp
    end; `cancelAtPeriodEnd` with period end in 5 days → `offlineUntil` = that period end.
  - `adminGrants.test.ts` (`US-F2, FR-SUB-4`): grant `tester@nextlevel.test` until
    2027-01-31 → their entitlement is `active` on that plan; the clock moved to 2027-02-01 →
    `none`. Grant with a stripe `active` row → `CONFLICT` `reason: 'subscribed'`; an archived plan
    → `CONFLICT` `reason: 'archived'`; `expiresAt` in the past → `VALIDATION_FAILED`. Revoke →
    status `canceled`, entitlement `none`; audit `grant.create`/`grant.revoke` (target
    `subscription`). Granting while a comp is active replaces it (old row `canceled`, one audit
    entry each).
  - `launcherAuth.test.ts`: billing on, a user with a 1-device comp plan signing in on a 2nd PC
    → `DEVICE_LIMIT`; a user with no subscription signs in (entitlement `none`) and gets the
    Default plan's limit.
  - `admin.test.ts`: `?access=none` and `?plan=<slug>` filter; detail lists `subscriptions`.
  - `env.test.ts`: `BILLING_ENABLED=true` without keys and without stub → names both Stripe
    variables; `BILLING_STUB=1` in production refused.
- [ ] **Step 2: Run** `npx vitest run apps/api` → the new tests FAIL.
- [ ] **Step 3: Implement.** `access` filter: compute in SQL where simple (`comp` = an active comp
  row), else in the repository with the same `currentSubscription` rule.
- [ ] **Step 4: Run** `npm run lint && npm run typecheck && npm test && npm run test:e2e` → PASS.
- [ ] **Step 5: Commit** `feat(api): subscriptions, entitlement with billing, comp grants (FR-SUB-3..5, FR-ADM-1, US-F2)`;
  fresh Opus review; fixes; PR "M8a"; CI; owner OK; merge; main run.

---

## M8b — Billing provider, checkout, portal, webhooks (`feat/m8b-billing`)

### Task 5: BillingProvider (Stripe + stub), checkout and portal routes, return page

**Files:**
- Create: `apps/api/src/billing/provider.ts` (interface + types), `billing/stripeProvider.ts`,
  `billing/stubProvider.ts`, `billing/stubPages.ts` (HTML), `billing/returnPage.ts`,
  `apps/api/src/routes/billing.ts` (`/v1/me/billing/*`, `/v1/billing/return`),
  `apps/api/src/routes/billingStub.ts` (`/v1/billing/stub/*`, stub only)
- Modify: `apps/api/package.json` (`stripe`), `apps/api/src/app.ts`, `context.ts`
  (`ctx.billing` from env), `apps/api/test/testApp.ts` (`billing: 'stub' | 'off' | BillingProvider`
  option)
- Test: `billing/stripeProvider.test.ts` (Stripe SDK with an injected HTTP client),
  `billing/stubProvider.test.ts`, `routes/billing.test.ts`

**Interfaces:**
- Produces:
  ```ts
  interface ProviderSubscription {
    id: string; customerId: string; userId: string | null; // metadata.userId
    status: 'active'|'trialing'|'past_due'|'canceled'|'unpaid'|'incomplete'|'incomplete_expired'|'paused';
    priceId: string; currentPeriodEnd: string; cancelAtPeriodEnd: boolean;
  }
  interface BillingProvider {
    getPrice(priceId: string): Promise<{ id: string; amount: number; currency: string; interval: 'month'|'year'|null; active: boolean }>;
    createCheckout(input: { userId: string; email: string; customerId: string | null; priceId: string; successUrl: string; cancelUrl: string }): Promise<{ url: string }>;
    createPortal(input: { customerId: string; returnUrl: string }): Promise<{ url: string }>;
    getSubscription(id: string): Promise<ProviderSubscription>;
    cancelNow(subscriptionId: string): Promise<void>;
    verifyEvent(rawBody: Buffer, signature: string): BillingEvent; // throws on a bad signature
  }
  type BillingEvent = { id: string; type: string; subscriptionId: string | null };
  ```
  Stripe: `checkout.sessions.create({ mode: 'subscription', line_items: [{ price, quantity: 1 }], client_reference_id: userId, subscription_data: { metadata: { userId } }, customer | customer_email, success_url, cancel_url })`;
  `billingPortal.sessions.create`; `subscriptions.retrieve` (period end from the first
  subscription item when the API version keeps it there); `webhooks.constructEvent`.
  `subscriptionId` comes from `data.object.subscription` (checkout session, invoice) or
  `data.object.id` (subscription events). Network/5xx errors → `apiError('BILLING_UNAVAILABLE')`.
  Stub: `stubProvider({ publicUrl, webhookSecret, clock, deliver: (raw: string, signature: string) => Promise<void> })`.
  It keeps sessions and subscriptions in maps, signs events with Stripe's header format
  (`t=…,v1=HMAC-SHA256(secret, "t.payload")`), and `verifyEvent` checks the same format. Prices
  in the stub: any id `price_stub_<month|year>_<amount>_<currency>`.
- Routes: `POST /v1/me/billing/checkout` (device) → `{ url }`; `POST /v1/me/billing/portal`
  (device) → `{ url }`; `GET /v1/billing/return?result=` (public, HTML, en/pt-BR);
  stub: `GET /v1/billing/stub/checkout/:session` (Pay / Cancel), `POST …/pay`,
  `GET /v1/billing/stub/portal/:customer` (Cancel at period end, Resume, Switch interval,
  Payment fails, Renew, End now).

- [ ] **Step 1: Failing tests:**
  - `routes/billing.test.ts` (`FR-SUB-2`): checkout for `basic`/`month` with the stub → `url`
    on the API origin. Billing off → `CONFLICT` `billingOff`; an archived or price-less plan →
    `NOT_FOUND`. **Review Focus 3:** a user with an active comp or stripe row → `CONFLICT`
    `subscribed`. Portal without a customer → `CONFLICT` `noCustomer`; with one → `url`. Provider
    throws a network error → 503 `BILLING_UNAVAILABLE`. A suspended user → `SUSPENDED`.
  - `GET /v1/billing/return?result=success` with `Accept-Language: pt-BR` → Portuguese text;
    an unknown `result` → 400.
  - `stubProvider.test.ts`: `verifyEvent` of its own signature passes; a body changed by one byte
    fails; a timestamp older than 5 min fails.
  - `stripeProvider.test.ts`: maps a recorded Stripe subscription JSON fixture (hand-written,
    `*.test` emails, fake ids) to `ProviderSubscription`; `createCheckout` sends `metadata.userId`
    and `customer` when known.
- [ ] **Step 2: Run** `npx vitest run apps/api/src/billing apps/api/src/routes/billing.test.ts` → FAIL.
- [ ] **Step 3: Implement.** `successUrl` = `${PUBLIC_URL}/v1/billing/return?result=success`;
  `cancelUrl` `…cancelled`; portal `returnUrl` `…portal`. The stub's pages carry a visible
  "TEST — no real payment" header.
- [ ] **Step 4: Run** the same → PASS.
- [ ] **Step 5: Commit** `feat(api): billing provider (Stripe, stub), checkout and portal (FR-SUB-2, ADR-009)`.

### Task 6: Webhooks

**Files:**
- Create: `apps/api/src/billing/webhook.ts` (processor), `apps/api/src/routes/webhooks.ts`
- Modify: `apps/api/src/app.ts`, `billing/stubProvider.ts` (`deliver` wired to `app.inject` of
  the webhook route)
- Test: `apps/api/src/billing/webhook.test.ts`, `apps/api/src/routes/webhooks.test.ts`

**Interfaces:**
- Produces: `processEvent(ctx, event: BillingEvent): Promise<'applied' | 'ignored'>` — when
  `subscriptionId` is set, reads `getSubscription`, maps the status (calls above), finds the plan
  by price (`ctx.plans.byPriceId`), upserts by `stripe_subscription_id` with
  `user_id = metadata.userId`; an `incomplete` subscription is not stored.
  Route `POST /v1/webhooks/stripe` (role `public`, raw body): verify → insert `stripe_events`
  (if the id was already processed → 200) → `processEvent` → set `processed_at` → 200.

- [ ] **Step 1: Failing tests** (`FR-SUB-3`):
  - Paying a stub checkout → the user's entitlement is `active` with `subscription.source:
    'stripe'`, `interval: 'month'`.
  - **Review Focus 1:** the same event delivered twice → one row, the second answer 200 without
    calling `getSubscription`; `subscription.updated` processed before `checkout.session.completed`
    → one row, same end state.
  - Portal "Payment fails" → `past_due` → entitlement `grace`; "End now" → `canceled` → `none`;
    "Cancel at period end" → still `active`, `cancelAtPeriodEnd: true`.
  - A bad signature → 400 and no `stripe_events` row; a processing error (provider throws) → 500
    and the row has `processed_at` null; redelivery then succeeds.
  - Unknown price id or missing `userId` → 200, row marked processed, no subscription, a warn log
    without email.
  - An unhandled type (`customer.created`) → 200, ignored.
- [ ] **Step 2: Run** `npx vitest run apps/api/src/billing/webhook.test.ts apps/api/src/routes/webhooks.test.ts` → FAIL.
- [ ] **Step 3: Implement.** Raw body: register the route inside `app.register(async (scope) => { scope.addContentTypeParser('application/json', { parseAs: 'buffer' }, …) })`.
- [ ] **Step 4: Run** the same → PASS.
- [ ] **Step 5: Commit** `feat(api): Stripe webhooks, idempotent, provider-read state (FR-SUB-3)`.

### Task 7: Stripe docs, CLI check, ops

**Files:**
- Modify: `docs/05-operations/environment-setup.md` (Stripe test mode: products + monthly/yearly
  prices, Portal settings: allow cancel at period end, plan switching among the plans' prices,
  `stripe listen --forward-to localhost:4000/v1/webhooks/stripe`, the stub),
  `docs/05-operations/deployment-and-operations.md` (webhook runbook: unknown price, `BILLING_UNAVAILABLE`),
  `docs/02-design/accounts-guide.md` (billing section for the operator), `CHANGELOG.md`
- Test: `apps/api/src/app.test.ts` (OpenAPI path snapshot updated)

- [ ] **Step 1:** Run `npx vitest run apps/api/src/app.test.ts`. The path snapshot fails and its
  diff must list exactly the M8 paths (plans, scopes, grants, billing, return, stub, webhooks).
  Then update it with `-u`.
- [ ] **Step 2:** Write the docs.
- [ ] **Step 3: Run** `npm run lint && npm run typecheck && npm test && npm run test:e2e` → PASS.
- [ ] **Step 4: Commit** `docs: Stripe setup, webhook runbook (FR-SUB-2, FR-SUB-3)`; fresh Opus
  review; fixes; PR "M8b"; CI; owner OK; merge; main run.

---

## M8c — Launcher Subscribe screen and Account billing (`feat/m8c-launcher-billing`)

### Task 8: Main — BillingService and IPC

**Files:**
- Create: `apps/launcher/src/main/auth/BillingService.ts`, `apps/launcher/src/main/auth/billingUrls.ts`
- Modify: `ApiClient.ts` (`plans`, `checkout`, `portal`), `AuthService.ts` (public
  `accessCall`), `authHandlers.ts`, `startAuth.ts`, `packages/shared/src/ipc/authContract.ts`,
  `packages/shared/src/auth/state.ts` (`AuthState.signedIn.waitingForPayment: boolean`)
- Test: `BillingService.test.ts`, `billingUrls.test.ts`, `authHandlers.test.ts`, `ApiClient.test.ts`

**Interfaces:**
- Consumes: `AuthService.accessCall`, `AuthService.refreshEntitlement`.
- Produces:
  - IPC: `auth.plans` (void → `PlansResponse`), `auth.openCheckout`
    (`{ planSlug, interval }` → `AuthState`), `auth.openPortal` (void → void),
    `auth.stopWaiting` (void → `AuthState`).
  - `billingUrlAllowed(url: string, kind: 'checkout' | 'portal', apiOrigin: string): boolean`.
  - `class BillingService { constructor(deps: { auth: AuthService; api; openBrowser; apiOrigin; every; clock; log }); plans(); openCheckout(planSlug, interval): Promise<AuthState>; openPortal(): Promise<void>; stopWaiting(): AuthState }`.
    `openCheckout` is single-flight. It opens the URL, sets `waitingForPayment`, and polls
    `refreshEntitlement` every 3 s for up to 2 min. It stops on `active`/`grace`, on timeout, on
    `stopWaiting` or on sign-out.

- [ ] **Step 1: Failing tests** (`US-A2`):
  - `openCheckout` opens the browser once with the API's URL; entitlement turns `active` on the
    3rd poll → state `signedIn` with `active`, `waitingForPayment: false`, polling stopped.
  - **Review Focus 3:** two `openCheckout` calls at once → one API call, one browser open.
  - After 2 min without access → `waitingForPayment: false`, the screen stays on Subscribe.
  - A URL `https://evil.test/…` → refused, browser not opened, `VALIDATION_FAILED` logged.
    `billingUrlAllowed` accepts `https://checkout.stripe.com/c/pay/x` for checkout,
    `https://billing.stripe.com/p/session/x` for portal, and the API origin for both.
  - API `CONFLICT` `subscribed` → `openCheckout` refreshes the entitlement (already paid).
  - Offline → `API_UNREACHABLE`.
- [ ] **Step 2: Run** `npx vitest run apps/launcher/src/main/auth packages/shared` → FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** the same → PASS.
- [ ] **Step 5: Commit** `feat(launcher): checkout and portal from main, payment polling (FR-SUB-2, US-A2)`.

### Task 9: Renderer — Subscribe screen, Account billing lines, e2e

**Files:**
- Create: `apps/launcher/src/renderer/features/auth/SubscribeScreen.tsx`,
  `apps/launcher/src/renderer/features/auth/PlanCard.tsx`,
  `apps/launcher/src/renderer/features/account/BillingSection.tsx`
- Modify: `AccountScreens.tsx` (remove the placeholder), `AuthGate.tsx`, `authApi.ts` (hooks
  `usePlans`, `useOpenCheckout`, `useOpenPortal`, `useStopWaiting`), `AccountApp.tsx`, i18n,
  `docs/02-design/screen-specifications.md` (S3, S12 as built), `apps/launcher/e2e/auth.spec.ts`,
  `apps/launcher/e2e/testApi.ts` (billing stub on)
- Test: `SubscribeScreen.test.tsx`, `AccountApp.test.tsx`, `AuthGate.test.tsx`, e2e

- [ ] **Step 1: Failing tests** (`US-A2, FR-AUTH-3`):
  - Subscribe with `billingEnabled: false` keeps the M7 placeholder text.
  - With plans: a Month/Year toggle (default Month), one card per plan (name, price formatted
    with `Intl` in the UI locale, device limit, scope names, "Choose"), a plan without a yearly
    price shows "Monthly only" in Year mode with Choose disabled. Choose calls
    `auth.openCheckout` with the slug and interval. While waiting: "Waiting for your payment…"
    with a progress indicator, **I've already paid** (refresh) and **Choose another plan**
    (`stopWaiting`). Sign out stays. Focus on the first Choose; gamepad A activates the focused
    button (existing focus handling).
  - Account: Stripe active → "Basic · Monthly · Renews on 12 Nov 2026" + **Manage billing**;
    `cancelAtPeriodEnd` → "Ends on …"; `past_due` → "Payment failed — update your payment
    details" (`role="alert"`) + Manage billing; comp → "Complimentary · until …" or "until
    revoked", no Manage billing; billing off → the M7 line.
  - e2e `auth.spec.ts`: the `subscriber` persona with billing on and no grant sees Subscribe →
    Choose → the stub checkout is "paid" through the API (the test POSTs the stub's pay endpoint,
    standing in for the browser) → the launcher unlocks within 10 s without a restart (US-A2).
- [ ] **Step 2: Run** `npx vitest run apps/launcher/src/renderer` → FAIL.
- [ ] **Step 3: Implement**; screen spec S3/S12 "As built (M8c)".
- [ ] **Step 4: Run** `npm run lint && npm run typecheck && npm test && npm run test:e2e` → PASS.
- [ ] **Step 5: Commit** `feat(launcher): Subscribe screen and billing in Account (FR-SUB-2, US-A2)`;
  fresh Opus review; fixes; PR "M8c"; CI; owner OK; merge; main run.

---

## M8d — Admin console Plans, Scopes, grants (`feat/m8d-admin-plans`)

### Task 10: Plans and Scopes pages

**Files:**
- Create: `apps/admin/src/pages/PlansPage.tsx`, `PlanEditor.tsx`, `ScopesPage.tsx`,
  `apps/admin/src/api/plans.ts` (hooks)
- Modify: `apps/admin/src/router.ts` (`#/plans`, `#/plans/new`, `#/plans/:id`, `#/scopes`),
  `layout/AdminLayout.tsx` (sidebar), i18n, `docs/02-design/screen-specifications.md` (S13)
- Test: `apps/admin/src/pages/plans.test.tsx`, `router.test.ts`

- [ ] **Step 1: Failing tests** (`FR-ADM-2, US-F4`): Plans table (name, slug, prices, devices,
  scopes, subscribers, Archived badge). The editor saves name, device limit, scope checkboxes,
  the two price-id fields (showing the stored amount after save) and Archived. Server reasons
  are shown on the field: `interval`, `inactive`, `currency`, `billingOff`, `slugTaken`,
  `defaultPlan`. Slug is read-only after create. Scopes page: list, add row, inline edit name and
  description. Save is disabled until something changed (as in Settings).
- [ ] **Step 2: Run** `npx vitest run apps/admin` → FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** the same → PASS.
- [ ] **Step 5: Commit** `feat(admin): Plans and Scopes pages (FR-ADM-2, US-F4)`.

### Task 11: User detail — subscription, grants; Users filters

**Files:**
- Create: `apps/admin/src/pages/SubscriptionPanel.tsx`, `GrantDialog.tsx`
- Modify: `UserDetailPage.tsx`, `UsersPage.tsx` (plan and access filters), `api/hooks.ts`, i18n,
  `apps/admin/e2e/*.spec.ts`
- Test: `pages.test.tsx`, admin e2e

- [ ] **Step 1: Failing tests** (`FR-SUB-4, FR-ADM-1, US-F2`): the panel shows the current
  subscription (source, plan, status, period end, Stripe id as text) and the history. **Grant
  complimentary access** opens a dialog (plan select of non-archived plans, optional end date,
  note required, focus trapped). `subscribed` is explained ("This user pays through Stripe —
  they must cancel first"). Revoke asks for confirmation. Users filters `access` (All, Active,
  Payment failed, No access, Complimentary) and `plan`. e2e: the admin grants `subscriber` a
  comp plan and the audit log shows `grant.create`.
- [ ] **Step 2: Run** `npx vitest run apps/admin` → FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** `npm run lint && npm run typecheck && npm test && npm run test:e2e` → PASS.
- [ ] **Step 5: Commit** `feat(admin): comp grants and subscription panel (FR-SUB-4, FR-ADM-1, US-F2)`;
  fresh Opus review; fixes; PR "M8d"; CI; owner OK; merge; main run.

---

## M8e — Download my data, delete account, release (`feat/m8e-account-data`)

### Task 12: API — export and deletion

**Files:**
- Create: `apps/api/src/account/exportData.ts`, `apps/api/src/account/deleteAccount.ts`,
  `apps/api/src/routes/account.ts`
- Modify: `apps/api/src/routes/admin.ts` (`DELETE /v1/admin/users/:id`),
  `packages/shared/src/api/billing.ts` (`AccountExportSchema`, `DeleteAccountRequestSchema`),
  `docs/06-legal/security-and-privacy.md` §5 (as built), api-spec
- Test: `apps/api/src/routes/account.test.ts`, `routes/admin.test.ts`

**Interfaces:**
- Produces:
  - `GET /v1/me/export` (device) → `AccountExport { exportedAt; user: UserProfile & { status; createdAt; lastSeenAt }; devices: Device[] (revoked included); subscriptions: { source; status; plan; interval; periodEnd; createdAt }[]; audit: { action; at; before; after }[] /* entries about the user or their devices */ }`
    — no token hashes, no admin session data, no other users' emails (who made an audited
    change is left out).
  - `DELETE /v1/me` (device) body `{ confirmEmail }` → 204; `DELETE /v1/admin/users/:id` (admin)
    body `{ confirmEmail }` → 204, audited `user.delete`.
  - `deleteAccount(ctx, userId, actorId: string | null): Promise<void>`. Order: email check
    (mismatch → `VALIDATION_FAILED`, `reason: 'email'`); admin → `CONFLICT` `admin`; cancel the
    access-giving Stripe subscription through `ctx.billing.cancelNow` (failure →
    `BILLING_UNAVAILABLE`, nothing deleted). Then one transaction: delete refresh tokens,
    devices, admin sessions and the user's own subscriptions; scrub `email`/`name`/
    `suspendedReason` from `before`/`after` of audit rows that target the user or their devices;
    then tombstone the user (an audit actor or some grant's `granted_by`, see the calls above) or
    delete the row; write `user.delete` when an admin acted.

- [ ] **Step 1: Failing tests** (security §5):
  - Export contains the user's devices and subscriptions, and no field named `tokenHash` or
    `refreshToken` (deep key scan).
  - Delete with a wrong email → 400, nothing changed. Delete → the user row is gone, their refresh
    token → 401 at `/v1/auth/refresh`, and audit rows about them have no email anywhere
    (deep string scan for the email).
  - **Review Focus 4:** an active stripe subscription and the provider failing `cancelNow` → 503
    `BILLING_UNAVAILABLE`, user and rows intact; with the provider working → `cancelNow` called
    once, then deleted.
  - Admin deletion of another subscriber → 204 + `user.delete` audit without email; deleting an
    admin → `CONFLICT` `admin`.
  - Signing in again after deletion creates a new account (subject to sign-up mode).
  - A demoted former admin with audit entries and a comp grant they gave to someone else →
    deleted as a tombstone: 204, no FK error, the audit entries and the other user's grant stay,
    the tombstone has no email/name/avatar/Google id, and their Google sign-in makes a new account.
- [ ] **Step 2: Run** `npx vitest run apps/api/src/routes/account.test.ts apps/api/src/routes/admin.test.ts` → FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** the same → PASS.
- [ ] **Step 5: Commit** `feat(api): download my data and delete account (security §5, D36)`.

### Task 13: Launcher and admin — Download my data, Delete account

**Files:**
- Create: `apps/launcher/src/main/auth/accountData.ts` (export to a Save dialog, atomic write),
  `apps/launcher/src/renderer/features/account/DataSection.tsx`,
  `apps/launcher/src/renderer/features/account/DeleteAccountDialog.tsx`,
  `apps/admin/src/pages/DeleteUserDialog.tsx`
- Modify: `ApiClient.ts` (`exportData`, `deleteAccount`), `AuthService.ts` (signed-out reason
  `deleted` after a successful delete; session cleared), `packages/shared/src/auth/state.ts`
  (`SIGNED_OUT_REASONS` + `deleted`), `packages/shared/src/ipc/authContract.ts`
  (`account.export` → `{ saved: boolean }`, `account.delete` `{ confirmEmail }` → `AuthState`),
  `AccountApp.tsx`, `SignInScreen.tsx` ("Your account was deleted"), `UserDetailPage.tsx`, i18n
- Test: `accountData.test.ts`, `AccountApp.test.tsx`, `pages.test.tsx`, `e2e/auth.spec.ts`

- [ ] **Step 1: Failing tests:**
  - `account.export` writes the API JSON (pretty, UTF-8) to the chosen path with the atomic-write
    helper; a cancelled dialog → `{ saved: false }`, nothing written; the default file name is
    `nextlevel-data-YYYY-MM-DD.json`.
  - The delete dialog enables **Delete account** only when the typed email equals the account's
    (case-insensitive) and explains what happens (subscription cancelled now, no automatic
    refund, local library untouched). Success → sign-in screen with "Your account was deleted";
    `BILLING_UNAVAILABLE` → error in the dialog, still signed in.
  - Admin user detail: Delete account (typed email), hidden for admins; after success the page
    returns to Users.
  - e2e: sign in as `subscriber`, delete the account → sign-in screen, the library is untouched
    (a game count from before is still there with sign-in off afterwards).
- [ ] **Step 2: Run** `npx vitest run apps/launcher apps/admin packages/shared` → FAIL.
- [ ] **Step 3: Implement**; the Save dialog runs in main (`dialog.showSaveDialog`), the renderer
  never sees a path beyond the result flag.
- [ ] **Step 4: Run** `npm run lint && npm run typecheck && npm test && npm run test:e2e` → PASS.
- [ ] **Step 5: Commit** `feat: download my data and delete account in launcher and admin (D36)`.

### Task 14: Docs, real Stripe check, release v0.8.0

**Files:**
- Modify: `docs/02-design/accounts-guide.md` (subscribing, billing, grants, data and deletion,
  for players and operator), `docs/01-product/roadmap.md` (M8 ☑ with sub-PRs and D31–D39),
  `docs/01-product/02-product-requirements.md` (FR-ADM-1 note), `CHANGELOG.md` (0.8.0),
  `docs/06-legal/security-and-privacy.md` §6 (unchanged boxes; note "go-live in M10")

- [ ] **Step 1:** Write the docs.
- [ ] **Step 2: Run** `npm run lint && npm run typecheck && npm test && npm run test:e2e` → PASS.
- [ ] **Step 3: Commit** `docs: M8 billing guide, v0.8.0 notes (FR-SUB-1..5)`; fresh Opus review;
  fixes; PR "M8e"; CI; owner OK; merge; main run.
- [ ] **Step 4: Owner check (D32):** with Stripe test keys, run `stripe listen`, buy a plan with
  the test card, cancel in the Portal, check the launcher unlocks and the Account app updates.
  If the owner reports a problem, fix it before the tag.
- [ ] **Step 5:** Tag `v0.8.0` on main, publish the GitHub release (notes from CHANGELOG, saying
  test mode only). List the rulings and deferred minors, then delete
  `.superpowers/sdd/2026-10-27-m8-subscriptions/`.
