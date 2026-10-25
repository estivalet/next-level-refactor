import type { FastifyInstance } from 'fastify';

// Authorization is server-side (CLAUDE.md, security §2): every route declares who may call it.

/** `public`: anyone; `device`: a launcher with a Bearer access token; `admin`: the console session. */
export type RouteRole = 'public' | 'device' | 'admin';

declare module 'fastify' {
  interface FastifyContextConfig {
    role?: RouteRole;
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
