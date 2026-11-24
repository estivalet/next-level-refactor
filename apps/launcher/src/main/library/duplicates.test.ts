import { describe, expect, it } from 'vitest';
import { nameKey } from './duplicates.ts';

describe('nameKey', () => {
  it('FR-LIB-19: nameKey strips folders, extension and tags', () => {
    expect(nameKey('! Translated/Coca-Cola Kid (Japan) [T-En by A].gg')).toBe('coca-cola kid');
    expect(nameKey('Coca-Cola Kid  [T-En by Mr. Z v1.1].gg')).toBe('coca-cola kid');
    expect(nameKey('Sonic (USA, Europe) (Rev 1).gg')).toBe('sonic');
    expect(nameKey('README')).toBe('readme');
  });

  it('FR-LIB-19: a name that is only tags, or not text, has no key', () => {
    expect(nameKey('(Japan).gg')).toBeNull();
    expect(nameKey('folder/[b1] (J).gg')).toBeNull();
    expect(nameKey(null)).toBeNull();
    expect(nameKey(42)).toBeNull();
  });
});
