import type { DeviceInfo, Entitlement, SessionResponse, UserProfile } from '@nextlevel/shared';
import type { ApiContext } from '../context.ts';
import { computeEntitlement } from '../entitlements/entitlement.ts';
import { apiError } from '../errors.ts';
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

export function entitlementOf(ctx: ApiContext, user: UserRow): Entitlement {
  return computeEntitlement(user, ctx.defaultPlan(), ctx.settings(), ctx.clock());
}

/** Throws `DEVICE_LIMIT` with a ticket when the user's plan has no free device slot (US-A4). */
export async function assertDeviceSlot(
  ctx: ApiContext,
  user: UserRow,
  device: DeviceInfo,
): Promise<void> {
  if (user.role === 'admin') return;
  const active = ctx.devices.active(user.id);
  if (active.length < ctx.defaultPlan().deviceLimit) return;
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
