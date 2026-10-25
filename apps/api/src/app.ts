import helmet from '@fastify/helmet';
import swagger from '@fastify/swagger';
import Fastify, { type FastifyInstance } from 'fastify';
import {
  jsonSchemaTransform,
  serializerCompiler,
  validatorCompiler,
} from 'fastify-type-provider-zod';
import { v7 as uuidv7 } from 'uuid';
import pkg from '../package.json' with { type: 'json' };
import type { ApiDb } from './db/open.ts';
import type { Env } from './env.ts';
import { registerErrorHandling } from './errors.ts';
import { requireRouteRoles } from './plugins/roles.ts';
import { healthRoutes } from './routes/health.ts';

export interface AppDeps {
  env: Env;
  db: ApiDb;
  clock: () => Date;
  /** Fastify logger setting: false in tests, pino options in the server. */
  log?: boolean | Record<string, unknown>;
}

/**
 * The API (architecture §5.2): request id → security headers → role-checked, Zod-validated
 * routes → one error envelope. Every route declares its role; OpenAPI comes from the schemas.
 */
export async function buildApp(deps: AppDeps): Promise<FastifyInstance> {
  const app = Fastify({
    logger: deps.log ?? false,
    genReqId: () => uuidv7(),
    requestIdHeader: false,
  });
  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);
  registerErrorHandling(app);
  app.addHook('onSend', (request, reply, payload, done) => {
    void reply.header('x-request-id', request.id);
    done(null, payload);
  });
  await app.register(helmet);
  await app.register(swagger, {
    openapi: {
      openapi: '3.1.0',
      info: { title: 'NextLevel API', version: pkg.version },
    },
    transform: jsonSchemaTransform,
  });
  requireRouteRoles(app);

  app.get('/v1/openapi.json', { config: { role: 'public' }, schema: { hide: true } }, () =>
    app.swagger(),
  );
  healthRoutes(app, deps.db);
  return app;
}
