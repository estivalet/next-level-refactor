import { defaultAppSettings } from '@nextlevel/shared';
import { describe, expect, it } from 'vitest';
import type { SubscriptionRow } from '../subscriptions/SubscriptionRepository.ts';
import type { UserRow } from '../users/UserRepository.ts';
import { computeEntitlement, type PlanSummary } from './entitlement.ts';

const NOW = new Date('2026-10-25T12:00:00.000Z');
const DAY = 24 * 3600_000;
const PLAN: PlanSummary = { slug: 'default', name: 'Default', deviceLimit: 3, scopes: [] };
const BASIC: PlanSummary = { slug: 'basic', name: 'Basic', deviceLimit: 2, scopes: ['demos'] };
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
const SUB: SubscriptionRow = {
  id: 's1',
  userId: 'u1',
  planId: 'p-basic',
  source: 'stripe',
  status: 'active',
  interval: 'month',
  currentPeriodEnd: new Date(NOW.getTime() + 20 * DAY).toISOString(),
  cancelAtPeriodEnd: false,
  stripeCustomerId: 'cus_1',
  stripeSubscriptionId: 'sub_1',
  grantedBy: null,
  note: null,
  createdAt: NOW.toISOString(),
  updatedAt: NOW.toISOString(),
};

function at(
  user: Partial<UserRow>,
  opts: { graceDays?: number; billing?: boolean; current?: Partial<SubscriptionRow> | null } = {},
) {
  return computeEntitlement({
    user: { ...USER, ...user },
    billing: opts.billing ?? false,
    defaultPlan: PLAN,
    current: opts.current ? { row: { ...SUB, ...opts.current }, plan: BASIC } : null,
    allScopes: ['demos', 'homebrew-8bit'],
    settings: { ...defaultAppSettings(), graceDays: opts.graceDays ?? 14 },
    now: NOW,
  });
}

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
    expect(at({}, { graceDays: 3 }).offlineUntil).toBe('2026-10-28T12:00:00.000Z');
  });

  it('C6: an admin is active without a plan, with every scope', () => {
    expect(at({ role: 'admin' })).toMatchObject({
      role: 'admin',
      status: 'active',
      plan: null,
      scopes: ['demos', 'homebrew-8bit'],
    });
  });

  it('C6, FR-AUTH-7: suspension wins over everything, admins and subscribers included', () => {
    expect(at({ status: 'suspended' })).toMatchObject({
      status: 'suspended',
      plan: null,
      scopes: [],
    });
    expect(at({ status: 'suspended', role: 'admin' }).status).toBe('suspended');
    expect(at({ status: 'suspended' }, { billing: true, current: {} }).status).toBe('suspended');
  });
});

describe('entitlement with billing on (FR-SUB-3, FR-SUB-5, D33)', () => {
  it('no current subscription → none, no plan, no scopes', () => {
    expect(at({}, { billing: true })).toMatchObject({
      status: 'none',
      plan: null,
      scopes: [],
      subscription: null,
    });
  });

  it('a current subscription → active on its plan with its scopes and a summary', () => {
    expect(at({}, { billing: true, current: {} })).toMatchObject({
      status: 'active',
      plan: { slug: 'basic', name: 'Basic', deviceLimit: 2 },
      scopes: ['demos'],
      subscription: {
        source: 'stripe',
        status: 'active',
        interval: 'month',
        periodEnd: SUB.currentPeriodEnd,
        cancelAtPeriodEnd: false,
      },
    });
  });

  it('FR-SUB-3: Stripe past_due → grace, still on the plan', () => {
    expect(at({}, { billing: true, current: { status: 'past_due' } })).toMatchObject({
      status: 'grace',
      plan: { slug: 'basic' },
    });
  });

  it('admins stay active without a plan', () => {
    expect(at({ role: 'admin' }, { billing: true })).toMatchObject({
      status: 'active',
      plan: null,
    });
  });

  it('Review Focus 2: a comp grant ending in 3 days caps offlineUntil at its end', () => {
    const end = new Date(NOW.getTime() + 3 * DAY).toISOString();
    const comp = { source: 'comp', interval: null, currentPeriodEnd: end } as const;
    expect(at({}, { billing: true, current: comp }).offlineUntil).toBe(end);
  });

  it('Review Focus 2: cancelling at a period end in 5 days caps offlineUntil there', () => {
    const end = new Date(NOW.getTime() + 5 * DAY).toISOString();
    expect(
      at({}, { billing: true, current: { cancelAtPeriodEnd: true, currentPeriodEnd: end } })
        .offlineUntil,
    ).toBe(end);
    // A renewing subscription is not capped: Stripe renews it before the period ends.
    const renewing = at({}, { billing: true, current: { currentPeriodEnd: end } });
    expect(renewing.offlineUntil).toBe(new Date(NOW.getTime() + 14 * DAY).toISOString());
  });
});
