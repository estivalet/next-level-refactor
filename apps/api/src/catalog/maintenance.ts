import { and, eq, isNotNull, lt, lte } from 'drizzle-orm';
import type { ApiContext } from '../context.ts';
import { catalogFiles, catalogItems, downloads, licenses } from '../db/schema.ts';
import { sweepOrphans } from '../storage/orphanSweep.ts';
import { setStatus } from './items.ts';

// The hourly-ish job (every 10 minutes and at start): expired licenses unpublish their items
// (D44, audited with no actor), download records older than 12 months go (security §5), and
// uploads abandoned for 24 hours are deleted with their data, and stored files no row names are
// swept after 24 hours (D57).

const DAY_MS = 24 * 60 * 60 * 1000;

export async function runMaintenance(
  ctx: ApiContext,
  opts: { sweep?: boolean } = {},
): Promise<{
  expired: number;
  downloadsPruned: number;
  uploadsPruned: number;
  orphansDeleted: number;
  /** `off`: not this run (the one at start); `skipped`: the sweep's guard held (sweepOrphans). */
  orphanSweep: 'done' | 'skipped' | 'off';
}> {
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
  const swept = opts.sweep === false ? null : await sweepOrphans(ctx);
  return {
    expired: expired.length,
    downloadsPruned,
    uploadsPruned: stale.length,
    orphansDeleted: swept?.deleted ?? 0,
    orphanSweep: swept?.sweep ?? 'off',
  };
}

/** What the log says about a failed run: the error's name and code (an S3 status, ENOSPC…). */
export function maintenanceFailure(error: unknown): { err: string; code: string | null } {
  if (!(error instanceof Error)) return { err: 'unknown', code: null };
  const code = (error as { code?: unknown }).code;
  return { err: error.name, code: typeof code === 'string' ? code : null };
}
