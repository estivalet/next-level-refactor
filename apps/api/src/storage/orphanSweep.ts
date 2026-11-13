import { isNotNull } from 'drizzle-orm';
import type { ApiContext } from '../context.ts';
import { catalogFiles, catalogMedia, licenses } from '../db/schema.ts';

const DAY_MS = 24 * 60 * 60 * 1000;
const PREFIXES = ['files/', 'media/', 'evidence/'] as const;

/**
 * Deletes stored files no row names (an upload that lost its race, art replaced while a write
 * was failing, a store left from a deleted item) once they are older than 24 hours, so a file
 * being written right now is never touched (D57). Answers how many went.
 */
export async function sweepOrphans(ctx: ApiContext): Promise<number> {
  const known = new Set<string>([
    ...ctx.db
      .select({ key: catalogFiles.storageKey })
      .from(catalogFiles)
      .all()
      .map((r) => r.key),
    ...ctx.db
      .select({ key: catalogMedia.storageKey })
      .from(catalogMedia)
      .all()
      .map((r) => r.key),
    ...ctx.db
      .select({ key: licenses.evidenceKey })
      .from(licenses)
      .where(isNotNull(licenses.evidenceKey))
      .all()
      .map((r) => r.key ?? ''),
  ]);
  const cutoff = ctx.clock().getTime() - DAY_MS;
  let deleted = 0;
  for (const prefix of PREFIXES) {
    for await (const file of ctx.files.list(prefix)) {
      if (known.has(file.key) || file.modifiedAt.getTime() > cutoff) continue;
      await ctx.files.delete(file.key);
      deleted += 1;
    }
  }
  return deleted;
}
