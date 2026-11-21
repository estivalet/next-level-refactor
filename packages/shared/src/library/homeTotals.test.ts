import { describe, expect, it } from 'vitest';
import { HomeTotalsRequestSchema } from './homeTotals.ts';

describe('HomeTotalsRequestSchema', () => {
  it('FR-LIB-17: takes groups of systems, collections and smart filters', () => {
    const request = {
      groups: [{ systemIds: ['snes'], collectionIds: [1], smartFilterIds: [2] }],
    };
    expect(HomeTotalsRequestSchema.parse(request)).toEqual(request);
  });

  it('FR-LIB-17: refuses unknown keys and bad ids', () => {
    const group = { systemIds: [], collectionIds: [0], smartFilterIds: [] };
    expect(HomeTotalsRequestSchema.safeParse({ groups: [group] }).success).toBe(false);
    const extra = { systemIds: [], collectionIds: [], smartFilterIds: [], menu: 1 };
    expect(HomeTotalsRequestSchema.safeParse({ groups: [extra] }).success).toBe(false);
  });
});
