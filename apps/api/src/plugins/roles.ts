import { compareVersions, isVersion } from '@nextlevel/shared';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import { verifyAccess } from '../auth/tokens.ts';
import type { ApiContext } from '../context.ts';
import { apiError } from '../errors.ts';

// Authorization is server-side (CLAUDE.md, security §2): every route declares who may call it.

/** `public`: anyone; `device`: a launcher with a Bearer access token; `admin`: the console session. */
export type RouteRole = 'public' | 'device' | 'admin';

export interface DeviceAuth {
  userId: string;
  deviceId: string;
}

declare module 'fastify' {
  interface FastifyContextConfig {
    role?: RouteRole;
  }
  interface FastifyRequest {
    /** Set on `device` routes after the Bearer token checks out. */
    device?: DeviceAuth;
    /** Set on `admin` routes after the console session checks out. */
    admin?: { userId: string; email: string };
  }
}

/** Refuses to register a route that doesn't declare `config.role`. */
export function requireRouteRoles(app: FastifyInstance): void {
  app.addHook('onRoute', (route) => {
    if (!route.config?.role) {
      throw new Error(`${String(route.method)} ${route.url} declares no role (config.role)`);
    }
  });
}

/** The Bearer access token's device; a revoked device is signed out within a request. */
async function authenticateDevice(ctx: ApiContext, request: FastifyRequest): Promise<DeviceAuth> {
  const header = request.headers.authorization;
  const token = header?.startsWith('Bearer ') ? header.slice('Bearer '.length).trim() : null;
  if (!token) throw apiError('UNAUTHENTICATED');
  const claims = await verifyAccess(token, ctx.keys, ctx.clock());
  const device = ctx.devices.byId(claims.did);
  if (!device || device.revokedAt !== null || device.userId !== claims.sub) {
    throw apiError('UNAUTHENTICATED');
  }
  return { userId: claims.sub, deviceId: claims.did };
}

/**
 * A launcher older than `minLauncherVersion` may not use device routes (NFR-UPD-1, D53). The
 * version comes from `X-NextLevel-Version`; no header (or one that isn't a version) is allowed,
 * so launchers from before the header keep working until the minimum is raised for them.
 */
function checkLauncherVersion(ctx: ApiContext, request: FastifyRequest): void {
  const min = ctx.settings().minLauncherVersion;
  const header = request.headers['x-nextlevel-version'];
  const version = typeof header === 'string' ? header.trim() : null;
  if (min === null || !version || !isVersion(version)) return;
  if (compareVersions(version, min) < 0) {
    throw apiError('UPDATE_REQUIRED', undefined, { minLauncherVersion: min });
  }
}

/**
 * Checks each request against its route's role before the handler runs. `admin` routes are
 * refused until the admin session guard is installed (M7c).
 */
export function installGuards(
  app: FastifyInstance,
  ctx: ApiContext,
  admin: (request: FastifyRequest) => Promise<void> = () => Promise.reject(apiError('FORBIDDEN')),
): void {
  app.addHook('preHandler', async (request) => {
    const role = request.routeOptions.config.role;
    if (role === 'device') {
      checkLauncherVersion(ctx, request);
      request.device = await authenticateDevice(ctx, request);
    } else if (role === 'admin') await admin(request);
  });
}
