import {
  SYNC_KINDS,
  SYNC_MAX_BYTES,
  SyncDocumentSchema,
  SyncPutRequestSchema,
  SyncPutResponseSchema,
} from '@nextlevel/shared';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { entitlementOf } from '../auth/session.ts';
import type { ApiContext } from '../context.ts';
import { apiError } from '../errors.ts';
import { deleteDocuments, getDocument, putDocument } from './repository.ts';

const params = z.object({ kind: z.enum(SYNC_KINDS) });
const config = { role: 'device' as const };

/** Sync is for accounts that may use the launcher: suspended or without a plan, it refuses. */
function subscriber(ctx: ApiContext, request: FastifyRequest): string {
  const auth = request.device;
  const user = auth ? ctx.users.byId(auth.userId) : undefined;
  if (!auth || !user) throw apiError('UNAUTHENTICATED');
  const entitlement = entitlementOf(ctx, user);
  if (entitlement.status === 'suspended') throw apiError('SUSPENDED');
  if (entitlement.status === 'none') throw apiError('SUBSCRIPTION_REQUIRED');
  return user.id;
}

/** Settings sync (api-spec Sync, FR-SET-5, D55). */
export function syncRoutes(app: FastifyInstance, ctx: ApiContext): void {
  const route = app.withTypeProvider<ZodTypeProvider>();

  route.get(
    '/v1/sync/:kind',
    { config, schema: { params, response: { 200: SyncDocumentSchema } } },
    (request) => getDocument(ctx.db, subscriber(ctx, request), request.params.kind),
  );

  route.put(
    '/v1/sync/:kind',
    {
      config,
      bodyLimit: SYNC_MAX_BYTES,
      schema: { params, body: SyncPutRequestSchema, response: { 200: SyncPutResponseSchema } },
    },
    (request) => {
      const result = putDocument(ctx.db, {
        userId: subscriber(ctx, request),
        kind: request.params.kind,
        baseRevision: request.body.baseRevision,
        data: request.body.data ?? null,
        now: ctx.clock(),
      });
      if (result.kind === 'conflict') throw apiError('CONFLICT', undefined, result.current);
      return { revision: result.revision, updatedAt: result.updatedAt };
    },
  );

  route.delete('/v1/sync', { config }, async (request, reply) => {
    deleteDocuments(ctx.db, subscriber(ctx, request));
    return reply.status(204).send();
  });
}
