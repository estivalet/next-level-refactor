import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import Database from 'better-sqlite3';
import { drizzle, type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { seedAppSettings } from '../settings/AppSettingsRepository.ts';
import * as schema from './schema.ts';

export type ApiDb = BetterSQLite3Database<typeof schema> & { $client: Database.Database };

const MIGRATIONS = join(import.meta.dirname, 'migrations');

/** Migrations this build knows (Drizzle Kit's journal). */
function knownMigrations(): number {
  const journal = JSON.parse(readFileSync(join(MIGRATIONS, 'meta', '_journal.json'), 'utf8')) as {
    entries: unknown[];
  };
  return journal.entries.length;
}

function appliedMigrations(client: Database.Database): number {
  const table = client
    .prepare("select 1 from sqlite_master where type = 'table' and name = '__drizzle_migrations'")
    .get();
  if (!table) return 0;
  return client.prepare('select count(*) from __drizzle_migrations').pluck().get() as number;
}

/**
 * Opens the service database, applies pending migrations and seeds the Default plan (D21) and
 * the app settings defaults. A database migrated by a newer API is refused, never touched.
 */
export function openDb(file: string): ApiDb {
  const client = new Database(file);
  try {
    client.pragma('journal_mode = WAL');
    client.pragma('foreign_keys = ON');
    if (appliedMigrations(client) > knownMigrations()) {
      throw new Error(`${file} was written by a newer NextLevel API; refusing to open it`);
    }
    const db = drizzle(client, { schema });
    migrate(db, { migrationsFolder: MIGRATIONS });
    db.insert(schema.plans)
      .values({
        id: 'plan-default',
        slug: 'default',
        name: 'Default',
        deviceLimit: 3,
        scopeIds: [],
        createdAt: new Date().toISOString(),
      })
      .onConflictDoNothing({ target: schema.plans.slug })
      .run();
    seedAppSettings(db);
    return db;
  } catch (error) {
    client.close();
    throw error;
  }
}
