import {
  safeFilename,
  type AdminCatalogFile,
  type CatalogMediaKind,
  type FileRole,
} from '@nextlevel/shared';
import { getSystem } from '@nextlevel/system-catalog';
import { and, eq, ne } from 'drizzle-orm';
import type { Readable } from 'node:stream';
import { audited } from '../admin/audit.ts';
import type { ApiContext } from '../context.ts';
import { catalogFiles, catalogItems, catalogMedia } from '../db/schema.ts';
import { apiError } from '../errors.ts';

// Catalog file and art uploads (FR-ADM-3, US-F1, D41): the console streams them through the API,
// which computes size and SHA-256. A file is replaced, never edited; any file change on a
// published item bumps its `version` (D42: the launcher shows Update available).

type FileRow = typeof catalogFiles.$inferSelect;
type ItemRow = typeof catalogItems.$inferSelect;

export const MEDIA_TYPES = new Set([
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/gif',
  'video/mp4',
  'video/webm',
]);

export function toAdminFile(row: FileRow): AdminCatalogFile {
  return {
    id: row.id,
    filename: row.filename,
    size: row.size,
    sha256: row.sha256,
    role: row.role,
    status: row.status,
    createdAt: row.createdAt,
  };
}

export function itemOrNotFound(ctx: ApiContext, itemId: string): ItemRow {
  const item = ctx.db.select().from(catalogItems).where(eq(catalogItems.id, itemId)).get();
  if (!item) throw apiError('NOT_FOUND');
  return item;
}

/** A published item's files or art changed: installed copies get Update available (D42). */
function touch(ctx: ApiContext, item: ItemRow): void {
  ctx.db
    .update(catalogItems)
    .set({
      version: item.status === 'published' ? item.version + 1 : item.version,
      updatedAt: ctx.clock().toISOString(),
    })
    .where(eq(catalogItems.id, item.id))
    .run();
}

/** `rom`/`disc` names need one of the system's extensions; `extra` (manuals) any safe name. */
function checkFilename(item: ItemRow, filename: string, role: FileRole): void {
  const extensions = role === 'extra' ? undefined : (getSystem(item.systemId)?.extensions ?? []);
  if (!safeFilename(filename, extensions)) {
    throw apiError('VALIDATION_FAILED', 'This file name is not allowed.', { reason: 'filename' });
  }
}

export function startUpload(
  ctx: ApiContext,
  itemId: string,
  input: { filename: string; role: FileRole },
): { fileId: string; uploadUrl: string } {
  const item = itemOrNotFound(ctx, itemId);
  checkFilename(item, input.filename, input.role);
  const fileId = ctx.newId();
  // A scratch row until complete; not audited (the maintenance job prunes old ones).
  ctx.db
    .insert(catalogFiles)
    .values({
      id: fileId,
      itemId,
      filename: input.filename,
      storageKey: `files/${itemId}/${fileId}`,
      role: input.role,
      status: 'pending',
      createdAt: ctx.clock().toISOString(),
    })
    .run();
  return { fileId, uploadUrl: `/v1/admin/catalog/uploads/${fileId}` };
}

export async function receiveUpload(
  ctx: ApiContext,
  fileId: string,
  body: Readable,
): Promise<{ size: number; sha256: string }> {
  const row = ctx.db.select().from(catalogFiles).where(eq(catalogFiles.id, fileId)).get();
  if (row?.status !== 'pending') throw apiError('NOT_FOUND');
  const stored = await ctx.files.put(row.storageKey, body, ctx.limits.upload);
  ctx.db.update(catalogFiles).set(stored).where(eq(catalogFiles.id, fileId)).run();
  return stored;
}

/**
 * Marks an uploaded file ready, checking the console's checksum when it sent one. A ready file
 * with the same name (any case: Windows) is replaced. Audited `item.file.add`.
 */
export async function completeUpload(
  ctx: ApiContext,
  actorId: string,
  itemId: string,
  fileId: string,
  sha256: string | undefined,
): Promise<AdminCatalogFile> {
  const item = itemOrNotFound(ctx, itemId);
  const row = ctx.db.select().from(catalogFiles).where(eq(catalogFiles.id, fileId)).get();
  if (row?.itemId !== itemId || row.status !== 'pending') throw apiError('NOT_FOUND');
  if ((await ctx.files.size(row.storageKey)) === null || row.sha256 === '') {
    throw apiError('CONFLICT', 'The file was not uploaded.', { reason: 'notUploaded' });
  }
  if (sha256 !== undefined && sha256 !== row.sha256) {
    await ctx.files.delete(row.storageKey);
    ctx.db.delete(catalogFiles).where(eq(catalogFiles.id, fileId)).run();
    throw apiError('VALIDATION_FAILED', 'The checksum does not match.', { reason: 'checksum' });
  }
  const replaced = ctx.db
    .select()
    .from(catalogFiles)
    .where(and(eq(catalogFiles.itemId, itemId), eq(catalogFiles.status, 'ready')))
    .all()
    .filter((other) => other.filename.toLowerCase() === row.filename.toLowerCase());
  const ready = { ...row, status: 'ready' as const };
  audited(
    ctx,
    actorId,
    [
      {
        action: 'item.file.add',
        targetType: 'item',
        targetId: itemId,
        before: replaced[0] ? toAdminFile(replaced[0]) : null,
        after: toAdminFile(ready),
      },
    ],
    () => {
      for (const old of replaced)
        ctx.db.delete(catalogFiles).where(eq(catalogFiles.id, old.id)).run();
      ctx.db.update(catalogFiles).set({ status: 'ready' }).where(eq(catalogFiles.id, fileId)).run();
      touch(ctx, item);
    },
  );
  for (const old of replaced) await ctx.files.delete(old.storageKey);
  return toAdminFile(ready);
}

/** Removes a ready file (`item.file.remove`); a published item keeps at least one rom/disc. */
export async function removeFile(
  ctx: ApiContext,
  actorId: string,
  itemId: string,
  fileId: string,
): Promise<void> {
  const item = itemOrNotFound(ctx, itemId);
  const row = ctx.db.select().from(catalogFiles).where(eq(catalogFiles.id, fileId)).get();
  if (row?.itemId !== itemId || row.status !== 'ready') throw apiError('NOT_FOUND');
  if (item.status === 'published' && row.role !== 'extra') {
    const others = ctx.db
      .select()
      .from(catalogFiles)
      .where(
        and(
          eq(catalogFiles.itemId, itemId),
          eq(catalogFiles.status, 'ready'),
          ne(catalogFiles.id, fileId),
        ),
      )
      .all()
      .filter((other) => other.role !== 'extra');
    if (others.length === 0) {
      throw apiError('CONFLICT', 'A published item needs a game file.', { reason: 'lastFile' });
    }
  }
  audited(
    ctx,
    actorId,
    [
      {
        action: 'item.file.remove',
        targetType: 'item',
        targetId: itemId,
        before: toAdminFile(row),
        after: null,
      },
    ],
    () => {
      ctx.db.delete(catalogFiles).where(eq(catalogFiles.id, fileId)).run();
      touch(ctx, item);
    },
  );
  await ctx.files.delete(row.storageKey);
}

/** Sets one art kind (`item.media.set`); the previous file of that kind is replaced. */
export async function putMedia(
  ctx: ApiContext,
  actorId: string,
  itemId: string,
  kind: CatalogMediaKind,
  contentType: string | undefined,
  body: Readable,
): Promise<{ kind: CatalogMediaKind; size: number; sha256: string; version: number }> {
  const item = itemOrNotFound(ctx, itemId);
  const type = contentType?.split(';')[0]?.trim().toLowerCase() ?? '';
  if (!MEDIA_TYPES.has(type)) {
    throw apiError('VALIDATION_FAILED', 'Art must be an image or a video.', { reason: 'type' });
  }
  const where = and(eq(catalogMedia.itemId, itemId), eq(catalogMedia.kind, kind));
  const before = ctx.db.select().from(catalogMedia).where(where).get();
  const version = (before?.version ?? 0) + 1;
  const storageKey = `media/${itemId}/${kind}/${String(version)}`;
  const stored = await ctx.files.put(storageKey, body, ctx.limits.media);
  const after = { kind, ...stored, version };
  audited(
    ctx,
    actorId,
    [
      {
        action: 'item.media.set',
        targetType: 'item',
        targetId: itemId,
        before: before
          ? { kind, size: before.size, sha256: before.sha256, version: before.version }
          : null,
        after,
      },
    ],
    () => {
      if (before) ctx.db.delete(catalogMedia).where(where).run();
      ctx.db
        .insert(catalogMedia)
        .values({ itemId, kind, storageKey, ...stored, version })
        .run();
      touch(ctx, item);
    },
  );
  if (before) await ctx.files.delete(before.storageKey);
  return after;
}

export async function removeMedia(
  ctx: ApiContext,
  actorId: string,
  itemId: string,
  kind: CatalogMediaKind,
): Promise<void> {
  const item = itemOrNotFound(ctx, itemId);
  const where = and(eq(catalogMedia.itemId, itemId), eq(catalogMedia.kind, kind));
  const row = ctx.db.select().from(catalogMedia).where(where).get();
  if (!row) throw apiError('NOT_FOUND');
  audited(
    ctx,
    actorId,
    [
      {
        action: 'item.media.remove',
        targetType: 'item',
        targetId: itemId,
        before: { kind, size: row.size, sha256: row.sha256, version: row.version },
        after: null,
      },
    ],
    () => {
      ctx.db.delete(catalogMedia).where(where).run();
      touch(ctx, item);
    },
  );
  await ctx.files.delete(row.storageKey);
}
