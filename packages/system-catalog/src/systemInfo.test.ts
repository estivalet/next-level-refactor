import { SystemInfoSchema } from '@nextlevel/shared';
import { describe, expect, it } from 'vitest';
import { getSystem } from './index.ts';
import { systemInfoSeed, systemInfoSeedIds } from './systemInfo.ts';

describe('systemInfoSeed', () => {
  it('FR-MUS-1: the shipped seed validates and every id is a catalog system', () => {
    const ids = systemInfoSeedIds();
    expect(ids.length).toBeGreaterThan(0);
    expect(ids.every((id) => getSystem(id) !== undefined)).toBe(true);
    for (const id of ids) {
      expect(SystemInfoSchema.safeParse(systemInfoSeed(id)).success).toBe(true);
    }
  });

  it('FR-MUS-1: an id without an entry gives undefined', () => {
    expect(systemInfoSeed('no-such-system')).toBeUndefined();
  });
});
