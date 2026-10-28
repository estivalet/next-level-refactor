import type { FastifyInstance, FastifyReply } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';
import type { ApiContext } from '../context.ts';
import { catalogFiles, catalogMedia } from '../db/schema.ts';
import { apiError, MESSAGES } from '../errors.ts';
import { verifyFileToken, type FileTokenPayload } from '../storage/tokens.ts';

// GET /v1/files/:token (security §2, FR-CAT-6): the token is the authorization. Logs show the
// route pattern, never the token (log.ts). One `Range` is honoured, so downloads resume.

interface Stored {
  key: string;
  size: number;
  sha256: string;
}

function storedOf(ctx: ApiContext, token: FileTokenPayload): Stored | undefined {
  if (token.kind === 'file') {
    const row = ctx.db.select().from(catalogFiles).where(eq(catalogFiles.id, token.id)).get();
    return row?.status === 'ready'
      ? { key: row.storageKey, size: row.size, sha256: row.sha256 }
      : undefined;
  }
  const [itemId, kind] = token.id.split('/');
  if (!itemId || !kind) return undefined;
  const row = ctx.db
    .select()
    .from(catalogMedia)
    .where(and(eq(catalogMedia.itemId, itemId), eq(catalogMedia.kind, kind)))
    .get();
  return row ? { key: row.storageKey, size: row.size, sha256: row.sha256 } : undefined;
}

/** `bytes=a-b` or `bytes=a-` → an inclusive range clipped to the size; null: not satisfiable. */
export function parseRange(
  header: string,
  size: number,
): { start: number; end: number } | null | undefined {
  const match = /^bytes=(\d+)-(\d*)$/.exec(header.trim());
  if (!match) return undefined; // not one simple range: serve the whole file
  const start = Number(match[1]);
  const end = match[2] === '' ? size - 1 : Math.min(Number(match[2]), size - 1);
  if (start >= size || end < start) return null;
  return { start, end };
}

const gone = (reply: FastifyReply, requestId: string) =>
  reply.status(410).send({
    error: { code: 'NOT_FOUND', message: MESSAGES.NOT_FOUND ?? '', requestId },
  });

export function fileRoutes(app: FastifyInstance, ctx: ApiContext): void {
  app.withTypeProvider<ZodTypeProvider>().get(
    '/v1/files/:token',
    {
      config: { role: 'public' },
      schema: { hide: true, params: z.object({ token: z.string().min(1).max(1000) }) },
    },
    async (request, reply) => {
      const token = verifyFileToken(ctx, request.params.token);
      if (!token) throw apiError('UNAUTHENTICATED');
      const device = ctx.devices.byId(token.deviceId);
      const user = ctx.users.byId(token.userId);
      if (
        !device ||
        device.revokedAt !== null ||
        device.userId !== token.userId ||
        user?.status !== 'active'
      ) {
        throw apiError('FORBIDDEN');
      }
      const stored = storedOf(ctx, token);
      if (!stored || (await ctx.files.size(stored.key)) === null) return gone(reply, request.id);
      void reply
        .header('accept-ranges', 'bytes')
        .header('etag', `"${stored.sha256}"`)
        .type('application/octet-stream');
      const header = request.headers.range;
      const range = header ? parseRange(header, stored.size) : undefined;
      if (range === null) {
        return reply
          .status(416)
          .header('content-range', `bytes */${String(stored.size)}`)
          .send();
      }
      if (range) {
        return reply
          .status(206)
          .header(
            'content-range',
            `bytes ${String(range.start)}-${String(range.end)}/${String(stored.size)}`,
          )
          .header('content-length', String(range.end - range.start + 1))
          .send(await ctx.files.open(stored.key, range));
      }
      return reply
        .header('content-length', String(stored.size))
        .send(await ctx.files.open(stored.key));
    },
  );
}
