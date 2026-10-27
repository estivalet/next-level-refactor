import { and, eq, inArray, ne, or, sql } from 'drizzle-orm';
import { audited } from '../admin/audit.ts';
import type { ApiContext } from '../context.ts';
import {
  adminSessions,
  auditLog,
  devices,
  refreshTokens,
  subscriptions,
  users,
} from '../db/schema.ts';
import { ApiError, apiError } from '../errors.ts';
import { isPayingStripe } from '../subscriptions/current.ts';
import type { UserRow } from '../users/UserRepository.ts';

/** Personal fields removed from audit snapshots about a deleted account. */
const PERSONAL = new Set(['email', 'name', 'suspendedReason', 'avatarUrl']);

function scrub(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(scrub);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([key]) => !PERSONAL.has(key))
        .map(([key, inner]) => [key, scrub(inner)]),
    );
  }
  return value;
}

/**
 * The user as they appear inside other rows' snapshots (e.g. `grantedBy: { id, email }` in a
 * grant they gave someone else): any object carrying their id loses its personal fields.
 */
function scrubPerson(value: unknown, userId: string): unknown {
  if (Array.isArray(value)) return value.map((item) => scrubPerson(item, userId));
  if (value && typeof value === 'object') {
    const own = (value as { id?: unknown }).id === userId;
    return Object.fromEntries(
      Object.entries(value)
        .filter(([key]) => !(own && PERSONAL.has(key)))
        .map(([key, inner]) => [key, scrubPerson(inner, userId)]),
    );
  }
  return value;
}

/** Stripe subscriptions still billing are cancelled first; if Stripe is down, nothing is deleted. */
async function cancelBilling(ctx: ApiContext, userId: string): Promise<void> {
  const paying = ctx.subscriptions.forUser(userId).filter(isPayingStripe);
  for (const row of paying) {
    if (!ctx.billing || !row.stripeSubscriptionId) throw apiError('BILLING_UNAVAILABLE');
    try {
      await ctx.billing.cancelNow(row.stripeSubscriptionId);
    } catch (error) {
      throw error instanceof ApiError ? error : apiError('BILLING_UNAVAILABLE');
    }
  }
}

/**
 * Whether other rows point at the user: the append-only audit log (as actor) or someone else's
 * comp grant (as giver). Such a user is kept as a tombstone, never deleted.
 */
function referenced(ctx: ApiContext, userId: string): boolean {
  const acted = ctx.db.select().from(auditLog).where(eq(auditLog.actorId, userId)).get();
  const gave = ctx.db
    .select()
    .from(subscriptions)
    .where(and(eq(subscriptions.grantedBy, userId), ne(subscriptions.userId, userId)))
    .get();
  return acted !== undefined || gave !== undefined;
}

/** The deletion itself, in the caller's transaction. */
function removeRows(ctx: ApiContext, user: UserRow): void {
  const deviceIds = ctx.devices.all(user.id).map((device) => device.id);
  const subscriptionIds = ctx.subscriptions.forUser(user.id).map((row) => row.id);
  const targets = [user.id, ...deviceIds, ...subscriptionIds];
  for (const entry of ctx.db
    .select()
    .from(auditLog)
    .where(inArray(auditLog.targetId, targets))
    .all()) {
    ctx.db
      .update(auditLog)
      .set({ before: scrub(entry.before), after: scrub(entry.after) })
      .where(eq(auditLog.id, entry.id))
      .run();
  }
  // Rows about other people that still name this user (ids are unique uuids).
  const mention = `%${user.id}%`;
  for (const entry of ctx.db
    .select()
    .from(auditLog)
    .where(or(sql`${auditLog.before} like ${mention}`, sql`${auditLog.after} like ${mention}`))
    .all()) {
    ctx.db
      .update(auditLog)
      .set({
        before: scrubPerson(entry.before, user.id),
        after: scrubPerson(entry.after, user.id),
      })
      .where(eq(auditLog.id, entry.id))
      .run();
  }
  if (deviceIds.length > 0) {
    ctx.db.delete(refreshTokens).where(inArray(refreshTokens.deviceId, deviceIds)).run();
  }
  ctx.db.delete(devices).where(eq(devices.userId, user.id)).run();
  ctx.db.delete(adminSessions).where(eq(adminSessions.userId, user.id)).run();
  // Grants this user gave themselves (as an admin) go with their own subscriptions.
  ctx.db.delete(subscriptions).where(eq(subscriptions.userId, user.id)).run();
  if (referenced(ctx, user.id)) {
    ctx.db
      .update(users)
      .set({
        email: `deleted-${user.id}@deleted.invalid`,
        name: 'Deleted user',
        avatarUrl: null,
        googleSub: `deleted:${user.id}`,
        role: 'subscriber',
        status: 'suspended',
        suspendedReason: null,
      })
      .where(eq(users.id, user.id))
      .run();
  } else {
    ctx.db.delete(users).where(eq(users.id, user.id)).run();
  }
}

/**
 * Delete account (security §5, D36): confirmed by the account's email; admins must be demoted
 * first. A live Stripe subscription is cancelled at once, without a refund (Review Focus 4:
 * Stripe first; if that fails nothing is deleted). Then, in one transaction: tokens, devices,
 * console sessions and subscriptions go, audit snapshots about the account lose its personal
 * fields, and the user row is deleted — or tombstoned when the audit log or another user's grant
 * points at it. `actorId` is the admin who deleted it (audited `user.delete`), null for the user.
 */
export async function deleteAccount(
  ctx: ApiContext,
  userId: string,
  confirmEmail: string,
  actorId: string | null,
): Promise<void> {
  const user = ctx.users.byId(userId);
  if (!user || user.email.endsWith('@deleted.invalid')) throw apiError('NOT_FOUND');
  if (confirmEmail.trim().toLowerCase() !== user.email.toLowerCase()) {
    throw apiError('VALIDATION_FAILED', 'The email does not match.', { reason: 'email' });
  }
  if (user.role === 'admin') throw apiError('CONFLICT', undefined, { reason: 'admin' });
  await cancelBilling(ctx, user.id);
  const remove = () => {
    removeRows(ctx, user);
  };
  if (actorId === null) {
    ctx.db.transaction(remove);
    return;
  }
  const before = { id: user.id, role: user.role, status: user.status, createdAt: user.createdAt };
  audited(
    ctx,
    actorId,
    [{ action: 'user.delete', targetType: 'user', targetId: user.id, before, after: null }],
    remove,
  );
}
