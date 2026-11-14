import { copyFile, mkdir, mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { afterEach, describe, expect, it } from 'vitest';
import pkg from '../../package.json' with { type: 'json' };
import { openDb } from '../db/open.ts';

const dirs: string[] = [];
afterEach(async () => {
  for (const dir of dirs.splice(0)) {
    await rm(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 });
  }
});

async function folder(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), 'nextlevel-api-snap-'));
  dirs.push(dir);
  return dir;
}

/** A database at migration 0000, as an older API left it. */
async function olderDatabase(dir: string): Promise<string> {
  const migrations = join(import.meta.dirname, '..', 'db', 'migrations');
  const first = join(dir, 'first');
  await mkdir(join(first, 'meta'), { recursive: true });
  await copyFile(join(migrations, '0000_init.sql'), join(first, '0000_init.sql'));
  const journal = JSON.parse(await readFile(join(migrations, 'meta', '_journal.json'), 'utf8')) as {
    entries: unknown[];
  };
  await writeFile(
    join(first, 'meta', '_journal.json'),
    JSON.stringify({ ...journal, entries: journal.entries.slice(0, 1) }),
  );
  const path = join(dir, 'nextlevel.db');
  const client = new Database(path);
  migrate(drizzle(client), { migrationsFolder: first });
  client
    .prepare(
      "insert into users (id, google_sub, email, name, role, status, created_at) values ('u1', 'g1', 'a@example.test', 'A', 'subscriber', 'active', '2026-01-01T00:00:00.000Z')",
    )
    .run();
  client.close();
  return path;
}

describe('snapshot before migrations (D56, deployment runbook)', () => {
  it('snapshot: pending migrations → <db>.pre-<version>.bak written before migrate; none → no file', async () => {
    const dir = await folder();
    const path = await olderDatabase(dir);
    openDb(path).$client.close();
    const snapshot = `${path}.pre-${pkg.version}.bak`;
    // The snapshot is the database as it was: migration 0000 only, with its rows.
    const old = new Database(snapshot, { readonly: true });
    expect(old.prepare('select count(*) from __drizzle_migrations').pluck().get()).toBe(1);
    expect(old.prepare('select email from users').pluck().get()).toBe('a@example.test');
    old.close();
    // Opening again: nothing pending, no new file.
    const before = await readdir(dir);
    openDb(path).$client.close();
    expect(await readdir(dir)).toEqual(before);
    // Three database passes (build at 0000, migrate with the snapshot, open again): ~11 s on CI.
  }, 30_000);

  it('a brand-new database has nothing to keep: no snapshot', async () => {
    const dir = await folder();
    openDb(join(dir, 'nextlevel.db')).$client.close();
    expect((await readdir(dir)).filter((name) => name.endsWith('.bak'))).toEqual([]);
  });
});
