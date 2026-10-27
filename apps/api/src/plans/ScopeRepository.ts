import type { CatalogScope } from '@nextlevel/shared';
import { asc, eq } from 'drizzle-orm';
import type { ApiDb } from '../db/open.ts';
import { catalogScopes } from '../db/schema.ts';

export type ScopeRow = typeof catalogScopes.$inferSelect;

/** The `catalog_scopes` table (data model §5, D37): plans pick them, M9 items use them. */
export class ScopeRepository {
  readonly #db: ApiDb;

  constructor(db: ApiDb) {
    this.#db = db;
  }

  list(): ScopeRow[] {
    return this.#db.select().from(catalogScopes).orderBy(asc(catalogScopes.slug)).all();
  }

  byId(id: string): ScopeRow | undefined {
    return this.#db.select().from(catalogScopes).where(eq(catalogScopes.id, id)).get();
  }

  bySlug(slug: string): ScopeRow | undefined {
    return this.#db.select().from(catalogScopes).where(eq(catalogScopes.slug, slug)).get();
  }

  insert(row: ScopeRow): void {
    this.#db.insert(catalogScopes).values(row).run();
  }

  update(id: string, patch: Partial<Omit<ScopeRow, 'id' | 'slug' | 'createdAt'>>): void {
    this.#db.update(catalogScopes).set(patch).where(eq(catalogScopes.id, id)).run();
  }
}

export function toCatalogScope(row: ScopeRow): CatalogScope {
  return { id: row.id, slug: row.slug, name: row.name, description: row.description };
}
