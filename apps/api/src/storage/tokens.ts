import { createHmac, hkdfSync, timingSafeEqual } from 'node:crypto';
import type { ApiContext } from '../context.ts';

// Download URLs (security §2, FR-CAT-6): `/v1/files/<token>`, where the token is a base64url JSON
// payload and its HMAC-SHA256 under a key derived from JWT_SECRET. The token is the whole
// authorization of the files route, so it names the user and device it was issued to.

export type FileTokenKind = 'file' | 'media';

export interface FileTokenPayload {
  kind: FileTokenKind;
  /** A catalog file id, or `<itemId>/<kind>` for art. */
  id: string;
  userId: string;
  deviceId: string;
  /** Epoch milliseconds. */
  expiresAt: number;
}

const keys = new WeakMap<Buffer, Buffer>();

function keyOf(ctx: ApiContext): Buffer {
  const secret = ctx.env.jwtSecret;
  let key = keys.get(secret);
  if (!key) {
    key = Buffer.from(hkdfSync('sha256', secret, Buffer.alloc(0), 'nextlevel-files', 32));
    keys.set(secret, key);
  }
  return key;
}

const sign = (ctx: ApiContext, payload: string) =>
  createHmac('sha256', keyOf(ctx)).update(payload).digest();

export function signFileToken(
  ctx: ApiContext,
  p: { kind: FileTokenKind; id: string; userId: string; deviceId: string; ttlMs: number },
): { token: string; expiresAt: string } {
  const exp = ctx.clock().getTime() + p.ttlMs;
  const payload = Buffer.from(
    JSON.stringify({ k: p.kind, id: p.id, u: p.userId, d: p.deviceId, exp }),
  ).toString('base64url');
  return {
    token: `${payload}.${sign(ctx, payload).toString('base64url')}`,
    expiresAt: new Date(exp).toISOString(),
  };
}

/** The payload of a token this API signed that hasn't expired; null for anything else. */
export function verifyFileToken(ctx: ApiContext, token: string): FileTokenPayload | null {
  const [payload, signature, extra] = token.split('.');
  if (!payload || !signature || extra !== undefined) return null;
  const given = Buffer.from(signature, 'base64url');
  const expected = sign(ctx, payload);
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;
  let data: unknown;
  try {
    data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
  } catch {
    return null;
  }
  const { k, id, u, d, exp } = (data ?? {}) as Record<string, unknown>;
  if (
    (k !== 'file' && k !== 'media') ||
    typeof id !== 'string' ||
    typeof u !== 'string' ||
    typeof d !== 'string' ||
    typeof exp !== 'number' ||
    exp <= ctx.clock().getTime()
  ) {
    return null;
  }
  return { kind: k, id, userId: u, deviceId: d, expiresAt: exp };
}
