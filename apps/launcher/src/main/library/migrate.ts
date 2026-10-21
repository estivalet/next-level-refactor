import { AppErrorException, ERROR_CODES } from '@nextlevel/shared';
import type Database from 'better-sqlite3';

export interface Migration {
  version: number;
  sql: string;
}

const sqlFiles = import.meta.glob<string>('./migrations/*.sql', {
  query: '?raw',
  import: 'default',
  eager: true,
});

/** The Drizzle Kit migrations bundled with the app, oldest first; version n is the nth file. */
export function migrations(): Migration[] {
  return Object.keys(sqlFiles)
    .sort()
    .map((file, index) => ({ version: index + 1, sql: sqlFiles[file] ?? '' }));
}

function currentVersion(client: Database.Database): number {
  const hasMeta = client
    .prepare("select 1 from sqlite_master where type = 'table' and name = 'meta'")
    .get();
  if (!hasMeta) return 0;
  const value = client
    .prepare("select value from meta where key = 'schema_version'")
    .pluck()
    .get() as string | undefined;
  return value === undefined ? 0 : Number(value);
}

/**
 * Brings the library to the latest version in one transaction (NFR-REL-1). An existing library is
 * backed up before the first change; one written by a newer app is refused.
 */
export function migrate(
  client: Database.Database,
  list: readonly Migration[],
  backup: (fromVersion: number) => void,
): { from: number; to: number } {
  const from = currentVersion(client);
  const to = list.length;
  if (from > to) {
    throw new AppErrorException({
      code: 'LIBRARY_UNAVAILABLE',
      message: ERROR_CODES.LIBRARY_UNAVAILABLE,
      details: { reason: 'newerVersion' },
    });
  }
  const pending = list.filter((migration) => migration.version > from);
  if (pending.length === 0) return { from, to: from };
  if (from > 0) backup(from);

  client.transaction(() => {
    for (const migration of pending) {
      for (const statement of migration.sql.split('--> statement-breakpoint')) {
        if (statement.trim()) client.exec(statement);
      }
    }
    client.exec('create table if not exists meta (key text primary key, value text not null)');
    client
      .prepare("insert or replace into meta (key, value) values ('schema_version', ?)")
      .run(String(to));
  })();
  return { from, to };
}
