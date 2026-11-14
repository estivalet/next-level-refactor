import { describe, expect, it } from 'vitest';
import type { StorageLocation } from './schema.ts';
import { catalogOverlaps } from './locationOverlap.ts';

let n = 0;
const location = (path: string, managed = false): StorageLocation => {
  n += 1;
  return {
    id: `01928c3e-0000-7000-8000-${String(n).padStart(12, '0')}`,
    name: `L${String(n)}`,
    path,
    priority: n,
    ...(managed ? { managed: true } : {}),
  };
};

describe('catalogOverlaps (FR-CAT-3, owner backlog 2026-11-14)', () => {
  it('FR-CAT-3: the Catalog folder equal to, inside or containing a storage location overlaps it', () => {
    const same = location('E:\\Roms');
    expect(catalogOverlaps([same, location('e:/roms/', true)])).toEqual([same]);
    const parent = location('E:\\Roms');
    expect(catalogOverlaps([parent, location('E:\\Roms\\Catalog', true)])).toEqual([parent]);
    const child = location('E:\\Roms');
    expect(catalogOverlaps([child, location('E:\\', true)])).toEqual([child]);
  });

  it('FR-CAT-3: a sibling folder with the same prefix does not overlap', () => {
    expect(catalogOverlaps([location('E:\\Roms'), location('E:\\Roms2', true)])).toEqual([]);
    expect(catalogOverlaps([location('E:\\Roms2'), location('E:\\Roms', true)])).toEqual([]);
  });

  it('FR-CAT-3: without a Catalog folder nothing overlaps', () => {
    expect(catalogOverlaps([location('E:\\Roms'), location('E:\\Roms\\More')])).toEqual([]);
  });
});
