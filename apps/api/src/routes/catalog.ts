import { CatalogItemSchema, CatalogPageSchema, CatalogQuerySchema } from '@nextlevel/shared';
import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { catalogCaller, catalogPage, toCatalogItem, visibleItem } from '../catalog/visible.ts';
import type { ApiContext } from '../context.ts';

const params = z.object({ id: z.string().min(1).max(100) });
const config = { role: 'device' as const };

/** The subscriber catalog (api-spec Catalog, FR-CAT-1, FR-CAT-2, C8): filtered by plan scopes. */
export function catalogRoutes(app: FastifyInstance, ctx: ApiContext): void {
  const route = app.withTypeProvider<ZodTypeProvider>();

  route.get(
    '/v1/catalog/items',
    { config, schema: { querystring: CatalogQuerySchema, response: { 200: CatalogPageSchema } } },
    (request) => catalogPage(ctx, catalogCaller(ctx, request), request.query),
  );

  route.get(
    '/v1/catalog/items/:id',
    { config, schema: { params, response: { 200: CatalogItemSchema } } },
    (request) => {
      const caller = catalogCaller(ctx, request);
      return toCatalogItem(ctx, caller, visibleItem(ctx, caller, request.params.id));
    },
  );
}
