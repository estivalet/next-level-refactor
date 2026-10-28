import type { FastifyRequest } from 'fastify';
import type { Env } from './env.ts';

/**
 * Fastify/pino logger options (architecture §7: no PII beyond the user id in logs). A request is
 * logged by method and route pattern (`/v1/files/:token`, never the token: security §2), or the
 * path without its query string when no route matched: query strings can carry OAuth codes and
 * states, and the client address is personal data.
 */
/** A download token in a path no route matched (a trailing slash, another method) stays out too. */
const redact = (path: string) => path.replace(/^\/v1\/files\/.*/, '/v1/files/:token');

export function logOptions(nodeEnv: Env['nodeEnv']): Record<string, unknown> {
  return {
    level: nodeEnv === 'production' ? 'info' : 'debug',
    serializers: {
      req: (request: FastifyRequest) => ({
        method: request.method,
        path: request.routeOptions.url ?? redact(request.url.split('?')[0] ?? ''),
      }),
    },
  };
}
