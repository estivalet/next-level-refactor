import { LauncherConfigSchema } from '@nextlevel/shared';
import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import type { IdentityProvider } from '../auth/identity.ts';
import { SCOPES } from '../auth/identity.ts';
import type { ApiDb } from '../db/open.ts';
import { loadAppSettings } from '../settings/AppSettingsRepository.ts';

/** `GET /v1/auth/launcher-config`: where the launcher sends the browser, and the banner (D28). */
export function launcherConfigRoutes(
  app: FastifyInstance,
  desktop: IdentityProvider,
  db: ApiDb,
): void {
  app
    .withTypeProvider<ZodTypeProvider>()
    .get(
      '/v1/auth/launcher-config',
      { config: { role: 'public' }, schema: { response: { 200: LauncherConfigSchema } } },
      () => ({
        authorizeUrl: desktop.authorizeUrl,
        clientId: desktop.clientId,
        scopes: SCOPES,
        banner: loadAppSettings(db).banner,
      }),
    );
}
