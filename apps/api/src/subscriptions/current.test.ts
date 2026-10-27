import { describe, expect, it } from 'vitest';
import { currentSubscription } from './current.ts';
import type { SubscriptionRow } from './SubscriptionRepository.ts';

const NOW = new Date('2026-10-25T12:00:00.000Z');

function row(overrides: Partial<SubscriptionRow>): SubscriptionRow {
  return {
    id: 's',
    userId: 'u1',
    planId: 'p',
    source: 'comp',
    status: 'active',
    interval: null,
    currentPeriodEnd: null,
    cancelAtPeriodEnd: false,
    stripeCustomerId: null,
    stripeSubscriptionId: null,
    grantedBy: null,
    note: null,
    createdAt: '2026-10-01T00:00:00.000Z',
    updatedAt: '2026-10-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('current subscription (FR-SUB-3, D35)', () => {
  it('a comp grant until revoked, or ending later, gives access; an ended one does not', () => {
    expect(currentSubscription([row({ id: 'open' })], NOW)?.id).toBe('open');
    expect(
      currentSubscription([row({ id: 'later', currentPeriodEnd: '2026-11-01T00:00:00.000Z' })], NOW)
        ?.id,
    ).toBe('later');
    expect(
      currentSubscription([row({ currentPeriodEnd: '2026-10-25T12:00:00.000Z' })], NOW),
    ).toBeNull();
  });

  it('Stripe active and past_due give access; canceled and expired do not', () => {
    for (const status of ['active', 'past_due'] as const) {
      expect(currentSubscription([row({ source: 'stripe', status })], NOW)?.status).toBe(status);
    }
    for (const status of ['canceled', 'expired'] as const) {
      expect(currentSubscription([row({ source: 'stripe', status })], NOW)).toBeNull();
    }
    expect(currentSubscription([row({ status: 'canceled' })], NOW)).toBeNull();
  });

  it('the newest access-giving row wins, whatever the order given', () => {
    const old = row({ id: 'old', createdAt: '2026-09-01T00:00:00.000Z' });
    const recent = row({ id: 'new', createdAt: '2026-10-20T00:00:00.000Z' });
    const ended = row({ id: 'ended', status: 'canceled', createdAt: '2026-10-24T00:00:00.000Z' });
    expect(currentSubscription([old, recent, ended], NOW)?.id).toBe('new');
    expect(currentSubscription([ended, recent, old], NOW)?.id).toBe('new');
  });
});
