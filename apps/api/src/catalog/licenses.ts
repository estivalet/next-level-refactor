import { safeFilename, type AdminCatalogItem, type LicenseInput } from '@nextlevel/shared';
import { eq } from 'drizzle-orm';
import type { Readable } from 'node:stream';
import { audited, type AuditInput } from '../admin/audit.ts';
import type { ApiContext } from '../context.ts';
import { catalogItems, licenses } from '../db/schema.ts';
import { apiError } from '../errors.ts';
import { itemOrNotFound } from './files.ts';
import { itemDetail, licenseOf, toAdminLicense } from './items.ts';

// License records (content policy §2–4, D44): one per item. Replacing it clears verification and
// unpublishes a published item in the same transaction; it is verified only with evidence.

export const EVIDENCE_TYPES = new Set([
  'application/pdf',
  'image/png',
  'image/jpeg',
  'text/plain',
  'message/rfc822',
]);

export async function putLicense(
  ctx: ApiContext,
  actorId: string,
  itemId: string,
  input: LicenseInput,
): Promise<AdminCatalogItem> {
  const item = itemOrNotFound(ctx, itemId);
  const old = licenseOf(ctx, item);
  const now = ctx.clock().toISOString();
  const row: typeof licenses.$inferInsert = {
    id: ctx.newId(),
    type: input.type,
    rightsHolder: input.rightsHolder,
    contact: input.contact,
    terms: input.terms,
    territories: input.territories ?? null,
    startsAt: input.startsAt ?? null,
    expiresAt: input.expiresAt ?? null,
    createdAt: now,
  };
  const entries: AuditInput[] = [
    {
      action: 'item.license',
      targetType: 'item',
      targetId: itemId,
      before: old ? toAdminLicense(ctx, old) : null,
      after: { ...input, verified: false },
    },
  ];
  const unpublish = item.status === 'published';
  if (unpublish) {
    entries.push({
      action: 'item.unpublish',
      targetType: 'item',
      targetId: itemId,
      before: { status: 'published' },
      after: { status: 'unpublished', reason: 'licenseReplaced' },
    });
  }
  audited(ctx, actorId, entries, () => {
    ctx.db.insert(licenses).values(row).run();
    ctx.db
      .update(catalogItems)
      .set({ licenseId: row.id, updatedAt: now, ...(unpublish ? { status: 'unpublished' } : {}) })
      .where(eq(catalogItems.id, itemId))
      .run();
    if (old) ctx.db.delete(licenses).where(eq(licenses.id, old.id)).run();
  });
  if (old?.evidenceKey) await ctx.files.delete(old.evidenceKey);
  return itemDetail(ctx, itemId);
}

function currentLicense(ctx: ApiContext, itemId: string) {
  const license = licenseOf(ctx, itemOrNotFound(ctx, itemId));
  if (!license) throw apiError('CONFLICT', 'The item has no license.', { reason: 'noLicense' });
  return license;
}

/**
 * Stores the evidence file (≤ 20 MiB; pdf, image, text or email). A verified license keeps its
 * evidence: replace the license to change it.
 */
export async function putEvidence(
  ctx: ApiContext,
  actorId: string,
  itemId: string,
  filename: string,
  contentType: string | undefined,
  body: Readable,
): Promise<AdminCatalogItem> {
  const license = currentLicense(ctx, itemId);
  if (license.verifiedAt !== null) {
    throw apiError('CONFLICT', 'The license is verified.', { reason: 'verified' });
  }
  const type = contentType?.split(';')[0]?.trim().toLowerCase() ?? '';
  if (!EVIDENCE_TYPES.has(type) || !safeFilename(filename)) {
    throw apiError('VALIDATION_FAILED', 'Evidence must be a PDF, image, text or email file.', {
      reason: 'type',
    });
  }
  const key = `evidence/${license.id}/${ctx.newId()}`;
  await ctx.files.put(key, body, ctx.limits.evidence);
  audited(
    ctx,
    actorId,
    [
      {
        action: 'item.license',
        targetType: 'item',
        targetId: itemId,
        before: { evidenceFilename: license.evidenceFilename },
        after: { evidenceFilename: filename },
      },
    ],
    () => {
      ctx.db
        .update(licenses)
        .set({ evidenceKey: key, evidenceFilename: filename })
        .where(eq(licenses.id, license.id))
        .run();
    },
  );
  if (license.evidenceKey) await ctx.files.delete(license.evidenceKey);
  return itemDetail(ctx, itemId);
}

export async function evidenceFile(
  ctx: ApiContext,
  itemId: string,
): Promise<{ filename: string; body: Readable }> {
  const license = currentLicense(ctx, itemId);
  if (!license.evidenceKey || !license.evidenceFilename) throw apiError('NOT_FOUND');
  return { filename: license.evidenceFilename, body: await ctx.files.open(license.evidenceKey) };
}

/** Marks the license verified by this admin, now (content policy §4 step 2). */
export function verifyLicense(ctx: ApiContext, actorId: string, itemId: string): AdminCatalogItem {
  const license = currentLicense(ctx, itemId);
  if (!license.evidenceKey) {
    throw apiError('CONFLICT', 'Upload the evidence first.', { reason: 'noEvidence' });
  }
  if (license.verifiedAt !== null) return itemDetail(ctx, itemId);
  const at = ctx.clock().toISOString();
  audited(
    ctx,
    actorId,
    [
      {
        action: 'item.license.verify',
        targetType: 'item',
        targetId: itemId,
        before: { verifiedAt: null },
        after: { verifiedAt: at },
      },
    ],
    () => {
      ctx.db
        .update(licenses)
        .set({ verifiedBy: actorId, verifiedAt: at })
        .where(eq(licenses.id, license.id))
        .run();
    },
  );
  return itemDetail(ctx, itemId);
}
