import { randomBytes } from 'node:crypto';
import { eq } from 'drizzle-orm';
import type { FastifyReply, FastifyRequest } from 'fastify';
import type { ApiContext } from '../context.ts';
import { adminSessions } from '../db/schema.ts';
import { apiError } from '../errors.ts';
import { hashToken } from './tokens.ts';

// Admin console sessions (security §2): an httpOnly, SameSite=Strict cookie backed by a hashed
// row, 8 h idle timeout, and a double-submit CSRF token for every write.

export const SESSION_COOKIE = 'nl_session';
export const CSRF_COOKIE = 'nl_csrf';
export const IDLE_MS = 8 * 3600_000;

const cookieBase = (ctx: ApiContext) => ({
  path: '/',
  secure: ctx.env.publicUrl.startsWith('https://'),
});

/** Starts a session for an admin and sets both cookies. */
export function startAdminSession(ctx: ApiContext, reply: FastifyReply, userId: string): void {
  const token = randomBytes(32).toString('base64url');
  const at = ctx.clock().toISOString();
  ctx.db
    .insert(adminSessions)
    .values({ id: ctx.newId(), tokenHash: hashToken(token), userId, createdAt: at, lastSeenAt: at })
    .run();
  void reply.setCookie(SESSION_COOKIE, token, {
    ...cookieBase(ctx),
    httpOnly: true,
    sameSite: 'strict',
  });
  void reply.setCookie(CSRF_COOKIE, randomBytes(24).toString('base64url'), {
    ...cookieBase(ctx),
    httpOnly: false,
    sameSite: 'strict',
  });
}

export function endAdminSession(ctx: ApiContext, request: FastifyRequest, reply: FastifyReply) {
  const token = request.cookies[SESSION_COOKIE];
  if (token)
    ctx.db
      .delete(adminSessions)
      .where(eq(adminSessions.tokenHash, hashToken(token)))
      .run();
  void reply.clearCookie(SESSION_COOKIE, cookieBase(ctx));
  void reply.clearCookie(CSRF_COOKIE, cookieBase(ctx));
}

/** The session's user id, or null (no cookie, unknown, or idle > 8 h — then removed). */
export function sessionUserId(ctx: ApiContext, request: FastifyRequest): string | null {
  const token = request.cookies[SESSION_COOKIE];
  if (!token) return null;
  const row = ctx.db
    .select()
    .from(adminSessions)
    .where(eq(adminSessions.tokenHash, hashToken(token)))
    .get();
  if (!row) return null;
  const now = ctx.clock();
  if (Date.parse(row.lastSeenAt) + IDLE_MS < now.getTime()) {
    ctx.db.delete(adminSessions).where(eq(adminSessions.id, row.id)).run();
    return null;
  }
  ctx.db
    .update(adminSessions)
    .set({ lastSeenAt: now.toISOString() })
    .where(eq(adminSessions.id, row.id))
    .run();
  return row.userId;
}

/** Writes must carry the CSRF cookie's value in X-CSRF-Token (double submit). */
export function assertCsrf(request: FastifyRequest): void {
  if (request.method === 'GET' || request.method === 'HEAD') return;
  const cookie = request.cookies[CSRF_COOKIE];
  const header = request.headers['x-csrf-token'];
  if (!cookie || typeof header !== 'string' || header !== cookie) throw apiError('FORBIDDEN');
}

/** The `admin` role guard: a live session of an active admin, CSRF on writes. */
export function adminGuard(ctx: ApiContext) {
  const check = (request: FastifyRequest): void => {
    const userId = sessionUserId(ctx, request);
    const user = userId ? ctx.users.byId(userId) : undefined;
    if (!user) throw apiError('UNAUTHENTICATED');
    if (user.status === 'suspended') throw apiError('SUSPENDED');
    if (user.role !== 'admin') throw apiError('FORBIDDEN');
    assertCsrf(request);
    request.admin = { userId: user.id, email: user.email };
  };
  return (request: FastifyRequest): Promise<void> => {
    try {
      check(request);
      return Promise.resolve();
    } catch (error) {
      return Promise.reject(error instanceof Error ? error : new Error(String(error)));
    }
  };
}
