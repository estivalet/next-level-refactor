import {
  AdminCatalogItemSchema,
  AdminCatalogPageSchema,
  AdminCatalogQuerySchema,
  CreateItemSchema,
  UpdateItemSchema,
} from '@nextlevel/shared';
import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import {
  createItem,
  itemDetail,
  listItems,
  publishItem,
  unpublishItem,
  updateItem,
} from '../catalog/items.ts';
import type { ApiContext } from '../context.ts';
import { adminActor } from './adminCatalogFiles.ts';

const params = z.object({ id: z.string().min(1).max(100) });
const config = { role: 'admin' as const };
const item = { 200: AdminCatalogItemSchema };

/** Catalog items and the publish gate (api-spec Admin catalog, FR-CAT-8, C10): audited. */
export function adminCatalogRoutes(app: FastifyInstance, ctx: ApiContext): void {
  const route = app.withTypeProvider<ZodTypeProvider>();

  route.get(
    '/v1/admin/catalog/items',
    {
      config,
      schema: { querystring: AdminCatalogQuerySchema, response: { 200: AdminCatalogPageSchema } },
    },
    (request) => listItems(ctx, request.query),
  );

  route.post(
    '/v1/admin/catalog/items',
    { config, schema: { body: CreateItemSchema, response: item } },
    (request) => createItem(ctx, adminActor(request), request.body),
  );

  route.get(
    '/v1/admin/catalog/items/:id',
    { config, schema: { params, response: item } },
    (request) => itemDetail(ctx, request.params.id),
  );

  route.patch(
    '/v1/admin/catalog/items/:id',
    { config, schema: { params, body: UpdateItemSchema, response: item } },
    (request) => updateItem(ctx, adminActor(request), request.params.id, request.body),
  );

  route.post(
    '/v1/admin/catalog/items/:id/publish',
    { config, schema: { params, response: item } },
    (request) => publishItem(ctx, adminActor(request), request.params.id),
  );

  route.post(
    '/v1/admin/catalog/items/:id/unpublish',
    { config, schema: { params, response: item } },
    (request) => unpublishItem(ctx, adminActor(request), request.params.id),
  );
}
