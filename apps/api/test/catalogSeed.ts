import type { ApiDb } from '../src/db/open.ts';

const AT = '2026-10-25T12:00:00.000Z';

/**
 * A catalog item straight in the database, for tests of routes that need one before the item
 * routes are used (its scope is created when missing). Answers the item id.
 */
export function seedItem(
  db: ApiDb,
  opts: {
    id?: string;
    slug?: string;
    systemId?: string;
    scopeSlug?: string;
    status?: 'draft' | 'published' | 'unpublished';
    version?: number;
  } = {},
): string {
  const id = opts.id ?? 'item-1';
  const scopeSlug = opts.scopeSlug ?? 'homebrew-8bit';
  const scopeId = `scope-${scopeSlug}`;
  db.$client
    .prepare(
      `insert or ignore into catalog_scopes (id, slug, name, description, created_at)
       values (?, ?, ?, '', ?)`,
    )
    .run(scopeId, scopeSlug, scopeSlug, AT);
  db.$client
    .prepare(
      `insert into catalog_items (id, slug, title, system_id, scope_id, status, version,
         published_at, created_at, updated_at) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      id,
      opts.slug ?? id,
      `Title of ${id}`,
      opts.systemId ?? 'nintendo-nes',
      scopeId,
      opts.status ?? 'draft',
      opts.version ?? 1,
      // A published item always has a first publish time.
      (opts.status ?? 'draft') === 'published' ? AT : null,
      AT,
      AT,
    );
  return id;
}
