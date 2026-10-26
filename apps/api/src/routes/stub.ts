import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { LoopbackRedirectSchema } from '@nextlevel/shared';
import { z } from 'zod';
import { STUB_PERSONAS, type StubProviders } from '../auth/stub.ts';
import { apiError } from '../errors.ts';

// GET /v1/auth/stub/authorize — the stub's "Google consent page" (AUTH_STUB=1 only).

const QuerySchema = z.object({
  redirect_uri: z.string(),
  state: z.string().max(500),
  code_challenge: z.string().min(43).max(128),
  code_challenge_method: z.literal('S256'),
  login_hint: z.enum(STUB_PERSONAS).optional(),
});

const escape = (text: string) => text.replace(/[&<>"']/g, (c) => `&#${String(c.charCodeAt(0))};`);

export function stubRoutes(app: FastifyInstance, stub: StubProviders, publicUrl: string): void {
  const ownCallback = `${publicUrl}/v1/auth/google/callback`;
  app
    .withTypeProvider<ZodTypeProvider>()
    .get(
      '/v1/auth/stub/authorize',
      { config: { role: 'public' }, schema: { querystring: QuerySchema, hide: true } },
      (request, reply) => {
        const query = request.query;
        const redirect = query.redirect_uri;
        if (redirect !== ownCallback && !LoopbackRedirectSchema.safeParse(redirect).success) {
          throw apiError(
            'VALIDATION_FAILED',
            'redirect_uri must be a loopback or the API callback.',
          );
        }
        const back = (params: Record<string, string>) => {
          const url = new URL(redirect);
          for (const [key, value] of Object.entries({ ...params, state: query.state })) {
            url.searchParams.set(key, value);
          }
          return url.toString();
        };
        if (query.login_hint) {
          const code = stub.issue(query.login_hint, query.code_challenge, redirect);
          return reply.redirect(back({ code }));
        }
        const here = new URL(request.url, publicUrl);
        const links = STUB_PERSONAS.map((persona) => {
          here.searchParams.set('login_hint', persona);
          return `<li><a href="${escape(here.pathname + here.search)}">${persona}@nextlevel.test</a></li>`;
        }).join('');
        const cancel = escape(back({ error: 'access_denied' }));
        return reply
          .type('text/html; charset=utf-8')
          .send(
            `<!doctype html><meta charset="utf-8"><title>NextLevel sign-in stub</title>` +
              `<h1>Sign in as…</h1><ul>${links}</ul><p><a href="${cancel}">Cancel</a></p>`,
          );
      },
    );
}
