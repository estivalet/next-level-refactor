import helmet from '@fastify/helmet';
import swagger from '@fastify/swagger';
import Fastify, { type FastifyInstance } from 'fastify';
import {
  jsonSchemaTransform,
  serializerCompiler,
  validatorCompiler,
} from 'fastify-type-provider-zod';
import { createRemoteJWKSet, type JWTVerifyGetKey } from 'jose';
import { v7 as uuidv7 } from 'uuid';
import pkg from '../package.json' with { type: 'json' };
import { GOOGLE_JWKS_URL, googleProvider } from './auth/google.ts';
import type { IdentityProviders } from './auth/identity.ts';
import { stubProviders, type StubProviders } from './auth/stub.ts';
import type { ApiDb } from './db/open.ts';
import type { Env } from './env.ts';
import { registerErrorHandling } from './errors.ts';
import { requireRouteRoles } from './plugins/roles.ts';
import { healthRoutes } from './routes/health.ts';
import { launcherConfigRoutes } from './routes/launcherConfig.ts';
import { stubRoutes } from './routes/stub.ts';

export interface AppDeps {
  env: Env;
  db: ApiDb;
  clock: () => Date;
  /** Fastify logger setting: false in tests, pino options in the server. */
  log?: boolean | Record<string, unknown>;
  /** Google's token endpoint client; tests inject a fake. */
  fetch?: typeof fetch;
  /** Google's signing keys; tests inject a local set. */
  googleJwks?: JWTVerifyGetKey;
}

/** The stub with `AUTH_STUB=1`, else the Google Desktop and Web clients. */
function identityProviders(deps: AppDeps): IdentityProviders | StubProviders {
  const { env } = deps;
  if (env.authStub || !env.google) {
    return stubProviders({ publicUrl: env.publicUrl, clock: deps.clock });
  }
  const shared = {
    fetch: deps.fetch ?? fetch,
    jwks: deps.googleJwks ?? createRemoteJWKSet(new URL(GOOGLE_JWKS_URL)),
    clock: deps.clock,
  };
  return {
    desktop: googleProvider({ ...shared, ...env.google.desktop }),
    web: googleProvider({ ...shared, ...env.google.web }),
  };
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
  const identity = identityProviders(deps);
  launcherConfigRoutes(app, identity.desktop, deps.db);
  if ('issue' in identity) stubRoutes(app, identity, deps.env.publicUrl);
  return app;
}
