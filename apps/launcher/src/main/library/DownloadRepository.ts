import {
  CatalogItemSchema,
  type CatalogItem,
  type DownloadFailure,
  type DownloadState,
  type DownloadSummary,
  type PausedReason,
} from '@nextlevel/shared';
import { and, asc, eq, inArray } from 'drizzle-orm';
import type { LibraryDb } from './openLibrary.ts';
import { downloads } from './schema.ts';

type Row = typeof downloads.$inferSelect;

export interface DownloadRow {
  id: string;
  itemId: string;
  version: number;
  item: CatalogItem;
  state: DownloadState;
  pausedReason: PausedReason | null;
  bytesDone: number;
  bytesTotal: number;
  error: DownloadFailure | null;
  createdAt: string;
}

export type DownloadPatch = Partial<
  Pick<DownloadRow, 'state' | 'pausedReason' | 'bytesDone' | 'error'>
>;

const toRow = (row: Row): DownloadRow => ({
  id: row.id,
  itemId: row.catalogItemId,
  version: row.version,
  item: CatalogItemSchema.parse(JSON.parse(row.item)),
  state: row.state,
  pausedReason: row.pausedReason,
  bytesDone: row.bytesDone,
  bytesTotal: row.bytesTotal,
  error: row.error as DownloadFailure | null,
  createdAt: row.createdAt,
});

const ACTIVE: DownloadState[] = ['queued', 'downloading', 'paused'];

/** The catalog download queue in `library.db` (FR-CAT-4): it survives restarts. */
export class DownloadRepository {
  constructor(private readonly db: LibraryDb) {}

  enqueue(id: string, item: CatalogItem, now: string): DownloadRow {
    const bytesTotal = item.files.reduce((sum, file) => sum + file.size, 0);
    this.db
      .insert(downloads)
      .values({
        id,
        catalogItemId: item.id,
        version: item.version,
        item: JSON.stringify(item),
        state: 'queued',
        bytesTotal,
        createdAt: now,
        updatedAt: now,
      })
      .run();
    const row = this.get(id);
    if (!row) throw new Error('download row vanished');
    return row;
  }

  get(id: string): DownloadRow | undefined {
    const row = this.db.select().from(downloads).where(eq(downloads.id, id)).get();
    return row ? toRow(row) : undefined;
  }

  /** Oldest first: the queue order. */
  list(): DownloadRow[] {
    return this.db
      .select()
      .from(downloads)
      .orderBy(asc(downloads.createdAt), asc(downloads.id))
      .all()
      .map(toRow);
  }

  /** The next download to run: the oldest queued one. */
  next(): DownloadRow | undefined {
    const row = this.db
      .select()
      .from(downloads)
      .where(eq(downloads.state, 'queued'))
      .orderBy(asc(downloads.createdAt), asc(downloads.id))
      .get();
    return row ? toRow(row) : undefined;
  }

  /** The item's queued, running or paused download. */
  activeFor(itemId: string): DownloadRow | undefined {
    const row = this.db
      .select()
      .from(downloads)
      .where(and(eq(downloads.catalogItemId, itemId), inArray(downloads.state, ACTIVE)))
      .get();
    return row ? toRow(row) : undefined;
  }

  failedFor(itemId: string): DownloadRow | undefined {
    const row = this.db
      .select()
      .from(downloads)
      .where(and(eq(downloads.catalogItemId, itemId), eq(downloads.state, 'failed')))
      .get();
    return row ? toRow(row) : undefined;
  }

  update(id: string, patch: DownloadPatch, now: string): void {
    this.db
      .update(downloads)
      .set({ ...patch, updatedAt: now })
      .where(eq(downloads.id, id))
      .run();
  }

  /** At boot: a download cut off by quitting runs again from its partial files. */
  requeueInterrupted(now: string): void {
    this.db
      .update(downloads)
      .set({ state: 'queued', updatedAt: now })
      .where(eq(downloads.state, 'downloading'))
      .run();
  }

  delete(id: string): void {
    this.db.delete(downloads).where(eq(downloads.id, id)).run();
  }
}

export const toSummary = (row: DownloadRow): DownloadSummary => ({
  id: row.id,
  itemId: row.itemId,
  title: row.item.title,
  systemId: row.item.systemId,
  version: row.version,
  state: row.state,
  pausedReason: row.pausedReason,
  bytesDone: row.bytesDone,
  bytesTotal: row.bytesTotal,
  error: row.error,
  createdAt: row.createdAt,
});
