import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import pkg from '../../package.json' with { type: 'json' };
import type { ApiDb } from '../db/open.ts';

const HealthSchema = z.object({
  status: z.literal('ok'),
  version: z.string(),
  db: z.enum(['ok', 'error']),
});

/** `GET /v1/health`: no auth; used by the deployment smoke test. */
export function healthRoutes(app: FastifyInstance, db: ApiDb): void {
  app
    .withTypeProvider<ZodTypeProvider>()
    .get(
      '/v1/health',
      { config: { role: 'public' }, schema: { response: { 200: HealthSchema } } },
      () => {
        let state: 'ok' | 'error' = 'ok';
        try {
          db.$client.prepare('select 1').get();
        } catch {
          state = 'error';
        }
        return { status: 'ok' as const, version: pkg.version, db: state };
      },
    );
}
