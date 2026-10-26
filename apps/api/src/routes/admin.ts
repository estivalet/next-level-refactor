import {
  AdminUserDetailSchema,
  AdminUserPatchSchema,
  AdminUserQuerySchema,
  AdminUserSummarySchema,
  AppSettingsPatchSchema,
  AppSettingsSchema,
  AppSettingsViewSchema,
  AuditEntrySchema,
  AuditQuerySchema,
  PageSchema,
} from '@nextlevel/shared';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { audited, auditPage } from '../admin/audit.ts';
import { listUsers, patchUser, revokeUserDevice, userDetail } from '../admin/users.ts';
import type { ApiContext } from '../context.ts';
import { apiError } from '../errors.ts';
import { loadAppSettings, saveAppSettings } from '../settings/AppSettingsRepository.ts';

const id = z.string().min(1).max(100);

/** Admin console API (api-spec §2 Admin, FR-ADM-1/4/5): role `admin`, every write audited. */
export function adminRoutes(app: FastifyInstance, ctx: ApiContext): void {
  const route = app.withTypeProvider<ZodTypeProvider>();
  const config = { role: 'admin' as const };
  const actor = (request: FastifyRequest) => {
    if (!request.admin) throw apiError('UNAUTHENTICATED');
    return request.admin.userId;
  };

  route.get(
    '/v1/admin/users',
    {
      config,
      schema: {
        querystring: AdminUserQuerySchema,
        response: { 200: PageSchema(AdminUserSummarySchema) },
      },
    },
    (request) => listUsers(ctx, request.query),
  );

  route.get(
    '/v1/admin/users/:id',
    {
      config,
      schema: { params: z.object({ id }), response: { 200: AdminUserDetailSchema } },
    },
    (request) => userDetail(ctx, request.params.id),
  );

  route.patch(
    '/v1/admin/users/:id',
    {
      config,
      schema: {
        params: z.object({ id }),
        body: AdminUserPatchSchema,
        response: { 200: AdminUserDetailSchema },
      },
    },
    (request) => patchUser(ctx, actor(request), request.params.id, request.body),
  );

  route.delete(
    '/v1/admin/users/:id/devices/:deviceId',
    { config, schema: { params: z.object({ id, deviceId: id }) } },
    (request, reply) => {
      revokeUserDevice(ctx, actor(request), request.params.id, request.params.deviceId);
      return reply.status(204).send();
    },
  );

  route.get(
    '/v1/admin/audit',
    {
      config,
      schema: { querystring: AuditQuerySchema, response: { 200: PageSchema(AuditEntrySchema) } },
    },
    (request) =>
      auditPage(ctx, {
        ...(request.query.actor ? { actor: request.query.actor } : {}),
        ...(request.query.target ? { targets: [request.query.target] } : {}),
        ...(request.query.cursor ? { cursor: request.query.cursor } : {}),
        limit: request.query.limit ?? 50,
      }),
  );

  route.get(
    '/v1/admin/settings',
    { config, schema: { response: { 200: AppSettingsViewSchema } } },
    () => loadAppSettings(ctx.db),
  );

  route.patch(
    '/v1/admin/settings',
    { config, schema: { body: AppSettingsPatchSchema, response: { 200: AppSettingsViewSchema } } },
    (request) => {
      const before = loadAppSettings(ctx.db);
      const after = AppSettingsSchema.parse({ ...before, ...request.body });
      // Saving what is already there changes nothing, so nothing is logged.
      if (JSON.stringify(before) === JSON.stringify(after)) return before;
      return audited(
        ctx,
        actor(request),
        [{ action: 'settings.update', targetType: 'settings', targetId: 'app', before, after }],
        () => saveAppSettings(ctx.db, request.body),
      );
    },
  );
}
