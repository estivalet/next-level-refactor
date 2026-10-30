import { describe, expect, it } from 'vitest';
import { getSystem } from './index.ts';
import { POPULAR_SYSTEM_IDS } from './popular.ts';

describe('popular systems (FR-ONB-1)', () => {
  it('every pre-checked id is a real catalog system, once', () => {
    expect(POPULAR_SYSTEM_IDS.length).toBeGreaterThanOrEqual(10);
    expect(new Set(POPULAR_SYSTEM_IDS).size).toBe(POPULAR_SYSTEM_IDS.length);
    for (const id of POPULAR_SYSTEM_IDS) expect(getSystem(id), id).toBeDefined();
  });
});
