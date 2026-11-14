import { isNotNull } from 'drizzle-orm';
import type { ApiContext } from '../context.ts';
import { catalogFiles, catalogMedia, licenses } from '../db/schema.ts';

const DAY_MS = 24 * 60 * 60 * 1000;
const PREFIXES = ['files/', 'media/', 'evidence/'] as const;
/** A run may delete up to this many files, or a tenth of the store when that is more. */
const MIN_CAP = 25;

export interface SweepResult {
  deleted: number;
  /** `skipped`: it looked like the wrong database (none of the files named, or far too many). */
  sweep: 'done' | 'skipped';
}

/**
 * Deletes stored files no row names (an upload that lost its race, art replaced while a write
 * was failing) once they are older than 24 hours, so a file being written is never touched (D57).
 * R2 keeps no old versions, so a delete is final: when the database names no stored file at all
 * (a new or restored database, another environment pointed at the bucket) or a run would delete
 * more than a tenth of the store (and more than 25 files), it deletes nothing and says so.
 */
export async function sweepOrphans(ctx: ApiContext): Promise<SweepResult> {
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
  const orphans: string[] = [];
  let total = 0;
  for (const prefix of PREFIXES) {
    for await (const file of ctx.files.list(prefix)) {
      total += 1;
      if (!known.has(file.key) && file.modifiedAt.getTime() <= cutoff) orphans.push(file.key);
    }
  }
  if (orphans.length === 0) return { deleted: 0, sweep: 'done' };
  const cap = Math.max(MIN_CAP, Math.floor(total / 10));
  if (known.size === 0 || orphans.length > cap) return { deleted: 0, sweep: 'skipped' };
  for (const key of orphans) await ctx.files.delete(key);
  return { deleted: orphans.length, sweep: 'done' };
}
