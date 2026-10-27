import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { processEvent } from '../billing/webhook.ts';
import type { ApiContext } from '../context.ts';
import { stripeEvents } from '../db/schema.ts';
import { apiError } from '../errors.ts';
import { eq } from 'drizzle-orm';

/**
 * POST /v1/webhooks/stripe (api-spec §2, security §4): the raw body is verified against
 * `Stripe-Signature` before anything is parsed or stored. An event already processed is
 * answered at once; a processing failure answers 500 and leaves `processed_at` null, so
 * Stripe's retry runs it again.
 */
export async function webhookRoutes(app: FastifyInstance, ctx: ApiContext): Promise<void> {
  await app.register((scope, _opts, done) => {
    scope.removeAllContentTypeParsers();
    scope.addContentTypeParser('*', { parseAs: 'buffer' }, (_request, body, next) => {
      next(null, body);
    });
    scope.withTypeProvider<ZodTypeProvider>().post(
      '/v1/webhooks/stripe',
      {
        config: { role: 'public' },
        schema: { hide: true, response: { 200: z.object({ received: z.literal(true) }) } },
      },
      async (request) => {
        const signature = request.headers['stripe-signature'];
        if (!ctx.billing) throw apiError('NOT_FOUND');
        if (typeof signature !== 'string' || !Buffer.isBuffer(request.body)) {
          throw apiError('VALIDATION_FAILED', 'Missing signature.');
        }
        const event = ctx.billing.verifyEvent(request.body, signature);
        const seen = ctx.db.select().from(stripeEvents).where(eq(stripeEvents.id, event.id)).get();
        if (seen?.processedAt) return { received: true as const };
        if (!seen) {
          ctx.db
            .insert(stripeEvents)
            .values({ id: event.id, type: event.type, receivedAt: ctx.clock().toISOString() })
            .onConflictDoNothing()
            .run();
        }
        await processEvent(ctx, event, request.log);
        ctx.db
          .update(stripeEvents)
          .set({ processedAt: ctx.clock().toISOString() })
          .where(eq(stripeEvents.id, event.id))
          .run();
        return { received: true as const };
      },
    );
    done();
  });
}
