import type { AppSettings, Entitlement } from '@nextlevel/shared';
import type { UserRow } from '../users/UserRepository.ts';

export interface PlanSummary {
  slug: string;
  name: string;
  deviceLimit: number;
  scopeIds: string[];
}

const DAY_MS = 24 * 3600_000;

/**
 * What a user may do right now (data model §5). Suspension wins; admins are active without a
 * plan; while billing is off every other user is active on the Default plan (FR-SUB-5, D21).
 * `offlineUntil` bounds how long the launcher may run without checking again (FR-AUTH-5).
 */
export function computeEntitlement(
  user: UserRow,
  plan: PlanSummary,
  settings: AppSettings,
  now: Date,
): Entitlement {
  const base = {
    userId: user.id,
    role: user.role,
    checkedAt: now.toISOString(),
    offlineUntil: new Date(now.getTime() + settings.graceDays * DAY_MS).toISOString(),
  };
  if (user.status === 'suspended') return { ...base, status: 'suspended', plan: null, scopes: [] };
  // No catalog scopes exist before M9; admins will get every scope then.
  if (user.role === 'admin') return { ...base, status: 'active', plan: null, scopes: [] };
  return {
    ...base,
    status: 'active',
    plan: { slug: plan.slug, name: plan.name, deviceLimit: plan.deviceLimit },
    scopes: plan.scopeIds,
  };
}
