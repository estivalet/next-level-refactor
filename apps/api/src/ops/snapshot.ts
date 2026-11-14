import { existsSync } from 'node:fs';
import type Database from 'better-sqlite3';

/**
 * Before this API migrates an existing database (D56): a full copy at
 * `<db>.pre-<version>.bak`, taken with `VACUUM INTO` (consistent, works while open). A brand-new
 * database (nothing applied) has nothing to keep; a copy for this version already there (a start
 * that failed after taking it) is kept as it is. Answers the file written, or null.
 */
export function snapshotBeforeMigrate(
  client: Database.Database,
  file: string,
  migrations: { applied: number; known: number },
  version: string,
): string | null {
  if (migrations.applied === 0 || migrations.applied >= migrations.known) return null;
  const target = `${file}.pre-${version}.bak`;
  if (existsSync(target)) return null;
  client.prepare('vacuum into ?').run(target);
  return target;
}
