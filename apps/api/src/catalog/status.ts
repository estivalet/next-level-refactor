import type { InstallStatus, InstallStatusRequest } from '@nextlevel/shared';
import { inArray } from 'drizzle-orm';
import type { ApiContext } from '../context.ts';
import { catalogItems } from '../db/schema.ts';
import { visibleRows, type CatalogCaller } from './visible.ts';

// Install status (FR-CAT-7, D42, D43): the launcher sends what it installed; each item is
// `current`, `update` (a newer version is published) or `gone` (unpublished, license expired,
// out of the player's scopes, or unknown) with the item's on_lapse rule — `keep` when unknown.

export function installStatus(
  ctx: ApiContext,
  caller: CatalogCaller,
  request: InstallStatusRequest,
): InstallStatus {
  const ids = [...new Set(request.items.map((item) => item.id))];
  if (ids.length === 0) return { items: [] };
  const visible = new Map(
    visibleRows(ctx, caller.entitlement.scopes, [inArray(catalogItems.id, ids)]).map((row) => [
      row.id,
      row,
    ]),
  );
  const lapse = new Map(
    ctx.db
      .select({ id: catalogItems.id, onLapse: catalogItems.onLapse })
      .from(catalogItems)
      .where(inArray(catalogItems.id, ids))
      .all()
      .map((row) => [row.id, row.onLapse ?? 'keep']),
  );
  return {
    items: request.items.map(({ id, version }) => {
      const row = visible.get(id);
      if (!row) return { id, state: 'gone', version: null, onLapse: lapse.get(id) ?? 'keep' };
      return {
        id,
        state: row.version > version ? 'update' : 'current',
        version: row.version,
        onLapse: row.onLapse ?? 'keep',
      };
    }),
  };
}
