import type {
  AdminCatalogItem,
  AdminCatalogItemSummary,
  AdminCatalogPage,
  AdminCatalogQuery,
  AdminLicense,
  CatalogMediaKind,
  CreateItem,
  UpdateItem,
} from '@nextlevel/shared';
import { getSystem } from '@nextlevel/system-catalog';
import { and, desc, eq, like, lt, or, type SQL } from 'drizzle-orm';
import { audited } from '../admin/audit.ts';
import type { ApiContext } from '../context.ts';
import { catalogFiles, catalogItems, catalogMedia, catalogScopes, licenses } from '../db/schema.ts';
import { apiError } from '../errors.ts';
import { itemOrNotFound, toAdminFile } from './files.ts';
import { publishBlockers } from './publish.ts';

// Catalog items for the console (api-spec Admin catalog, FR-ADM-3, FR-CAT-8): every change is
// audited with target type `item`.

type ItemRow = typeof catalogItems.$inferSelect;
type LicenseRow = typeof licenses.$inferSelect;

const scopeSlugOf = (ctx: ApiContext, scopeId: string) => ctx.scopes.byId(scopeId)?.slug ?? '';

export function toSummary(ctx: ApiContext, row: ItemRow): AdminCatalogItemSummary {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    systemId: row.systemId,
    scopeSlug: scopeSlugOf(ctx, row.scopeId),
    status: row.status,
    starter: row.starter,
    version: row.version,
    publishedAt: row.publishedAt,
    updatedAt: row.updatedAt,
  };
}

export function toAdminLicense(ctx: ApiContext, row: LicenseRow): AdminLicense {
  const verifier = row.verifiedBy ? ctx.users.byId(row.verifiedBy) : undefined;
  return {
    id: row.id,
    type: row.type,
    rightsHolder: row.rightsHolder,
    contact: row.contact,
    terms: row.terms,
    territories: row.territories ?? null,
    startsAt: row.startsAt,
    expiresAt: row.expiresAt,
    evidenceFilename: row.evidenceFilename,
    verifiedBy: verifier ? { id: verifier.id, email: verifier.email } : null,
    verifiedAt: row.verifiedAt,
  };
}

export function licenseOf(ctx: ApiContext, item: ItemRow): LicenseRow | undefined {
  if (!item.licenseId) return undefined;
  return ctx.db.select().from(licenses).where(eq(licenses.id, item.licenseId)).get();
}

/** The console's item detail, with what still blocks publishing. */
export function itemDetail(ctx: ApiContext, itemId: string): AdminCatalogItem {
  const row = itemOrNotFound(ctx, itemId);
  const license = licenseOf(ctx, row);
  const files = ctx.db.select().from(catalogFiles).where(eq(catalogFiles.itemId, itemId)).all();
  const media = ctx.db.select().from(catalogMedia).where(eq(catalogMedia.itemId, itemId)).all();
  return {
    ...toSummary(ctx, row),
    description: row.description,
    year: row.year,
    developer: row.developer,
    publisher: row.publisher,
    genre: row.genre,
    players: row.players,
    onLapse: row.onLapse,
    license: license ? toAdminLicense(ctx, license) : null,
    files: files.map(toAdminFile),
    media: media.map((m) => ({
      kind: m.kind as CatalogMediaKind,
      size: m.size,
      sha256: m.sha256,
      version: m.version,
    })),
    publishBlockers: publishBlockers(row, license, files, ctx.clock()),
    createdAt: row.createdAt,
  };
}

const cursorOf = (row: ItemRow) => Buffer.from(`${row.createdAt}|${row.id}`).toString('base64url');

function afterCursor(cursor: string | undefined): SQL | undefined {
  if (!cursor) return undefined;
  const [at, id] = Buffer.from(cursor, 'base64url').toString().split('|');
  if (!at || !id) throw apiError('VALIDATION_FAILED', 'Bad cursor.');
  return or(
    lt(catalogItems.createdAt, at),
    and(eq(catalogItems.createdAt, at), lt(catalogItems.id, id)),
  );
}

/** Newest first; `q` matches title or slug. */
export function listItems(ctx: ApiContext, query: AdminCatalogQuery): AdminCatalogPage {
  const scope = query.scope ? ctx.scopes.bySlug(query.scope) : undefined;
  if (query.scope && !scope) return { items: [], nextCursor: null };
  const pattern = query.q ? `%${query.q.replace(/[%_]/g, '')}%` : undefined;
  const filters = [
    query.status ? eq(catalogItems.status, query.status) : undefined,
    query.system ? eq(catalogItems.systemId, query.system) : undefined,
    scope ? eq(catalogItems.scopeId, scope.id) : undefined,
    pattern ? or(like(catalogItems.title, pattern), like(catalogItems.slug, pattern)) : undefined,
    afterCursor(query.cursor),
  ].filter((f): f is SQL => f !== undefined);
  const rows = ctx.db
    .select()
    .from(catalogItems)
    .where(filters.length > 0 ? and(...filters) : undefined)
    .orderBy(desc(catalogItems.createdAt), desc(catalogItems.id))
    .limit(query.limit + 1)
    .all();
  const page = rows.slice(0, query.limit);
  const last = page.at(-1);
  return {
    items: page.map((row) => toSummary(ctx, row)),
    nextCursor: rows.length > query.limit && last ? cursorOf(last) : null,
  };
}

function scopeIdOf(ctx: ApiContext, slug: string): string {
  const scope = ctx.db.select().from(catalogScopes).where(eq(catalogScopes.slug, slug)).get();
  if (!scope) throw apiError('VALIDATION_FAILED', 'Unknown scope.', { reason: 'scope' });
  return scope.id;
}

export function createItem(ctx: ApiContext, actorId: string, input: CreateItem): AdminCatalogItem {
  if (!getSystem(input.systemId)) {
    throw apiError('VALIDATION_FAILED', 'Unknown system.', { reason: 'system' });
  }
  const scopeId = scopeIdOf(ctx, input.scopeSlug);
  if (ctx.db.select().from(catalogItems).where(eq(catalogItems.slug, input.slug)).get()) {
    throw apiError('CONFLICT', 'This slug is taken.', { reason: 'slugTaken' });
  }
  const id = ctx.newId();
  const now = ctx.clock().toISOString();
  const row: ItemRow = {
    id,
    slug: input.slug,
    title: input.title,
    systemId: input.systemId,
    scopeId,
    description: '',
    year: null,
    developer: '',
    publisher: '',
    genre: '',
    players: null,
    licenseId: null,
    onLapse: null,
    status: 'draft',
    starter: false,
    publishedAt: null,
    version: 1,
    createdAt: now,
    updatedAt: now,
  };
  audited(
    ctx,
    actorId,
    [{ action: 'item.create', targetType: 'item', targetId: id, before: null, after: row }],
    () => {
      ctx.db.insert(catalogItems).values(row).run();
    },
  );
  return itemDetail(ctx, id);
}

export function updateItem(
  ctx: ApiContext,
  actorId: string,
  itemId: string,
  patch: UpdateItem,
): AdminCatalogItem {
  const before = itemOrNotFound(ctx, itemId);
  const { scopeSlug, ...fields } = patch;
  const defined = Object.fromEntries(
    Object.entries(fields).filter(([, value]) => value !== undefined),
  ) as Partial<ItemRow>;
  const changes: Partial<ItemRow> = {
    ...defined,
    ...(scopeSlug === undefined ? {} : { scopeId: scopeIdOf(ctx, scopeSlug) }),
    updatedAt: ctx.clock().toISOString(),
  };
  const after = { ...before, ...changes };
  audited(
    ctx,
    actorId,
    [{ action: 'item.update', targetType: 'item', targetId: itemId, before, after }],
    () => {
      ctx.db.update(catalogItems).set(changes).where(eq(catalogItems.id, itemId)).run();
    },
  );
  return itemDetail(ctx, itemId);
}

export function publishItem(ctx: ApiContext, actorId: string, itemId: string): AdminCatalogItem {
  const detail = itemDetail(ctx, itemId);
  if (detail.publishBlockers.length > 0) {
    throw apiError('CONFLICT', 'The item is not ready to publish.', {
      reason: 'blocked',
      blockers: detail.publishBlockers,
    });
  }
  if (detail.status === 'published') return detail;
  const now = ctx.clock().toISOString();
  setStatus(ctx, actorId, itemId, 'item.publish', { status: 'published', publishedAt: now }, null);
  return itemDetail(ctx, itemId);
}

export function unpublishItem(ctx: ApiContext, actorId: string, itemId: string): AdminCatalogItem {
  const row = itemOrNotFound(ctx, itemId);
  if (row.status === 'published') {
    setStatus(ctx, actorId, itemId, 'item.unpublish', { status: 'unpublished' }, null);
  }
  return itemDetail(ctx, itemId);
}

/**
 * Publish/unpublish with its audit entry; `actorId` null for the maintenance job, `reason` says
 * why a system action happened. Runs inside the caller's transaction when there is one.
 */
export function setStatus(
  ctx: ApiContext,
  actorId: string | null,
  itemId: string,
  action: 'item.publish' | 'item.unpublish',
  changes: Pick<Partial<ItemRow>, 'status' | 'publishedAt'>,
  reason: string | null,
): void {
  const before = itemOrNotFound(ctx, itemId);
  const at = ctx.clock().toISOString();
  audited(
    ctx,
    actorId,
    [
      {
        action,
        targetType: 'item',
        targetId: itemId,
        before: { status: before.status },
        after: { status: changes.status, ...(reason ? { reason } : {}) },
      },
    ],
    () => {
      ctx.db
        .update(catalogItems)
        .set({ ...changes, updatedAt: at })
        .where(eq(catalogItems.id, itemId))
        .run();
    },
  );
}
