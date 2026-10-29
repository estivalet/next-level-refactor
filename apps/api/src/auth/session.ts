import type { DeviceInfo, Entitlement, SessionResponse, UserProfile } from '@nextlevel/shared';
import type { ApiContext } from '../context.ts';
import { computeEntitlement, type PlanSummary } from '../entitlements/entitlement.ts';
import { apiError } from '../errors.ts';
import { toPlanSummary } from '../plans/PlanRepository.ts';
import { currentSubscription } from '../subscriptions/current.ts';
import type { SubscriptionRow } from '../subscriptions/SubscriptionRepository.ts';
import { toDevice } from '../users/DeviceRepository.ts';
import type { UserRow } from '../users/UserRepository.ts';
import { signTicket } from './tokens.ts';

export function profileOf(user: UserRow): UserProfile {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    avatarUrl: user.avatarUrl,
    role: user.role,
  };
}

/** The plan every allowed user is on while billing is off (D21); its limit applies to no-plan users. */
export function defaultPlanOf(ctx: ApiContext): PlanSummary {
  const row = ctx.plans.bySlug('default');
  if (!row) throw new Error('the Default plan is missing (openDb seeds it)');
  return toPlanSummary(row, ctx.scopes.list());
}

/**
 * The user's entitlement. `current`: their current subscription when the caller already read it
 * (a users page reads every row's at once); omitted, it is read here.
 */
export function entitlementOf(
  ctx: ApiContext,
  user: UserRow,
  current?: SubscriptionRow | null,
): Entitlement {
  const now = ctx.clock();
  const scopes = ctx.scopes.list();
  const billing = ctx.env.billing.enabled;
  const row = !billing
    ? null
    : current !== undefined
      ? current
      : currentSubscription(ctx.subscriptions.forUser(user.id), now);
  const plan = row ? ctx.plans.byId(row.planId) : undefined;
  return computeEntitlement({
    user,
    billing,
    defaultPlan: defaultPlanOf(ctx),
    current: row && plan ? { row, plan: toPlanSummary(plan, scopes) } : null,
    allScopes: scopes.map((scope) => scope.slug),
    settings: ctx.settings(),
    now,
  });
}

/**
 * Throws `DEVICE_LIMIT` with a ticket when the user's plan has no free device slot (US-A4). Users
 * without a plan (billing on, no subscription) get the Default plan's limit.
 */
export async function assertDeviceSlot(
  ctx: ApiContext,
  user: UserRow,
  device: DeviceInfo,
): Promise<void> {
  if (user.role === 'admin') return;
  const active = ctx.devices.active(user.id);
  const limit = entitlementOf(ctx, user).plan?.deviceLimit ?? defaultPlanOf(ctx).deviceLimit;
  if (active.length < limit) return;
  const ticket = await signTicket({ sub: user.id, device }, ctx.keys, ctx.clock());
  throw apiError('DEVICE_LIMIT', undefined, {
    ticket,
    devices: active.map((row) => toDevice(row, null)),
  });
}

/** Creates the device and its first tokens: the launcher is signed in. */
export async function startSession(
  ctx: ApiContext,
  user: UserRow,
  device: DeviceInfo,
): Promise<SessionResponse> {
  const row = ctx.devices.create(user.id, device, ctx.clock());
  const tokens = await ctx.tokens.issue(row.id);
  return {
    ...tokens,
    deviceId: row.id,
    user: profileOf(user),
    entitlement: entitlementOf(ctx, user),
    banner: ctx.settings().banner,
  };
}
