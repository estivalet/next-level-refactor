import { createHash, randomBytes } from 'node:crypto';
import { UserProfileSchema } from '@nextlevel/shared';
import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import {
  CSRF_COOKIE,
  endAdminSession,
  sessionUserId,
  startAdminSession,
} from '../auth/adminSession.ts';
import { SCOPES, type IdentityProvider } from '../auth/identity.ts';
import { profileOf } from '../auth/session.ts';
import { admit } from '../auth/signIn.ts';
import type { ApiContext } from '../context.ts';
import { apiError } from '../errors.ts';

const OAUTH_COOKIE = 'nl_oauth';
const OAUTH_TTL_S = 10 * 60;

/**
 * The console's web sign-in (ADR-006: server-side redirect flow): start → Google (or the stub)
 * → callback → session. The state and PKCE verifier ride in a signed, httpOnly, 10-minute cookie
 * (SameSite=Lax, so it survives the top-level redirect back from Google).
 */
export function adminAuthRoutes(app: FastifyInstance, ctx: ApiContext, web: IdentityProvider) {
  const route = app.withTypeProvider<ZodTypeProvider>();
  const callbackUrl = `${ctx.env.publicUrl}/v1/auth/google/callback`;
  const back = (error?: string) =>
    error ? `${ctx.env.adminOrigin ?? ''}/?error=${error}` : (ctx.env.adminOrigin ?? '/');
  const secure = ctx.env.publicUrl.startsWith('https://');

  route.get(
    '/v1/auth/google/start',
    { config: { role: 'public', rateLimit: { max: 10, timeWindow: '1 minute' } } },
    (_request, reply) => {
      const state = randomBytes(24).toString('base64url');
      const verifier = randomBytes(48).toString('base64url');
      const url = new URL(web.authorizeUrl);
      for (const [key, value] of Object.entries({
        client_id: web.clientId,
        redirect_uri: callbackUrl,
        response_type: 'code',
        scope: SCOPES.join(' '),
        code_challenge: createHash('sha256').update(verifier).digest('base64url'),
        code_challenge_method: 'S256',
        state,
        prompt: 'select_account',
      })) {
        url.searchParams.set(key, value);
      }
      return reply
        .setCookie(OAUTH_COOKIE, JSON.stringify({ state, verifier }), {
          path: '/v1/auth/google',
          httpOnly: true,
          sameSite: 'lax',
          secure,
          signed: true,
          maxAge: OAUTH_TTL_S,
        })
        .redirect(url.toString());
    },
  );

  route.get(
    '/v1/auth/google/callback',
    {
      config: { role: 'public', rateLimit: { max: 10, timeWindow: '1 minute' } },
      schema: {
        hide: true,
        querystring: z.object({
          state: z.string().max(500),
          code: z.string().max(2000).optional(),
          error: z.string().max(200).optional(),
        }),
      },
    },
    async (request, reply) => {
      const raw = request.cookies[OAUTH_COOKIE];
      const unsigned = raw ? request.unsignCookie(raw) : null;
      const saved = unsigned?.valid ? parseOauth(unsigned.value) : null;
      void reply.clearCookie(OAUTH_COOKIE, { path: '/v1/auth/google' });
      if (!saved || saved.state !== request.query.state) {
        throw apiError('VALIDATION_FAILED', 'The sign-in could not be matched; start again.');
      }
      if (request.query.error || !request.query.code) return reply.redirect(back('cancelled'));
      let user;
      try {
        const identity = await web.exchange({
          code: request.query.code,
          codeVerifier: saved.verifier,
          redirectUri: callbackUrl,
        });
        user = admit(identity, {
          settings: ctx.settings(),
          adminEmails: ctx.env.adminEmails,
          users: ctx.users,
          now: ctx.clock(),
        });
      } catch {
        return reply.redirect(back('notAdmin'));
      }
      if (user.role !== 'admin' || user.status !== 'active')
        return reply.redirect(back('notAdmin'));
      startAdminSession(ctx, reply, user.id);
      return reply.redirect(back());
    },
  );

  route.get(
    '/v1/auth/session',
    {
      config: { role: 'public' },
      schema: { response: { 200: z.object({ user: UserProfileSchema, csrf: z.string() }) } },
    },
    (request) => {
      const userId = sessionUserId(ctx, request);
      const user = userId ? ctx.users.byId(userId) : undefined;
      if (!user || user.role !== 'admin' || user.status !== 'active') {
        throw apiError('UNAUTHENTICATED');
      }
      return { user: profileOf(user), csrf: request.cookies[CSRF_COOKIE] ?? '' };
    },
  );

  route.post('/v1/auth/session/logout', { config: { role: 'admin' } }, (request, reply) => {
    endAdminSession(ctx, request, reply);
    return reply.status(204).send();
  });
}

function parseOauth(value: string): { state: string; verifier: string } | null {
  try {
    const parsed = z
      .object({ state: z.string(), verifier: z.string() })
      .safeParse(JSON.parse(value));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}
