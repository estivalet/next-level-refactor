import { PlansResponseSchema } from '@nextlevel/shared';
import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import type { ApiContext } from '../context.ts';
import { publicPlans } from '../plans/plans.ts';

/** The plans on sale for the launcher's Subscribe screen (api-spec §2 Me, S3): no sign-in. */
export function planRoutes(app: FastifyInstance, ctx: ApiContext): void {
  app
    .withTypeProvider<ZodTypeProvider>()
    .get(
      '/v1/plans',
      { config: { role: 'public' }, schema: { response: { 200: PlansResponseSchema } } },
      () => publicPlans(ctx),
    );
}
