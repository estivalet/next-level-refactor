import { defaultAppSettings } from '@nextlevel/shared';
import { describe, expect, it } from 'vitest';
import type { UserRow } from '../users/UserRepository.ts';
import { computeEntitlement, type PlanSummary } from './entitlement.ts';

const NOW = new Date('2026-10-25T12:00:00.000Z');
const PLAN: PlanSummary = { slug: 'default', name: 'Default', deviceLimit: 3, scopes: [] };
const USER: UserRow = {
  id: 'u1',
  googleSub: 'g',
  email: 'p@example.test',
  name: 'P',
  avatarUrl: null,
  role: 'subscriber',
  status: 'active',
  suspendedReason: null,
  createdAt: NOW.toISOString(),
  lastSeenAt: null,
};
const at = (user: Partial<UserRow>, graceDays = 14) =>
  computeEntitlement({ ...USER, ...user }, PLAN, { ...defaultAppSettings(), graceDays }, NOW);

describe('entitlement (data model §5, C6 server side)', () => {
  it('C6: a subscriber is active on the Default plan while billing is off (D21)', () => {
    expect(at({})).toEqual({
      userId: 'u1',
      role: 'subscriber',
      status: 'active',
      plan: { slug: 'default', name: 'Default', deviceLimit: 3 },
      scopes: [],
      checkedAt: '2026-10-25T12:00:00.000Z',
      offlineUntil: '2026-11-08T12:00:00.000Z',
    });
  });

  it('C6: offlineUntil follows the grace days (FR-AUTH-5)', () => {
    expect(at({}, 3).offlineUntil).toBe('2026-10-28T12:00:00.000Z');
  });

  it('C6: an admin is active without a plan', () => {
    expect(at({ role: 'admin' })).toMatchObject({ role: 'admin', status: 'active', plan: null });
  });

  it('C6, FR-AUTH-7: suspension wins over everything, admins included', () => {
    expect(at({ status: 'suspended' })).toMatchObject({
      status: 'suspended',
      plan: null,
      scopes: [],
    });
    expect(at({ status: 'suspended', role: 'admin' }).status).toBe('suspended');
  });
});
