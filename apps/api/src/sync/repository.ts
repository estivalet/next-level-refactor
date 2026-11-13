import type { SyncDocument, SyncKind } from '@nextlevel/shared';
import { and, asc, eq, isNotNull, sql } from 'drizzle-orm';
import type { ApiDb } from '../db/open.ts';
import { syncDocuments } from '../db/schema.ts';

// Sync documents (FR-SET-5): optimistic concurrency on `revision`. A write names the revision it
// is based on; the update only matches that revision (insert only when there is none yet).

export type PutResult =
  | { kind: 'saved'; revision: number; updatedAt: string }
  | { kind: 'conflict'; current: SyncDocument };

const EMPTY: SyncDocument = { revision: 0, data: null, updatedAt: null };

export function getDocument(db: ApiDb, userId: string, kind: SyncKind): SyncDocument {
  const row = db
    .select()
    .from(syncDocuments)
    .where(and(eq(syncDocuments.userId, userId), eq(syncDocuments.kind, kind)))
    .get();
  return row ? { revision: row.revision, data: row.data, updatedAt: row.updatedAt } : EMPTY;
}

export function putDocument(
  db: ApiDb,
  input: { userId: string; kind: SyncKind; baseRevision: number; data: unknown; now: Date },
): PutResult {
  const updatedAt = input.now.toISOString();
  const revision = input.baseRevision + 1;
  const where = and(eq(syncDocuments.userId, input.userId), eq(syncDocuments.kind, input.kind));
  // One statement either way, so two launchers writing at once can't both win.
  const changes =
    input.baseRevision === 0
      ? db
          .insert(syncDocuments)
          .values({ userId: input.userId, kind: input.kind, revision, data: input.data, updatedAt })
          .onConflictDoNothing()
          .run().changes
      : db
          .update(syncDocuments)
          .set({ revision, data: input.data, updatedAt })
          .where(and(where, eq(syncDocuments.revision, input.baseRevision)))
          .run().changes;
  if (changes === 1) return { kind: 'saved', revision, updatedAt };
  return { kind: 'conflict', current: getDocument(db, input.userId, input.kind) };
}

/** Every document of an account, for "Download my data". */
export function allDocuments(db: ApiDb, userId: string) {
  return db
    .select()
    .from(syncDocuments)
    .where(and(eq(syncDocuments.userId, userId), isNotNull(syncDocuments.data)))
    .orderBy(asc(syncDocuments.kind))
    .all()
    .map((row) => ({
      kind: row.kind,
      revision: row.revision,
      updatedAt: row.updatedAt,
      data: row.data,
    }));
}

/**
 * Delete synced data (Settings → Sync): the data goes, the rows stay with their revision bumped,
 * so a launcher that still holds an old revision gets 409 instead of writing over a newer one.
 */
export function clearDocuments(db: ApiDb, userId: string, now: Date): void {
  db.update(syncDocuments)
    .set({ data: null, revision: sql`${syncDocuments.revision} + 1`, updatedAt: now.toISOString() })
    .where(eq(syncDocuments.userId, userId))
    .run();
}

/** Account deletion: the rows go too. */
export function deleteDocuments(db: ApiDb, userId: string): void {
  db.delete(syncDocuments).where(eq(syncDocuments.userId, userId)).run();
}
