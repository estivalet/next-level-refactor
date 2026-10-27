import { CheckoutRequestSchema, RedirectResponseSchema } from '@nextlevel/shared';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { openPortal, startCheckout } from '../billing/checkout.ts';
import { localeOf, RETURN_RESULTS, returnPage } from '../billing/returnPage.ts';
import type { ApiContext } from '../context.ts';
import { apiError } from '../errors.ts';

/** Checkout, Portal and the page they return to (api-spec §2 Me billing, IA F7). */
export function billingRoutes(app: FastifyInstance, ctx: ApiContext): void {
  const route = app.withTypeProvider<ZodTypeProvider>();
  const caller = (request: FastifyRequest) => {
    const user = request.device ? ctx.users.byId(request.device.userId) : undefined;
    if (!user) throw apiError('UNAUTHENTICATED');
    return user;
  };

  route.post(
    '/v1/me/billing/checkout',
    {
      config: { role: 'device' },
      schema: { body: CheckoutRequestSchema, response: { 200: RedirectResponseSchema } },
    },
    (request) => startCheckout(ctx, caller(request), request.body),
  );

  route.post(
    '/v1/me/billing/portal',
    { config: { role: 'device' }, schema: { response: { 200: RedirectResponseSchema } } },
    (request) => openPortal(ctx, caller(request)),
  );

  route.get(
    '/v1/billing/return',
    {
      config: { role: 'public' },
      schema: { querystring: z.object({ result: z.enum(RETURN_RESULTS) }) },
    },
    (request, reply) =>
      reply
        .type('text/html; charset=utf-8')
        .send(returnPage(request.query.result, localeOf(request.headers['accept-language']))),
  );
}
