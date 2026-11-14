import { describe, expect, it } from 'vitest';
import { isEssentialsName } from './essentials.ts';

describe('isEssentialsName (D63)', () => {
  it('D63: "SNES Essentials", "essentials" and " Arcade ESSENTIALS " are Essentials collections', () => {
    expect(isEssentialsName('SNES Essentials')).toBe(true);
    expect(isEssentialsName('essentials')).toBe(true);
    expect(isEssentialsName(' Arcade ESSENTIALS ')).toBe(true);
  });

  it('D63: "Essentials of SNES" and "NonEssentials" are not', () => {
    expect(isEssentialsName('Essentials of SNES')).toBe(false);
    expect(isEssentialsName('NonEssentials')).toBe(false);
  });
});
