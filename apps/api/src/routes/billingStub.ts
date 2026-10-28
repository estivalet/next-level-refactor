import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { checkoutPage, portalPage, webhookFailedPage } from '../billing/stubPages.ts';
import type { StubBilling } from '../billing/stubProvider.ts';
import type { ApiContext } from '../context.ts';
import { ApiError, apiError } from '../errors.ts';

// /v1/billing/stub/* — the stub's Checkout and Portal (BILLING_STUB=1 only, D32). The session
// and customer ids in the URL are the only key, as with Stripe's hosted pages.

const id = z.string().min(1).max(100);
const ACTION = z.enum(['cancelAtPeriodEnd', 'resume', 'paymentFails', 'renew', 'endNow']);

export function billingStubRoutes(app: FastifyInstance, ctx: ApiContext, stub: StubBilling): void {
  const route = app.withTypeProvider<ZodTypeProvider>();
  const config = { role: 'public' as const };
  const base = ctx.env.publicUrl;
  const portalOf = (customer: string) => `${base}/v1/billing/stub/portal/${customer}`;
  const owned = (customer: string, subscription: string) => {
    if (!stub.subscriptionsOf(customer).some((sub) => sub.id === subscription)) {
      throw apiError('NOT_FOUND');
    }
  };

  route.get(
    '/v1/billing/stub/checkout/:session',
    { config, schema: { params: z.object({ session: id }), hide: true } },
    (request, reply) => {
      const session = stub.session(request.params.session);
      if (!session) throw apiError('NOT_FOUND');
      return reply.type('text/html; charset=utf-8').send(checkoutPage(session, base));
    },
  );

  route.post(
    '/v1/billing/stub/checkout/:session/pay',
    { config, schema: { params: z.object({ session: id }), hide: true } },
    async (request, reply) => {
      const session = stub.session(request.params.session);
      if (!session) throw apiError('NOT_FOUND');
      try {
        await stub.pay(session.id);
      } catch (error) {
        // Paid, but our webhook route failed: say so instead of claiming success.
        if (!(error instanceof ApiError) || error.code !== 'BILLING_UNAVAILABLE') throw error;
        return reply.status(502).type('text/html; charset=utf-8').send(webhookFailedPage());
      }
      return reply.redirect(session.successUrl, 303);
    },
  );

  route.get(
    '/v1/billing/stub/portal/:customer',
    { config, schema: { params: z.object({ customer: id }), hide: true } },
    (request, reply) => {
      const prices = ctx.plans
        .list()
        .flatMap((plan) => [plan.stripePriceMonthly, plan.stripePriceYearly])
        .filter((price): price is string => price !== null);
      const subs = stub.subscriptionsOf(request.params.customer);
      return reply
        .type('text/html; charset=utf-8')
        .send(portalPage(request.params.customer, subs, prices, base));
    },
  );

  route.post(
    '/v1/billing/stub/portal/:customer/:subscription/:action',
    {
      config,
      schema: { params: z.object({ customer: id, subscription: id, action: ACTION }), hide: true },
    },
    async (request, reply) => {
      const { customer, subscription, action } = request.params;
      owned(customer, subscription);
      await stub.act(subscription, action);
      return reply.redirect(portalOf(customer), 303);
    },
  );

  route.post(
    '/v1/billing/stub/portal/:customer/:subscription/switch/:price',
    {
      config,
      schema: {
        params: z.object({ customer: id, subscription: id, price: id }),
        hide: true,
      },
    },
    async (request, reply) => {
      const { customer, subscription, price } = request.params;
      owned(customer, subscription);
      await stub.act(subscription, 'switch', price);
      return reply.redirect(portalOf(customer), 303);
    },
  );
}
