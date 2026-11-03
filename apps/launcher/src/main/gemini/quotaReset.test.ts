import { describe, expect, it } from 'vitest';
import { nextQuotaReset } from './quotaReset.ts';

describe('nextQuotaReset (FR-SCR-7: Google resets the free daily limit at midnight Pacific)', () => {
  it('FR-SCR-7: winter (PST, UTC-8): the next 00:00 in Los Angeles', () => {
    expect(nextQuotaReset(new Date('2026-12-10T15:00:00Z')).toISOString()).toBe(
      '2026-12-11T08:00:00.000Z',
    );
  });

  it('FR-SCR-7: summer (PDT, UTC-7)', () => {
    expect(nextQuotaReset(new Date('2026-07-01T06:59:00Z')).toISOString()).toBe(
      '2026-07-01T07:00:00.000Z',
    );
    expect(nextQuotaReset(new Date('2026-07-01T07:00:00Z')).toISOString()).toBe(
      '2026-07-02T07:00:00.000Z',
    );
  });

  it('FR-SCR-7: across the DST change (2026-11-01 in the US)', () => {
    // 2026-10-31 20:00 PDT → the next midnight is 2026-11-01 00:00 PDT (07:00Z).
    expect(nextQuotaReset(new Date('2026-11-01T03:00:00Z')).toISOString()).toBe(
      '2026-11-01T07:00:00.000Z',
    );
    // 2026-11-01 12:00 PST → 2026-11-02 00:00 PST (08:00Z).
    expect(nextQuotaReset(new Date('2026-11-01T20:00:00Z')).toISOString()).toBe(
      '2026-11-02T08:00:00.000Z',
    );
  });
});
