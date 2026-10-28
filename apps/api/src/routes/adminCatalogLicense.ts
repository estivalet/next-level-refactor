import { AdminCatalogItemSchema, LicenseInputSchema } from '@nextlevel/shared';
import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { evidenceFile, putEvidence, putLicense, verifyLicense } from '../catalog/licenses.ts';
import type { ApiContext } from '../context.ts';
import { adminActor, rawBody } from './adminCatalogFiles.ts';

const params = z.object({ id: z.string().min(1).max(100) });
const config = { role: 'admin' as const };
const item = { 200: AdminCatalogItemSchema };

/** RFC 6266 attachment header: an ASCII fallback plus the UTF-8 name. */
const attachment = (filename: string) =>
  `attachment; filename="${filename.replace(/[^\x20-\x7e]|"/g, '_')}"; filename*=UTF-8''${encodeURIComponent(filename)}`;

/** License records and evidence (content policy §4, D44, C10): admin only, audited. */
export async function adminCatalogLicenseRoutes(
  app: FastifyInstance,
  ctx: ApiContext,
): Promise<void> {
  const route = app.withTypeProvider<ZodTypeProvider>();

  route.put(
    '/v1/admin/catalog/items/:id/license',
    { config, schema: { params, body: LicenseInputSchema, response: item } },
    (request) => putLicense(ctx, adminActor(request), request.params.id, request.body),
  );

  route.post(
    '/v1/admin/catalog/items/:id/license/verify',
    { config, schema: { params, response: item } },
    (request) => verifyLicense(ctx, adminActor(request), request.params.id),
  );

  route.get(
    '/v1/admin/catalog/items/:id/license/evidence',
    { config, schema: { params, hide: true } },
    async (request, reply) => {
      const file = await evidenceFile(ctx, request.params.id);
      return reply
        .header('content-disposition', attachment(file.filename))
        .type('application/octet-stream')
        .send(file.body);
    },
  );

  await app.register((scope, _opts, done) => {
    scope.removeAllContentTypeParsers();
    scope.addContentTypeParser('*', (_request, payload, next) => {
      next(null, payload);
    });
    scope.withTypeProvider<ZodTypeProvider>().put(
      '/v1/admin/catalog/items/:id/license/evidence',
      {
        config,
        bodyLimit: ctx.limits.evidence,
        schema: {
          params,
          querystring: z.object({ filename: z.string().min(1).max(200) }),
          response: item,
        },
      },
      (request) =>
        putEvidence(
          ctx,
          adminActor(request),
          request.params.id,
          request.query.filename,
          request.headers['content-type'],
          rawBody(request, ctx.limits.evidence),
        ),
    );
    done();
  });
}
