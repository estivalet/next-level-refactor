import { DeviceSchema, EntitlementResponseSchema, MeSchema } from '@nextlevel/shared';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { entitlementOf, profileOf } from '../auth/session.ts';
import type { ApiContext } from '../context.ts';
import { apiError } from '../errors.ts';
import { toDevice } from '../users/DeviceRepository.ts';

/** The signed-in launcher's own account (api-spec §2 Me). */
export function meRoutes(app: FastifyInstance, ctx: ApiContext): void {
  const route = app.withTypeProvider<ZodTypeProvider>();
  const caller = (request: FastifyRequest) => {
    const auth = request.device;
    const user = auth ? ctx.users.byId(auth.userId) : undefined;
    if (!auth || !user) throw apiError('UNAUTHENTICATED');
    return { auth, user };
  };

  route.get(
    '/v1/me',
    { config: { role: 'device' }, schema: { response: { 200: MeSchema } } },
    (request) => {
      const { user } = caller(request);
      return { user: profileOf(user), entitlement: entitlementOf(ctx, user) };
    },
  );

  // The launcher's hourly check (FR-AUTH-5, FR-AUTH-7): also the device's "last seen".
  route.get(
    '/v1/me/entitlement',
    { config: { role: 'device' }, schema: { response: { 200: EntitlementResponseSchema } } },
    (request) => {
      const { auth, user } = caller(request);
      const now = ctx.clock();
      ctx.users.touch(user.id, now);
      ctx.devices.touch(auth.deviceId, now);
      return { entitlement: entitlementOf(ctx, user), banner: ctx.settings().banner };
    },
  );

  route.get(
    '/v1/me/devices',
    { config: { role: 'device' }, schema: { response: { 200: z.array(DeviceSchema) } } },
    (request) => {
      const { auth, user } = caller(request);
      return ctx.devices.active(user.id).map((row) => toDevice(row, auth.deviceId));
    },
  );

  route.delete(
    '/v1/me/devices/:id',
    {
      config: { role: 'device' },
      schema: { params: z.object({ id: z.string().min(1).max(100) }) },
    },
    async (request, reply) => {
      const { auth, user } = caller(request);
      const device = ctx.devices.byId(request.params.id);
      if (!device || device.userId !== user.id || device.revokedAt !== null) {
        throw apiError('NOT_FOUND');
      }
      if (device.id === auth.deviceId) {
        throw apiError('CONFLICT', 'Sign out to remove this device.', { reason: 'current' });
      }
      ctx.tokens.revokeDevice(device.id);
      return reply.status(204).send();
    },
  );
}
