import { user } from '../test-utils.tsx';

// Shared fixtures for the subscription panel tests (S13, FR-SUB-4).

export const ENTITLEMENT = {
  userId: 'u2',
  role: 'subscriber',
  status: 'active',
  plan: { slug: 'basic', name: 'Basic', deviceLimit: 2 },
  scopes: [],
  checkedAt: '2026-10-25T12:00:00.000Z',
  offlineUntil: '2026-11-08T12:00:00.000Z',
};

export const sub = (overrides: Record<string, unknown> = {}) => ({
  id: 's1',
  source: 'stripe',
  status: 'active',
  plan: { slug: 'basic', name: 'Basic' },
  periodEnd: '2026-11-12T12:00:00.000Z',
  cancelAtPeriodEnd: false,
  interval: 'month',
  stripeSubscriptionId: 'sub_123',
  grantedBy: null,
  note: null,
  createdAt: '2026-10-12T12:00:00.000Z',
  ...overrides,
});

export const PLANS = [
  {
    id: 'p1',
    slug: 'basic',
    name: 'Basic',
    deviceLimit: 2,
    scopeIds: [],
    stripePriceMonthly: null,
    stripePriceYearly: null,
    prices: { month: null, year: null },
    archived: false,
    subscribers: 1,
  },
  {
    id: 'p2',
    slug: 'old',
    name: 'Old',
    deviceLimit: 1,
    scopeIds: [],
    stripePriceMonthly: null,
    stripePriceYearly: null,
    prices: { month: null, year: null },
    archived: true,
    subscribers: 0,
  },
];

export const detail = (subscriptions: unknown[]) => ({
  ...user('u2', 'player@example.test'),
  suspendedReason: null,
  entitlement: ENTITLEMENT,
  devices: [],
  audit: [],
  subscriptions,
});

export const conflict = (reason: string) => ({
  status: 409,
  body: { error: { code: 'CONFLICT', message: 'm', requestId: 'r', details: { reason } } },
});

export const COMP = () =>
  sub({ id: 'c1', source: 'comp', stripeSubscriptionId: null, interval: null, periodEnd: null });
