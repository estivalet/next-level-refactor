import { createHash, randomBytes } from 'node:crypto';
import { DeviceInfoSchema, type DeviceInfo } from '@nextlevel/shared';
import { jwtVerify, SignJWT, type JWTHeaderParameters } from 'jose';
import { apiError } from '../errors.ts';
import type { Env } from '../env.ts';

// Token formats (ADR-006, security §2): HS256 access JWTs with a `kid` so the secret can rotate,
// opaque refresh tokens stored as SHA-256, and a short ticket to finish a device-limited sign-in.

const ISSUER = 'nextlevel-api';
const ACCESS_AUDIENCE = 'nextlevel-launcher';
const TICKET_AUDIENCE = 'nextlevel-device-limit';
export const ACCESS_TTL_S = 15 * 60;
export const TICKET_TTL_S = 5 * 60;
export const REFRESH_TTL_MS = 30 * 24 * 3600_000;

interface Key {
  kid: string;
  secret: Uint8Array;
}
export interface JwtKeys {
  current: Key;
  previous: Key | null;
}

const keyOf = (secret: Buffer): Key => ({
  kid: createHash('sha256').update(secret).digest('hex').slice(0, 8),
  secret: new Uint8Array(secret),
});

export function jwtKeys(env: Pick<Env, 'jwtSecret' | 'jwtSecretPrevious'>): JwtKeys {
  return {
    current: keyOf(env.jwtSecret),
    previous: env.jwtSecretPrevious ? keyOf(env.jwtSecretPrevious) : null,
  };
}

export interface AccessClaims {
  sub: string;
  did: string;
  role: 'admin' | 'subscriber';
}

const seconds = (date: Date) => Math.floor(date.getTime() / 1000);

function sign(
  payload: Record<string, unknown>,
  subject: string,
  audience: string,
  ttl: number,
  keys: JwtKeys,
  now: Date,
) {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256', kid: keys.current.kid })
    .setSubject(subject)
    .setIssuer(ISSUER)
    .setAudience(audience)
    .setIssuedAt(seconds(now))
    .setExpirationTime(seconds(now) + ttl)
    .sign(keys.current.secret);
}

async function verify(token: string, audience: string, keys: JwtKeys, now: Date) {
  const key = (header: JWTHeaderParameters) => {
    if (header.kid === keys.current.kid) return keys.current.secret;
    if (keys.previous && header.kid === keys.previous.kid) return keys.previous.secret;
    throw new Error('unknown kid');
  };
  try {
    const { payload } = await jwtVerify(token, key, {
      issuer: ISSUER,
      audience,
      algorithms: ['HS256'],
      currentDate: now,
    });
    return payload;
  } catch {
    throw apiError('UNAUTHENTICATED');
  }
}

export function signAccess(claims: AccessClaims, keys: JwtKeys, now: Date): Promise<string> {
  return sign(
    { did: claims.did, role: claims.role },
    claims.sub,
    ACCESS_AUDIENCE,
    ACCESS_TTL_S,
    keys,
    now,
  );
}

export async function verifyAccess(token: string, keys: JwtKeys, now: Date): Promise<AccessClaims> {
  const payload = await verify(token, ACCESS_AUDIENCE, keys, now);
  const { sub, did, role } = payload;
  if (
    typeof sub !== 'string' ||
    typeof did !== 'string' ||
    (role !== 'admin' && role !== 'subscriber')
  ) {
    throw apiError('UNAUTHENTICATED');
  }
  return { sub, did, role };
}

export interface Ticket {
  sub: string;
  device: DeviceInfo;
}

export function signTicket(ticket: Ticket, keys: JwtKeys, now: Date): Promise<string> {
  return sign({ device: ticket.device }, ticket.sub, TICKET_AUDIENCE, TICKET_TTL_S, keys, now);
}

export async function verifyTicket(
  token: string,
  keys: JwtKeys,
  now: Date,
): Promise<Ticket & { jti: string }> {
  const payload = await verify(token, TICKET_AUDIENCE, keys, now);
  const device = DeviceInfoSchema.safeParse(payload['device']);
  if (typeof payload.sub !== 'string' || !device.success) throw apiError('UNAUTHENTICATED');
  return { sub: payload.sub, device: device.data, jti: hashToken(token) };
}

/** 32 random bytes, base64url: the refresh token the launcher keeps. */
export function newRefreshToken(): string {
  return randomBytes(32).toString('base64url');
}

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}
