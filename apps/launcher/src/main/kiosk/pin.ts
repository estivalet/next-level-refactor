import { KioskPinSchema } from '@nextlevel/shared';
import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';

// Kiosk PINs are stored as `scrypt$<N>$<salt b64>$<hash b64>` (D54), never as the PIN.

const N = 16384;
const KEY_LENGTH = 32;

function derive(pin: string, salt: Buffer, cost: number): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(pin, salt, KEY_LENGTH, { N: cost, r: 8, p: 1 }, (error, key) => {
      if (error) reject(error);
      else resolve(key);
    });
  });
}

/** 4–8 digits. */
export function isPin(text: string): boolean {
  return KioskPinSchema.safeParse(text).success;
}

export async function hashPin(pin: string): Promise<string> {
  if (!isPin(pin)) throw new Error('A kiosk PIN is 4 to 8 digits');
  const salt = randomBytes(16);
  const key = await derive(pin, salt, N);
  return `scrypt$${String(N)}$${salt.toString('base64')}$${key.toString('base64')}`;
}

/** Compares in constant time; a malformed hash never matches. */
export async function verifyPin(pin: string, hash: string): Promise<boolean> {
  const [scheme, cost, salt, key] = hash.split('$');
  if (scheme !== 'scrypt' || cost !== String(N) || !salt || !key || !isPin(pin)) return false;
  const expected = Buffer.from(key, 'base64');
  if (expected.length !== KEY_LENGTH) return false;
  const actual = await derive(pin, Buffer.from(salt, 'base64'), N);
  return timingSafeEqual(actual, expected);
}
