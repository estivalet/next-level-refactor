import {
  CompleteRequestSchema,
  ExchangeRequestSchema,
  LogoutRequestSchema,
  RefreshRequestSchema,
  SessionResponseSchema,
  TokenPairSchema,
} from '@nextlevel/shared';
import { eq } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import type { IdentityProvider } from '../auth/identity.ts';
import { assertDeviceSlot, startSession } from '../auth/session.ts';
import { admit } from '../auth/signIn.ts';
import { hashToken, TICKET_TTL_S, verifyTicket } from '../auth/tokens.ts';
import type { ApiContext } from '../context.ts';
import { refreshTokens } from '../db/schema.ts';
import { apiError } from '../errors.ts';

/** api-spec rate limits: auth endpoints 10/min per address. */
const AUTH_LIMIT = { max: 10, timeWindow: '1 minute' };

/** Launcher sign-in (FR-AUTH-2, ADR-006): exchange, device-limit completion, refresh, logout. */
export function launcherAuthRoutes(
  app: FastifyInstance,
  ctx: ApiContext,
  desktop: IdentityProvider,
): void {
  const route = app.withTypeProvider<ZodTypeProvider>();
  // Tickets already used, until they would have expired anyway (one API instance, ADR-007).
  const usedTickets = new Map<string, number>();

  route.post(
    '/v1/auth/google/exchange',
    {
      config: { role: 'public', rateLimit: AUTH_LIMIT },
      schema: { body: ExchangeRequestSchema, response: { 200: SessionResponseSchema } },
    },
    async (request) => {
      const { device, ...code } = request.body;
      const identity = await desktop.exchange(code);
      const user = admit(identity, {
        settings: ctx.settings(),
        adminEmails: ctx.env.adminEmails,
        users: ctx.users,
        now: ctx.clock(),
      });
      await assertDeviceSlot(ctx, user, device);
      return startSession(ctx, user, device);
    },
  );

  route.post(
    '/v1/auth/complete',
    {
      config: { role: 'public', rateLimit: AUTH_LIMIT },
      schema: { body: CompleteRequestSchema, response: { 200: SessionResponseSchema } },
    },
    async (request) => {
      const now = ctx.clock().getTime();
      const ticket = await verifyTicket(request.body.ticket, ctx.keys, ctx.clock());
      for (const [jti, expires] of usedTickets) if (expires < now) usedTickets.delete(jti);
      if (usedTickets.has(ticket.jti)) throw apiError('UNAUTHENTICATED');
      usedTickets.set(ticket.jti, now + TICKET_TTL_S * 1000);
      const user = ctx.users.byId(ticket.sub);
      if (!user) throw apiError('UNAUTHENTICATED');
      const revoke = ctx.devices.byId(request.body.revokeDeviceId);
      if (!revoke || revoke.userId !== user.id || revoke.revokedAt !== null) {
        throw apiError('NOT_FOUND');
      }
      ctx.tokens.revokeDevice(revoke.id);
      await assertDeviceSlot(ctx, user, ticket.device);
      return startSession(ctx, user, ticket.device);
    },
  );

  route.post(
    '/v1/auth/refresh',
    {
      config: { role: 'public', rateLimit: AUTH_LIMIT },
      schema: { body: RefreshRequestSchema, response: { 200: TokenPairSchema } },
    },
    async (request) => {
      const pair = await ctx.tokens.rotate(request.body.refreshToken, request.body.deviceId);
      const device = ctx.devices.byId(request.body.deviceId);
      if (device) ctx.users.touch(device.userId, ctx.clock());
      return pair;
    },
  );

  route.post(
    '/v1/auth/logout',
    { config: { role: 'public', rateLimit: AUTH_LIMIT }, schema: { body: LogoutRequestSchema } },
    async (request, reply) => {
      const row = ctx.db
        .select({ deviceId: refreshTokens.deviceId })
        .from(refreshTokens)
        .where(eq(refreshTokens.tokenHash, hashToken(request.body.refreshToken)))
        .get();
      // Signing out frees the device slot (FR-AUTH-6); an unknown token is already signed out.
      if (row) ctx.tokens.revokeDevice(row.deviceId);
      return reply.status(204).send();
    },
  );
}
