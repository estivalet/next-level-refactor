import type {
  AdminPlan,
  AdminPlanCreate,
  AdminPlanPatch,
  CatalogScope,
  CatalogScopeCreate,
  CatalogScopePatch,
  PlansResponse,
} from '@nextlevel/shared';
import { audited } from '../admin/audit.ts';
import type { ApiContext } from '../context.ts';
import { apiError } from '../errors.ts';
import { pricesOf, type PlanRow } from './PlanRepository.ts';
import { toCatalogScope } from './ScopeRepository.ts';

// Plans and catalog scopes for the admin console and the public plan list (FR-SUB-1, FR-ADM-2,
// US-F4). Prices are read from the provider when an id is saved; `GET /v1/plans` never calls it.

type PriceFields = Pick<PlanRow, 'priceMonthlyAmount' | 'priceYearlyAmount' | 'currency'>;
type PriceIds = Pick<PlanRow, 'stripePriceMonthly' | 'stripePriceYearly'>;

const invalidPrice = (reason: string) => apiError('VALIDATION_FAILED', undefined, { reason });

async function readPrice(
  ctx: ApiContext,
  priceId: string,
  interval: 'month' | 'year',
): Promise<{ amount: number; currency: string }> {
  if (!ctx.billing) throw apiError('CONFLICT', undefined, { reason: 'billingOff' });
  const price = await ctx.billing.getPrice(priceId);
  if (!price.active) throw invalidPrice('inactive');
  if (price.interval !== interval) throw invalidPrice('interval');
  return { amount: price.amount, currency: price.currency };
}

/**
 * The stored amounts and currency for a plan's two price ids. Only ids that changed are read
 * from the provider; the other keeps what is stored. Both prices must share one currency.
 */
async function resolvePrices(
  ctx: ApiContext,
  next: PriceIds,
  current: (PriceIds & PriceFields) | null,
): Promise<PriceFields> {
  const slot = async (
    id: string | null,
    stored: string | null,
    amount: number | null,
    interval: 'month' | 'year',
  ) => {
    if (id === null) return null;
    if (current && id === stored && amount !== null && current.currency !== null) {
      return { amount, currency: current.currency };
    }
    return readPrice(ctx, id, interval);
  };
  const month = await slot(
    next.stripePriceMonthly,
    current?.stripePriceMonthly ?? null,
    current?.priceMonthlyAmount ?? null,
    'month',
  );
  const year = await slot(
    next.stripePriceYearly,
    current?.stripePriceYearly ?? null,
    current?.priceYearlyAmount ?? null,
    'year',
  );
  if (month && year && month.currency !== year.currency) throw invalidPrice('currency');
  return {
    priceMonthlyAmount: month?.amount ?? null,
    priceYearlyAmount: year?.amount ?? null,
    currency: month?.currency ?? year?.currency ?? null,
  };
}

/** A Stripe price sells one plan only: webhooks map a price back to its plan (`byPriceId`). */
function assertPricesFree(ctx: ApiContext, ids: PriceIds, planId: string | null): void {
  for (const priceId of [ids.stripePriceMonthly, ids.stripePriceYearly]) {
    if (priceId === null) continue;
    const holder = ctx.plans.byPriceId(priceId);
    if (holder && holder.plan.id !== planId) {
      throw apiError('CONFLICT', undefined, { reason: 'priceTaken' });
    }
  }
}

function assertScopes(ctx: ApiContext, scopeIds: readonly string[]): void {
  const known = new Set(ctx.scopes.list().map((scope) => scope.id));
  const unknown = scopeIds.filter((id) => !known.has(id));
  if (unknown.length > 0) {
    throw apiError('VALIDATION_FAILED', 'Unknown catalog scope.', { scopeIds: unknown });
  }
}

export function toAdminPlan(row: PlanRow, subscribers: number): AdminPlan {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    deviceLimit: row.deviceLimit,
    scopeIds: row.scopeIds,
    stripePriceMonthly: row.stripePriceMonthly,
    stripePriceYearly: row.stripePriceYearly,
    prices: pricesOf(row),
    archived: row.archived,
    subscribers,
  };
}

export function listAdminPlans(ctx: ApiContext): AdminPlan[] {
  const counts = ctx.plans.subscriberCounts(ctx.clock());
  return ctx.plans.list().map((row) => toAdminPlan(row, counts.get(row.id) ?? 0));
}

function adminPlan(ctx: ApiContext, id: string): AdminPlan {
  const row = ctx.plans.byId(id);
  if (!row) throw apiError('NOT_FOUND');
  return toAdminPlan(row, ctx.plans.subscriberCounts(ctx.clock()).get(id) ?? 0);
}

export async function createPlan(
  ctx: ApiContext,
  actorId: string,
  body: AdminPlanCreate,
): Promise<AdminPlan> {
  if (ctx.plans.bySlug(body.slug)) throw apiError('CONFLICT', undefined, { reason: 'slugTaken' });
  assertScopes(ctx, body.scopeIds);
  const ids: PriceIds = {
    stripePriceMonthly: body.stripePriceMonthly ?? null,
    stripePriceYearly: body.stripePriceYearly ?? null,
  };
  assertPricesFree(ctx, ids, null);
  // The provider is called before the transaction: no network inside a write.
  const prices = await resolvePrices(ctx, ids, null);
  const row: PlanRow = {
    id: ctx.newId(),
    slug: body.slug,
    name: body.name,
    deviceLimit: body.deviceLimit,
    scopeIds: body.scopeIds,
    ...ids,
    ...prices,
    archived: false,
    createdAt: ctx.clock().toISOString(),
  };
  const after = toAdminPlan(row, 0);
  audited(
    ctx,
    actorId,
    [{ action: 'plan.create', targetType: 'plan', targetId: row.id, before: null, after }],
    () => {
      ctx.plans.insert(row);
    },
  );
  return after;
}

export async function updatePlan(
  ctx: ApiContext,
  actorId: string,
  id: string,
  patch: AdminPlanPatch,
): Promise<AdminPlan> {
  const row = ctx.plans.byId(id);
  if (!row) throw apiError('NOT_FOUND');
  if (patch.archived === true && row.slug === 'default') {
    throw apiError('CONFLICT', undefined, { reason: 'defaultPlan' });
  }
  if (patch.scopeIds) assertScopes(ctx, patch.scopeIds);
  const ids: PriceIds = {
    stripePriceMonthly:
      patch.stripePriceMonthly === undefined ? row.stripePriceMonthly : patch.stripePriceMonthly,
    stripePriceYearly:
      patch.stripePriceYearly === undefined ? row.stripePriceYearly : patch.stripePriceYearly,
  };
  assertPricesFree(ctx, ids, id);
  const prices = await resolvePrices(ctx, ids, row);
  const next: PlanRow = {
    ...row,
    ...(patch.name === undefined ? {} : { name: patch.name }),
    ...(patch.deviceLimit === undefined ? {} : { deviceLimit: patch.deviceLimit }),
    ...(patch.scopeIds === undefined ? {} : { scopeIds: patch.scopeIds }),
    ...(patch.archived === undefined ? {} : { archived: patch.archived }),
    ...ids,
    ...prices,
  };
  const before = adminPlan(ctx, id);
  const after = toAdminPlan(next, before.subscribers);
  // Saving what is already there changes nothing, so nothing is logged.
  if (JSON.stringify(before) === JSON.stringify(after)) return before;
  const changes = {
    name: next.name,
    deviceLimit: next.deviceLimit,
    scopeIds: next.scopeIds,
    archived: next.archived,
    ...ids,
    ...prices,
  };
  audited(
    ctx,
    actorId,
    [{ action: 'plan.update', targetType: 'plan', targetId: id, before, after }],
    () => {
      ctx.plans.update(id, changes);
    },
  );
  return after;
}

export function createScope(
  ctx: ApiContext,
  actorId: string,
  body: CatalogScopeCreate,
): CatalogScope {
  if (ctx.scopes.bySlug(body.slug)) throw apiError('CONFLICT', undefined, { reason: 'slugTaken' });
  const row = { id: ctx.newId(), ...body, createdAt: ctx.clock().toISOString() };
  const after = toCatalogScope(row);
  audited(
    ctx,
    actorId,
    [{ action: 'scope.create', targetType: 'scope', targetId: row.id, before: null, after }],
    () => {
      ctx.scopes.insert(row);
    },
  );
  return after;
}

export function updateScope(
  ctx: ApiContext,
  actorId: string,
  id: string,
  patch: CatalogScopePatch,
): CatalogScope {
  const row = ctx.scopes.byId(id);
  if (!row) throw apiError('NOT_FOUND');
  const changes = {
    name: patch.name ?? row.name,
    description: patch.description ?? row.description,
  };
  const before = toCatalogScope(row);
  const after = toCatalogScope({ ...row, ...changes });
  if (JSON.stringify(before) === JSON.stringify(after)) return before;
  audited(
    ctx,
    actorId,
    [{ action: 'scope.update', targetType: 'scope', targetId: id, before, after }],
    () => {
      ctx.scopes.update(id, changes);
    },
  );
  return after;
}

/** Plans on sale: not archived, at least one price (S3). */
export function publicPlans(ctx: ApiContext): PlansResponse {
  const scopes = new Map(ctx.scopes.list().map((scope) => [scope.id, scope]));
  const plans = ctx.plans
    .list()
    .filter((row) => !row.archived)
    .map((row) => ({
      slug: row.slug,
      name: row.name,
      deviceLimit: row.deviceLimit,
      scopes: row.scopeIds.flatMap((id) => {
        const scope = scopes.get(id);
        return scope ? [{ slug: scope.slug, name: scope.name }] : [];
      }),
      prices: pricesOf(row),
    }))
    .filter((plan) => plan.prices.month !== null || plan.prices.year !== null);
  return { billingEnabled: ctx.env.billing.enabled, plans };
}
