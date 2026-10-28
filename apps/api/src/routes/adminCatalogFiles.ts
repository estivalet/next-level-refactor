import {
  AdminCatalogFileSchema,
  AdminCatalogMediaSchema,
  CatalogMediaKindSchema,
  CompleteUploadSchema,
  StartUploadResponseSchema,
  StartUploadSchema,
  UploadResultSchema,
} from '@nextlevel/shared';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { Readable } from 'node:stream';
import { z } from 'zod';
import {
  completeUpload,
  putMedia,
  receiveUpload,
  removeFile,
  removeMedia,
  startUpload,
} from '../catalog/files.ts';
import type { ApiContext } from '../context.ts';
import { apiError } from '../errors.ts';

const id = z.string().min(1).max(100);
const config = { role: 'admin' as const };

export const adminActor = (request: FastifyRequest) => {
  if (!request.admin) throw apiError('UNAUTHENTICATED');
  return request.admin.userId;
};

/**
 * The request body as a stream (the raw-body scope's only parser hands it through). Its declared
 * length is checked first: a body over `limit` is refused before a byte is read, so the client
 * gets the envelope instead of a reset connection.
 */
export const rawBody = (request: FastifyRequest, limit: number): Readable => {
  if (!(request.body instanceof Readable)) throw apiError('VALIDATION_FAILED', 'No body.');
  const length = Number(request.headers['content-length']);
  if (!Number.isInteger(length) || length < 0) {
    throw apiError('VALIDATION_FAILED', 'Content-Length is required.', { reason: 'length' });
  }
  if (length > limit) {
    throw apiError('VALIDATION_FAILED', 'The file is too large.', { reason: 'tooLarge' });
  }
  return request.body;
};

/**
 * Catalog files and art (api-spec Admin catalog, FR-ADM-3, US-F1): role `admin` (cookie + CSRF),
 * every change audited. Raw uploads run in their own scope whose only parser passes the request
 * stream through untouched, so a 4 GiB file is never held in memory.
 */
export async function adminCatalogFileRoutes(app: FastifyInstance, ctx: ApiContext): Promise<void> {
  const route = app.withTypeProvider<ZodTypeProvider>();

  route.post(
    '/v1/admin/catalog/items/:id/files',
    {
      config,
      schema: {
        params: z.object({ id }),
        body: StartUploadSchema,
        response: { 200: StartUploadResponseSchema },
      },
    },
    (request) => startUpload(ctx, request.params.id, request.body),
  );

  route.post(
    '/v1/admin/catalog/items/:id/files/:fileId/complete',
    {
      config,
      schema: {
        params: z.object({ id, fileId: id }),
        body: CompleteUploadSchema,
        response: { 200: AdminCatalogFileSchema },
      },
    },
    (request) =>
      completeUpload(
        ctx,
        adminActor(request),
        request.params.id,
        request.params.fileId,
        request.body.sha256,
      ),
  );

  route.delete(
    '/v1/admin/catalog/items/:id/files/:fileId',
    { config, schema: { params: z.object({ id, fileId: id }) } },
    async (request, reply) => {
      await removeFile(ctx, adminActor(request), request.params.id, request.params.fileId);
      return reply.status(204).send();
    },
  );

  route.delete(
    '/v1/admin/catalog/items/:id/media/:kind',
    { config, schema: { params: z.object({ id, kind: CatalogMediaKindSchema }) } },
    async (request, reply) => {
      await removeMedia(ctx, adminActor(request), request.params.id, request.params.kind);
      return reply.status(204).send();
    },
  );

  await app.register((scope, _opts, done) => {
    scope.removeAllContentTypeParsers();
    scope.addContentTypeParser('*', (_request, payload, next) => {
      next(null, payload);
    });
    const raw = scope.withTypeProvider<ZodTypeProvider>();

    raw.put(
      '/v1/admin/catalog/uploads/:fileId',
      {
        config,
        bodyLimit: ctx.limits.upload,
        schema: { params: z.object({ fileId: id }), response: { 200: UploadResultSchema } },
      },
      (request) => receiveUpload(ctx, request.params.fileId, rawBody(request, ctx.limits.upload)),
    );

    raw.put(
      '/v1/admin/catalog/items/:id/media/:kind',
      {
        config,
        bodyLimit: ctx.limits.media,
        schema: {
          params: z.object({ id, kind: CatalogMediaKindSchema }),
          response: { 200: AdminCatalogMediaSchema },
        },
      },
      (request) =>
        putMedia(
          ctx,
          adminActor(request),
          request.params.id,
          request.params.kind,
          request.headers['content-type'],
          rawBody(request, ctx.limits.media),
        ),
    );
    done();
  });
}
