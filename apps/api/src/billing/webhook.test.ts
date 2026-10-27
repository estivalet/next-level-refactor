import { describe, expect, it } from 'vitest';
import { ourStatus } from './webhook.ts';

describe('Stripe status → ours (plan: calls made in planning)', () => {
  it.each([
    ['active', 'active'],
    ['trialing', 'active'],
    ['past_due', 'past_due'],
    ['canceled', 'canceled'],
    ['unpaid', 'expired'],
    ['incomplete_expired', 'expired'],
    ['paused', 'expired'],
    ['incomplete', null],
  ] as const)('%s → %s', (stripe, ours) => {
    expect(ourStatus(stripe)).toBe(ours);
  });
});
