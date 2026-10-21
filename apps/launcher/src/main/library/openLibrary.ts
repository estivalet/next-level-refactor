import Database from 'better-sqlite3';
import { drizzle, type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { migrate, migrations as bundledMigrations, type Migration } from './migrate.ts';
import * as schema from './schema.ts';

export type LibraryDb = BetterSQLite3Database<typeof schema> & { $client: Database.Database };

export interface OpenLibraryOptions {
  backupsDir: string;
  clock: () => Date;
  /** Tests only: a different migration list. */
  migrations?: readonly Migration[];
}

/** Opens (creating or migrating) `library.db` with WAL and foreign keys (ADR-003). */
export function openLibrary(file: string, options: OpenLibraryOptions): LibraryDb {
  const client = new Database(file);
  try {
    client.pragma('journal_mode = WAL');
    client.pragma('foreign_keys = ON');
    client.pragma('busy_timeout = 5000');
    migrate(client, options.migrations ?? bundledMigrations(), (fromVersion) => {
      mkdirSync(options.backupsDir, { recursive: true });
      const stamp = options.clock().toISOString().replace(/[:.]/g, '-');
      const target = join(options.backupsDir, `library-${stamp}-v${String(fromVersion)}.db`);
      // VACUUM INTO writes a consistent copy synchronously (db.backup() is async).
      client.prepare('vacuum into ?').run(target);
    });
  } catch (error) {
    client.close();
    throw error;
  }
  return drizzle(client, { schema });
}
