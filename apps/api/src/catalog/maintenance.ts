import { and, eq, isNotNull, lt, lte } from 'drizzle-orm';
import type { ApiContext } from '../context.ts';
import { catalogFiles, catalogItems, downloads, licenses } from '../db/schema.ts';
import { setStatus } from './items.ts';

// The hourly-ish job (every 10 minutes and at start): expired licenses unpublish their items
// (D44, audited with no actor), download records older than 12 months go (security §5), and
// uploads abandoned for 24 hours are deleted with their data.

const DAY_MS = 24 * 60 * 60 * 1000;

export async function runMaintenance(
  ctx: ApiContext,
): Promise<{ expired: number; downloadsPruned: number; uploadsPruned: number }> {
  const now = ctx.clock();
  const expired = ctx.db
    .select({ id: catalogItems.id })
    .from(catalogItems)
    .innerJoin(licenses, eq(licenses.id, catalogItems.licenseId))
    .where(
      and(
        eq(catalogItems.status, 'published'),
        isNotNull(licenses.expiresAt),
        lte(licenses.expiresAt, now.toISOString()),
      ),
    )
    .all();
  for (const { id } of expired) {
    setStatus(ctx, null, id, 'item.unpublish', { status: 'unpublished' }, 'licenseExpired');
  }

  const yearAgo = new Date(now);
  yearAgo.setUTCMonth(yearAgo.getUTCMonth() - 12);
  const downloadsPruned = ctx.db
    .delete(downloads)
    .where(lt(downloads.issuedAt, yearAgo.toISOString()))
    .run().changes;

  const stale = ctx.db
    .select()
    .from(catalogFiles)
    .where(
      and(
        eq(catalogFiles.status, 'pending'),
        lt(catalogFiles.createdAt, new Date(now.getTime() - DAY_MS).toISOString()),
      ),
    )
    .all();
  for (const file of stale) {
    await ctx.files.delete(file.storageKey);
    ctx.db.delete(catalogFiles).where(eq(catalogFiles.id, file.id)).run();
  }
  return { expired: expired.length, downloadsPruned, uploadsPruned: stale.length };
}
