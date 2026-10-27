import { readFile } from 'node:fs/promises';
import { extname, join, resolve, sep } from 'node:path';
import type { FastifyInstance } from 'fastify';
import { apiError } from '../errors.ts';

const TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
};

/**
 * The built admin console (architecture §6: one origin, no CORS). Files under `ADMIN_DIST`;
 * any other non-API path gets `index.html` (the console routes by hash). `/v1/…` stays JSON.
 */
export function adminStaticRoutes(app: FastifyInstance, root: string): void {
  const base = resolve(root);
  const read = async (rel: string) => {
    const file = resolve(join(base, rel));
    if (file !== base && !file.startsWith(base + sep)) return null;
    try {
      return {
        body: await readFile(file),
        type: TYPES[extname(file)] ?? 'application/octet-stream',
        immutable: file.startsWith(join(base, 'assets') + sep),
      };
    } catch {
      return null;
    }
  };
  app.get('/*', { config: { role: 'public' }, schema: { hide: true } }, async (request, reply) => {
    // Fastify has already refused malformed escapes (frameworkErrors in errors.ts).
    const path = decodeURIComponent(request.url.split('?')[0] ?? '/');
    if (path.startsWith('/v1/') || path === '/v1') throw apiError('NOT_FOUND');
    const found = (path !== '/' ? await read(path) : null) ?? (await read('index.html'));
    if (!found) throw apiError('NOT_FOUND');
    // Vite names built assets by content hash; the page itself must be revalidated.
    const cache = found.immutable ? 'public, max-age=31536000, immutable' : 'no-cache';
    return reply.type(found.type).header('cache-control', cache).send(found.body);
  });
}
