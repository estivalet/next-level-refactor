import { AccountExportSchema, DeleteAccountRequestSchema } from '@nextlevel/shared';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { deleteAccount } from '../account/deleteAccount.ts';
import { exportData } from '../account/exportData.ts';
import type { ApiContext } from '../context.ts';
import { apiError } from '../errors.ts';

/** Download my data and Delete account for the signed-in launcher (security §5, D36). */
export function accountRoutes(app: FastifyInstance, ctx: ApiContext): void {
  const route = app.withTypeProvider<ZodTypeProvider>();
  const config = { role: 'device' as const };
  const userId = (request: FastifyRequest) => {
    if (!request.device) throw apiError('UNAUTHENTICATED');
    return request.device.userId;
  };

  route.get(
    '/v1/me/export',
    { config, schema: { response: { 200: AccountExportSchema } } },
    (request) => exportData(ctx, userId(request)),
  );

  route.delete(
    '/v1/me',
    { config, schema: { body: DeleteAccountRequestSchema } },
    async (request, reply) => {
      await deleteAccount(ctx, userId(request), request.body.confirmEmail, null);
      return reply.status(204).send();
    },
  );
}
