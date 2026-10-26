import type { FastifyRequest } from 'fastify';
import type { Env } from './env.ts';

/**
 * Fastify/pino logger options (architecture §7: no PII beyond the user id in logs). A request is
 * logged by method and path only: query strings can carry OAuth codes and states, and the
 * client address is personal data.
 */
export function logOptions(nodeEnv: Env['nodeEnv']): Record<string, unknown> {
  return {
    level: nodeEnv === 'production' ? 'info' : 'debug',
    serializers: {
      req: (request: FastifyRequest) => ({
        method: request.method,
        path: request.url.split('?')[0],
      }),
    },
  };
}
