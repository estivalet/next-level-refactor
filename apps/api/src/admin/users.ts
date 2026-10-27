import type {
  AdminUserDetail,
  AdminUserPatch,
  AdminUserQuery,
  AdminUserSummary,
  Page,
} from '@nextlevel/shared';
import { and, count, desc, eq, lt, or, sql, type SQL } from 'drizzle-orm';
import { entitlementOf } from '../auth/session.ts';
import type { ApiContext } from '../context.ts';
import { adminSessions, devices, users } from '../db/schema.ts';
import { apiError } from '../errors.ts';
import { toDevice } from '../users/DeviceRepository.ts';
import type { UserRow } from '../users/UserRepository.ts';
import { audited, auditPage, type AuditInput } from './audit.ts';
import { adminSubscriptions } from './grants.ts';
import { planAccessFilter } from './userFilters.ts';

const activeDevices = sql<number>`(select count(*) from ${devices} where ${devices.userId} = ${users.id} and ${devices.revokedAt} is null)`;

function summary(user: UserRow, deviceCount: number): AdminUserSummary {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    avatarUrl: user.avatarUrl,
    role: user.role,
    status: user.status,
    devices: deviceCount,
    lastSeenAt: user.lastSeenAt,
    createdAt: user.createdAt,
  };
}

function afterCursor(cursor: string | undefined): SQL | undefined {
  if (!cursor) return undefined;
  const [at, id] = Buffer.from(cursor, 'base64url').toString().split('|');
  if (!at || !id) throw apiError('VALIDATION_FAILED', 'Bad cursor.');
  return or(lt(users.createdAt, at), and(eq(users.createdAt, at), lt(users.id, id)));
}

/** FR-ADM-1: newest first; `q` matches email or name ignoring case. */
export function listUsers(ctx: ApiContext, query: AdminUserQuery): Page<AdminUserSummary> {
  const limit = query.limit ?? 50;
  // `%`, `_` and `\` in the search are literal: escaped, with an explicit ESCAPE (SQLite has none).
  const q = query.q?.toLowerCase().replace(/[%_\\]/g, (c) => `\\${c}`);
  const contains = (column: SQL) => sql`${column} like ${`%${q ?? ''}%`} escape '\\'`;
  const filters = [
    q ? or(contains(sql`lower(${users.email})`), contains(sql`lower(${users.name})`)) : undefined,
    query.status ? eq(users.status, query.status) : undefined,
    planAccessFilter(ctx, query),
    afterCursor(query.cursor),
  ].filter((f): f is SQL => f !== undefined);
  const rows = ctx.db
    .select({ user: users, devices: activeDevices })
    .from(users)
    .where(filters.length > 0 ? and(...filters) : undefined)
    .orderBy(desc(users.createdAt), desc(users.id))
    .limit(limit + 1)
    .all();
  const items = rows.slice(0, limit).map((row) => summary(row.user, row.devices));
  const last = items.at(-1);
  const nextCursor =
    rows.length > limit && last
      ? Buffer.from(`${last.createdAt}|${last.id}`).toString('base64url')
      : null;
  return { items, nextCursor };
}

export function userDetail(ctx: ApiContext, id: string): AdminUserDetail {
  const user = ctx.users.byId(id);
  if (!user) throw apiError('NOT_FOUND');
  const all = ctx.devices.all(user.id);
  const active = all.filter((d) => d.revokedAt === null).length;
  return {
    ...summary(user, active),
    suspendedReason: user.suspendedReason,
    entitlement: entitlementOf(ctx, user),
    devices: all.map((row) => toDevice(row, null)),
    audit: auditPage(ctx, { targets: [user.id, ...all.map((d) => d.id)], limit: 20 }).items,
    subscriptions: adminSubscriptions(ctx, user.id),
  };
}

function activeAdmins(ctx: ApiContext): number {
  return (
    ctx.db
      .select({ n: count() })
      .from(users)
      .where(and(eq(users.role, 'admin'), eq(users.status, 'active')))
      .get()?.n ?? 0
  );
}

/** Role and suspension changes, audited; an admin can't lock themselves or the last admin out. */
export function patchUser(
  ctx: ApiContext,
  actorId: string,
  id: string,
  patch: AdminUserPatch,
): AdminUserDetail {
  const user = ctx.users.byId(id);
  if (!user) throw apiError('NOT_FOUND');
  const demote = patch.role === 'subscriber' && user.role === 'admin';
  const suspend = patch.status === 'suspended' && user.status === 'active';
  const unsuspend = patch.status === 'active' && user.status === 'suspended';
  const promote = patch.role === 'admin' && user.role === 'subscriber';
  if ((demote || suspend) && user.role === 'admin') {
    if (user.id === actorId) throw apiError('CONFLICT', undefined, { reason: 'self' });
    // Defensive: the actor is an active admin, so with `self` refused this needs a second path in.
    if (user.status === 'active' && activeAdmins(ctx) <= 1) {
      throw apiError('CONFLICT', undefined, { reason: 'lastAdmin' });
    }
  }
  const entries: AuditInput[] = [];
  const target = { targetType: 'user' as const, targetId: user.id };
  if (demote || promote) {
    entries.push({
      action: 'user.role',
      ...target,
      before: { role: user.role },
      after: { role: patch.role },
    });
  }
  if (suspend) {
    entries.push({
      action: 'user.suspend',
      ...target,
      before: { status: user.status, suspendedReason: user.suspendedReason },
      after: { status: 'suspended', suspendedReason: patch.suspendedReason ?? null },
    });
  }
  if (unsuspend) {
    entries.push({
      action: 'user.unsuspend',
      ...target,
      before: { status: user.status, suspendedReason: user.suspendedReason },
      after: { status: 'active', suspendedReason: null },
    });
  }
  if (entries.length > 0) {
    audited(ctx, actorId, entries, () => {
      ctx.db
        .update(users)
        .set({
          ...(demote || promote ? { role: patch.role } : {}),
          ...(suspend
            ? { status: 'suspended', suspendedReason: patch.suspendedReason ?? null }
            : {}),
          ...(unsuspend ? { status: 'active', suspendedReason: null } : {}),
        })
        .where(eq(users.id, user.id))
        .run();
      // A former admin's open console tabs end at once, not at their next request.
      if (demote || suspend) {
        ctx.db.delete(adminSessions).where(eq(adminSessions.userId, user.id)).run();
      }
    });
  }
  return userDetail(ctx, user.id);
}

/** Signs one of a user's launchers out (its refresh tokens too), audited. */
export function revokeUserDevice(
  ctx: ApiContext,
  actorId: string,
  userId: string,
  deviceId: string,
): void {
  const device = ctx.devices.byId(deviceId);
  if (!device || device.userId !== userId || device.revokedAt !== null) throw apiError('NOT_FOUND');
  const at = ctx.clock().toISOString();
  audited(
    ctx,
    actorId,
    [
      {
        action: 'device.revoke',
        targetType: 'device',
        targetId: device.id,
        before: { name: device.name, revokedAt: null },
        after: { name: device.name, revokedAt: at },
      },
    ],
    () => {
      ctx.tokens.revokeDevice(device.id);
    },
  );
}
