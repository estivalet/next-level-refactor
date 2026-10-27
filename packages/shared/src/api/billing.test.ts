import { describe, expect, it } from 'vitest';
import {
  AdminPlanCreateSchema,
  AdminPlanPatchSchema,
  AuditEntrySchema,
  CheckoutRequestSchema,
  EntitlementSchema,
  GrantRequestSchema,
  PlansResponseSchema,
} from '../index.ts';

const ENTITLEMENT_V07 = {
  userId: 'u1',
  role: 'subscriber',
  status: 'active',
  plan: { slug: 'default', name: 'Default', deviceLimit: 3 },
  scopes: [],
  checkedAt: '2026-10-27T12:00:00.000Z',
  offlineUntil: '2026-11-10T12:00:00.000Z',
} as const;

const SUMMARY = {
  source: 'comp',
  status: 'active',
  interval: null,
  periodEnd: '2027-01-31T00:00:00.000Z',
  cancelAtPeriodEnd: false,
} as const;

describe('billing contracts (FR-SUB-1..5)', () => {
  it('a v0.7 entitlement without a subscription still parses (stored launcher sessions)', () => {
    expect(EntitlementSchema.parse(ENTITLEMENT_V07).subscription).toBeUndefined();
  });

  it('an entitlement keeps its subscription summary', () => {
    expect(
      EntitlementSchema.parse({ ...ENTITLEMENT_V07, subscription: SUMMARY }).subscription,
    ).toEqual(SUMMARY);
  });

  it('a grant needs a note and refuses unknown keys (D35)', () => {
    const grant = { planSlug: 'basic', expiresAt: null, note: 'Beta tester' };
    expect(GrantRequestSchema.safeParse(grant).success).toBe(true);
    expect(GrantRequestSchema.safeParse({ ...grant, note: '' }).success).toBe(false);
    expect(GrantRequestSchema.safeParse({ ...grant, note: 'x'.repeat(501) }).success).toBe(false);
    expect(GrantRequestSchema.safeParse({ ...grant, extra: 1 }).success).toBe(false);
  });

  it('a plan slug is lowercase and a plan allows at least one device', () => {
    const plan = { slug: 'basic', name: 'Basic', deviceLimit: 2, scopeIds: [] };
    expect(AdminPlanCreateSchema.safeParse(plan).success).toBe(true);
    expect(AdminPlanCreateSchema.safeParse({ ...plan, slug: 'Basic Plan' }).success).toBe(false);
    expect(AdminPlanCreateSchema.safeParse({ ...plan, deviceLimit: 0 }).success).toBe(false);
    expect(AdminPlanCreateSchema.safeParse({ ...plan, deviceLimit: 21 }).success).toBe(false);
  });

  it('a plan patch cannot change the slug but can archive', () => {
    expect(AdminPlanPatchSchema.safeParse({ archived: true }).success).toBe(true);
    expect(AdminPlanPatchSchema.safeParse({ slug: 'other' }).success).toBe(false);
  });

  it('checkout takes a plan slug and month or year', () => {
    expect(CheckoutRequestSchema.safeParse({ planSlug: 'basic', interval: 'year' }).success).toBe(
      true,
    );
    expect(CheckoutRequestSchema.safeParse({ planSlug: 'basic', interval: 'week' }).success).toBe(
      false,
    );
  });

  it('a price is minor units in a lowercase ISO currency', () => {
    const response = (month: unknown) =>
      PlansResponseSchema.safeParse({
        billingEnabled: true,
        plans: [
          {
            slug: 'basic',
            name: 'Basic',
            deviceLimit: 2,
            scopes: [],
            prices: { month, year: null },
          },
        ],
      }).success;
    expect(response({ amount: 1990, currency: 'brl' })).toBe(true);
    expect(response({ amount: 19.9, currency: 'brl' })).toBe(false);
    expect(response({ amount: 1990, currency: 'BRL' })).toBe(false);
  });

  it('audit entries can target plans, scopes and subscriptions', () => {
    for (const targetType of ['plan', 'scope', 'subscription']) {
      const entry = {
        id: 'a',
        actor: { id: 'u', email: 'admin@nextlevel.test' },
        action: 'plan.create',
        targetType,
        targetId: 't',
        before: null,
        after: null,
        at: '2026-10-27T12:00:00.000Z',
      };
      expect(AuditEntrySchema.safeParse(entry).success).toBe(true);
    }
  });
});
