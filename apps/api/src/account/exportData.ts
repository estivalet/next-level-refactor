import type { AccountExport } from '@nextlevel/shared';
import { asc, inArray } from 'drizzle-orm';
import type { ApiContext } from '../context.ts';
import { auditLog } from '../db/schema.ts';
import { apiError } from '../errors.ts';

/** Keys never exported: other people (who granted) and secrets, wherever they appear. */
const HIDDEN = new Set(['grantedBy', 'tokenHash', 'refreshToken', 'accessToken', 'googleSub']);

function scrub(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(scrub);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([key]) => !HIDDEN.has(key))
        .map(([key, inner]) => [key, scrub(inner)]),
    );
  }
  return value;
}

/**
 * "Download my data" (security §5, D36): the profile, every device (revoked ones too), the
 * subscriptions and the audit entries about the account. No token hashes, no admin sessions,
 * and no other people: who made a change is left out.
 */
export function exportData(ctx: ApiContext, userId: string): AccountExport {
  const user = ctx.users.byId(userId);
  if (!user) throw apiError('NOT_FOUND');
  const devices = ctx.devices.all(user.id);
  const subscriptions = ctx.subscriptions.forUser(user.id);
  const targets = [user.id, ...devices.map((d) => d.id), ...subscriptions.map((s) => s.id)];
  const audit = ctx.db
    .select()
    .from(auditLog)
    .where(inArray(auditLog.targetId, targets))
    .orderBy(asc(auditLog.at), asc(auditLog.id))
    .all();
  return {
    exportedAt: ctx.clock().toISOString(),
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      avatarUrl: user.avatarUrl,
      role: user.role,
      status: user.status,
      createdAt: user.createdAt,
      lastSeenAt: user.lastSeenAt,
    },
    devices: devices.map((device) => ({
      id: device.id,
      name: device.name,
      platform: device.platform,
      appVersion: device.appVersion,
      createdAt: device.createdAt,
      lastSeenAt: device.lastSeenAt,
      revokedAt: device.revokedAt,
    })),
    subscriptions: subscriptions.map((row) => {
      const plan = ctx.plans.byId(row.planId);
      return {
        source: row.source,
        status: row.status,
        plan: { slug: plan?.slug ?? '', name: plan?.name ?? '' },
        interval: row.interval,
        periodEnd: row.currentPeriodEnd,
        createdAt: row.createdAt,
      };
    }),
    audit: audit.map((entry) => ({
      action: entry.action,
      at: entry.at,
      before: scrub(entry.before),
      after: scrub(entry.after),
    })),
  };
}
