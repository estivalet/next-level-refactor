import {
  AdminPlanCreateSchema,
  AdminPlanPatchSchema,
  AdminPlanSchema,
  CatalogScopeCreateSchema,
  CatalogScopePatchSchema,
  CatalogScopeSchema,
} from '@nextlevel/shared';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import type { ApiContext } from '../context.ts';
import { apiError } from '../errors.ts';
import {
  createPlan,
  createScope,
  listAdminPlans,
  updatePlan,
  updateScope,
} from '../plans/plans.ts';
import { toCatalogScope } from '../plans/ScopeRepository.ts';

const params = z.object({ id: z.string().min(1).max(100) });

/** Plans and catalog scopes (api-spec §2 Admin, FR-ADM-2, US-F4): role `admin`, audited. */
export function adminPlanRoutes(app: FastifyInstance, ctx: ApiContext): void {
  const route = app.withTypeProvider<ZodTypeProvider>();
  const config = { role: 'admin' as const };
  const actor = (request: FastifyRequest) => {
    if (!request.admin) throw apiError('UNAUTHENTICATED');
    return request.admin.userId;
  };

  route.get(
    '/v1/admin/plans',
    { config, schema: { response: { 200: z.array(AdminPlanSchema) } } },
    () => listAdminPlans(ctx),
  );

  route.post(
    '/v1/admin/plans',
    { config, schema: { body: AdminPlanCreateSchema, response: { 200: AdminPlanSchema } } },
    (request) => createPlan(ctx, actor(request), request.body),
  );

  route.patch(
    '/v1/admin/plans/:id',
    {
      config,
      schema: { params, body: AdminPlanPatchSchema, response: { 200: AdminPlanSchema } },
    },
    (request) => updatePlan(ctx, actor(request), request.params.id, request.body),
  );

  route.get(
    '/v1/admin/scopes',
    { config, schema: { response: { 200: z.array(CatalogScopeSchema) } } },
    () => ctx.scopes.list().map(toCatalogScope),
  );

  route.post(
    '/v1/admin/scopes',
    { config, schema: { body: CatalogScopeCreateSchema, response: { 200: CatalogScopeSchema } } },
    (request) => createScope(ctx, actor(request), request.body),
  );

  route.patch(
    '/v1/admin/scopes/:id',
    {
      config,
      schema: { params, body: CatalogScopePatchSchema, response: { 200: CatalogScopeSchema } },
    },
    (request) => updateScope(ctx, actor(request), request.params.id, request.body),
  );
}
