import {
  CatalogItemSchema,
  type CatalogItem,
  type DownloadFailure,
  type DownloadState,
  type DownloadSummary,
  type PausedReason,
} from '@nextlevel/shared';
import { asc, eq } from 'drizzle-orm';
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

/** The stored item, or undefined when it no longer parses (written by an older version). */
function itemOf(json: string): CatalogItem | undefined {
  try {
    const parsed = CatalogItemSchema.safeParse(JSON.parse(json));
    return parsed.success ? parsed.data : undefined;
  } catch {
    return undefined;
  }
}

const toRow = (row: Row): DownloadRow | undefined => {
  const item = itemOf(row.item);
  return item ? withItem(row, item) : undefined;
};

const withItem = (row: Row, item: CatalogItem): DownloadRow => ({
  id: row.id,
  itemId: row.catalogItemId,
  version: row.version,
  item,
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

  // Rows whose item no longer parses are skipped everywhere (one bad row never breaks the
  // queue); `unreadable()` names them so the service can drop them.

  get(id: string): DownloadRow | undefined {
    const row = this.db.select().from(downloads).where(eq(downloads.id, id)).get();
    return row ? toRow(row) : undefined;
  }

  /** Oldest first: the queue order. */
  list(): DownloadRow[] {
    return this.#ordered().flatMap((row) => toRow(row) ?? []);
  }

  /** Ids of rows whose stored item no longer parses. */
  unreadable(): string[] {
    return this.#ordered()
      .filter((row) => itemOf(row.item) === undefined)
      .map((row) => row.id);
  }

  /** The next download to run: the oldest queued one. */
  next(): DownloadRow | undefined {
    return this.list().find((row) => row.state === 'queued');
  }

  /** The item's queued, running or paused download. */
  activeFor(itemId: string): DownloadRow | undefined {
    return this.list().find((row) => row.itemId === itemId && ACTIVE.includes(row.state));
  }

  failedFor(itemId: string): DownloadRow | undefined {
    return this.list().find((row) => row.itemId === itemId && row.state === 'failed');
  }

  #ordered(): Row[] {
    return this.db
      .select()
      .from(downloads)
      .orderBy(asc(downloads.createdAt), asc(downloads.id))
      .all();
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
