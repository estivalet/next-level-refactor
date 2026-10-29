import type {
  CatalogItem,
  CatalogItemSummary,
  CatalogMediaKind,
  CatalogPage,
  CatalogQuery,
  Entitlement,
} from '@nextlevel/shared';
import { and, asc, desc, eq, gt, inArray, isNull, like, or, sql, type SQL } from 'drizzle-orm';
import type { FastifyRequest } from 'fastify';
import { entitlementOf } from '../auth/session.ts';
import type { ApiContext } from '../context.ts';
import { catalogFiles, catalogItems, catalogMedia, catalogScopes, licenses } from '../db/schema.ts';
import { apiError } from '../errors.ts';
import { signFileToken } from '../storage/tokens.ts';

// What a subscriber may see (FR-CAT-2, C8): published items whose scope is in their entitlement
// and whose license hasn't expired. Nothing is cached, so a plan or publish change shows on the
// next request (US-F1, US-F4). An item outside that set is NOT_FOUND, never a hint it exists.

export const MEDIA_URL_MS = 60 * 60 * 1000;

export interface CatalogCaller {
  userId: string;
  deviceId: string;
  entitlement: Entitlement;
}

/** The launcher calling: needs access (`none` → SUBSCRIPTION_REQUIRED, suspended → SUSPENDED). */
export function catalogCaller(ctx: ApiContext, request: FastifyRequest): CatalogCaller {
  const auth = request.device;
  const user = auth ? ctx.users.byId(auth.userId) : undefined;
  if (!auth || !user) throw apiError('UNAUTHENTICATED');
  const entitlement = entitlementOf(ctx, user);
  if (entitlement.status === 'suspended') throw apiError('SUSPENDED');
  if (entitlement.status === 'none') throw apiError('SUBSCRIPTION_REQUIRED');
  return { userId: auth.userId, deviceId: auth.deviceId, entitlement };
}

type Row = typeof catalogItems.$inferSelect & {
  scope: string;
  licenseType: (typeof licenses.$inferSelect)['type'];
  rightsHolder: string;
  terms: string;
};

/** Visible items, optionally narrowed; empty scopes see nothing. */
export function visibleRows(
  ctx: ApiContext,
  scopes: readonly string[],
  extra: SQL[] = [],
  limit?: number,
  /** Default: title order. */
  order?: SQL[],
): Row[] {
  if (scopes.length === 0) return [];
  const now = ctx.clock().toISOString();
  return ctx.db
    .select({
      item: catalogItems,
      scope: catalogScopes.slug,
      licenseType: licenses.type,
      rightsHolder: licenses.rightsHolder,
      terms: licenses.terms,
    })
    .from(catalogItems)
    .innerJoin(catalogScopes, eq(catalogScopes.id, catalogItems.scopeId))
    .innerJoin(licenses, eq(licenses.id, catalogItems.licenseId))
    .where(
      and(
        eq(catalogItems.status, 'published'),
        inArray(catalogScopes.slug, [...scopes]),
        or(isNull(licenses.expiresAt), gt(licenses.expiresAt, now)),
        ...extra,
      ),
    )
    .orderBy(...(order ?? [asc(catalogItems.title), asc(catalogItems.id)]))
    .limit(limit ?? -1)
    .all()
    .map(({ item, ...rest }) => ({ ...item, ...rest }));
}

export function visibleItem(ctx: ApiContext, caller: CatalogCaller, itemId: string): Row {
  const row = visibleRows(ctx, caller.entitlement.scopes, [eq(catalogItems.id, itemId)])[0];
  if (!row) throw apiError('NOT_FOUND');
  return row;
}

const mediaUrl = (ctx: ApiContext, caller: CatalogCaller, itemId: string, kind: string) =>
  `${ctx.env.publicUrl}/v1/files/${
    signFileToken(ctx, {
      kind: 'media',
      id: `${itemId}/${kind}`,
      userId: caller.userId,
      deviceId: caller.deviceId,
      ttlMs: MEDIA_URL_MS,
    }).token
  }`;

const readyFiles = (ctx: ApiContext, itemId: string) =>
  ctx.db
    .select()
    .from(catalogFiles)
    .where(and(eq(catalogFiles.itemId, itemId), eq(catalogFiles.status, 'ready')))
    .all();

function toSummary(ctx: ApiContext, caller: CatalogCaller, row: Row): CatalogItemSummary {
  const box = ctx.db
    .select({ kind: catalogMedia.kind })
    .from(catalogMedia)
    .where(and(eq(catalogMedia.itemId, row.id), eq(catalogMedia.kind, 'box-front')))
    .get();
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    systemId: row.systemId,
    scope: row.scope,
    year: row.year,
    genre: row.genre,
    size: readyFiles(ctx, row.id).reduce((sum, file) => sum + file.size, 0),
    license: { type: row.licenseType, rightsHolder: row.rightsHolder },
    starter: row.starter,
    version: row.version,
    publishedAt: row.publishedAt,
    boxArt: box ? mediaUrl(ctx, caller, row.id, 'box-front') : null,
  };
}

export function toCatalogItem(ctx: ApiContext, caller: CatalogCaller, row: Row): CatalogItem {
  const media = ctx.db.select().from(catalogMedia).where(eq(catalogMedia.itemId, row.id)).all();
  return {
    ...toSummary(ctx, caller, row),
    description: row.description,
    developer: row.developer,
    publisher: row.publisher,
    players: row.players,
    files: readyFiles(ctx, row.id).map((file) => ({
      id: file.id,
      filename: file.filename,
      size: file.size,
      sha256: file.sha256,
      role: file.role,
    })),
    media: media.map((m) => ({
      kind: m.kind as CatalogMediaKind,
      url: mediaUrl(ctx, caller, row.id, m.kind),
    })),
    license: { type: row.licenseType, rightsHolder: row.rightsHolder, terms: row.terms },
  };
}

const cursorOf = (row: Row) => Buffer.from(`${row.title}\u0000${row.id}`).toString('base64url');

function afterCursor(cursor: string | undefined): SQL | undefined {
  if (!cursor) return undefined;
  const [title, id] = Buffer.from(cursor, 'base64url').toString().split('\u0000');
  if (title === undefined || !id) throw apiError('VALIDATION_FAILED', 'Bad cursor.');
  return or(
    gt(catalogItems.title, title),
    and(eq(catalogItems.title, title), gt(catalogItems.id, id)),
  );
}

/** A page in title order (`q`: title or developer, any case), or newest first with `sort=new`. */
export function catalogPage(
  ctx: ApiContext,
  caller: CatalogCaller,
  query: CatalogQuery,
): CatalogPage {
  const scopes = query.scope
    ? caller.entitlement.scopes.filter((scope) => scope === query.scope)
    : caller.entitlement.scopes;
  const pattern = query.q ? `%${query.q.replace(/[%_]/g, '')}%` : undefined;
  const newest = query.sort === 'new';
  const extra = [
    query.system ? eq(catalogItems.systemId, query.system) : undefined,
    query.genre ? sql`lower(${catalogItems.genre}) = ${query.genre.toLowerCase()}` : undefined,
    query.starter === 'true' ? eq(catalogItems.starter, true) : undefined,
    pattern
      ? or(like(catalogItems.title, pattern), like(catalogItems.developer, pattern))
      : undefined,
    newest ? undefined : afterCursor(query.cursor),
  ].filter((f): f is SQL => f !== undefined);
  const rows = visibleRows(
    ctx,
    scopes,
    extra,
    query.limit + 1,
    newest ? [desc(catalogItems.publishedAt), desc(catalogItems.id)] : undefined,
  );
  const page = rows.slice(0, query.limit);
  const last = page.at(-1);
  return {
    items: page.map((row) => toSummary(ctx, caller, row)),
    nextCursor: !newest && rows.length > query.limit && last ? cursorOf(last) : null,
  };
}
