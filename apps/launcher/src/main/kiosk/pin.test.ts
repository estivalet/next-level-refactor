import { describe, expect, it } from 'vitest';
import { hashPin, isPin, verifyPin } from './pin.ts';

describe('kiosk PIN (FR-SET-6, D54)', () => {
  it('pin: 4–8 digits only; verify true/false; hash never contains the PIN', async () => {
    expect(['1234', '12345678'].map(isPin)).toEqual([true, true]);
    expect(['123', '123456789', '12a4', ' 1234', ''].map(isPin)).toEqual([
      false,
      false,
      false,
      false,
      false,
    ]);
    const hash = await hashPin('482915');
    expect(hash).toMatch(/^scrypt\$16384\$[A-Za-z0-9+/=]+\$[A-Za-z0-9+/=]+$/);
    expect(hash).not.toContain('482915');
    expect(await verifyPin('482915', hash)).toBe(true);
    expect(await verifyPin('482916', hash)).toBe(false);
    // Salted: the same PIN hashes differently each time.
    expect(await hashPin('482915')).not.toBe(hash);
  });

  it('a malformed hash never verifies', async () => {
    expect(await verifyPin('1234', 'plain')).toBe(false);
    expect(await verifyPin('1234', 'scrypt$1$AA==$AA==')).toBe(false);
  });

  it('hashPin refuses something that is not a PIN', async () => {
    await expect(hashPin('12')).rejects.toThrow();
  });
});
