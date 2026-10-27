import { copyFile, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { defaultAppSettings } from '@nextlevel/shared';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { afterEach, describe, expect, it } from 'vitest';
import { loadAppSettings } from '../settings/AppSettingsRepository.ts';
import { openDb } from './open.ts';

const dirs: string[] = [];
afterEach(async () => {
  for (const dir of dirs.splice(0)) {
    await rm(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 });
  }
});

async function file(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), 'nextlevel-api-db-'));
  dirs.push(dir);
  return join(dir, 'api.db');
}

describe('service database (data model §5, ADR-007)', () => {
  it('opening twice migrates once and seeds the Default plan and settings once (D21)', async () => {
    const path = await file();
    openDb(path).$client.close();
    const db = openDb(path);
    const plans = db.$client
      .prepare('select slug, name, device_limit as deviceLimit from plans')
      .all();
    expect(plans).toEqual([{ slug: 'default', name: 'Default', deviceLimit: 3 }]);
    expect(loadAppSettings(db)).toEqual(defaultAppSettings());
    db.$client.close();
  });

  it('a database from migration 0000 migrates and keeps the Default plan (M8)', async () => {
    const path = await file();
    const first = await mkdtemp(join(tmpdir(), 'nextlevel-api-m0-'));
    dirs.push(first);
    const migrations = join(import.meta.dirname, 'migrations');
    await mkdir(join(first, 'meta'));
    await copyFile(join(migrations, '0000_init.sql'), join(first, '0000_init.sql'));
    const journal = JSON.parse(
      await readFile(join(migrations, 'meta', '_journal.json'), 'utf8'),
    ) as {
      entries: unknown[];
    };
    await writeFile(
      join(first, 'meta', '_journal.json'),
      JSON.stringify({ ...journal, entries: journal.entries.slice(0, 1) }),
    );
    const client = new Database(path);
    migrate(drizzle(client), { migrationsFolder: first });
    client
      .prepare(
        `insert into plans (id, slug, name, device_limit, scope_ids)
         values ('plan-default', 'default', 'Default', 3, '[]')`,
      )
      .run();
    client.close();

    const db = openDb(path);
    const plans = db.$client.prepare('select slug, created_at as createdAt from plans').all() as {
      slug: string;
      createdAt: string;
    }[];
    expect(plans).toHaveLength(1);
    expect(plans[0]?.slug).toBe('default');
    expect(Number.isNaN(Date.parse(plans[0]?.createdAt ?? ''))).toBe(false);
    const tables = db.$client
      .prepare("select name from sqlite_master where type = 'table' order by name")
      .pluck()
      .all();
    expect(tables).toEqual(
      expect.arrayContaining(['catalog_scopes', 'subscriptions', 'stripe_events']),
    );
    db.$client.close();
  });

  it('a database written by a newer API is refused', async () => {
    const path = await file();
    const db = openDb(path);
    db.$client
      .prepare('insert into __drizzle_migrations (hash, created_at) values (?, ?)')
      .run('from-the-future', Date.now());
    db.$client.close();
    expect(() => openDb(path)).toThrow(/newer/);
  });

  it('foreign keys are enforced', async () => {
    const db = openDb(await file());
    expect(() =>
      db.$client
        .prepare(
          `insert into devices (id, user_id, name, platform, app_version, created_at, last_seen_at)
           values ('d', 'missing', 'n', 'win32', '1', 'x', 'x')`,
        )
        .run(),
    ).toThrow(/FOREIGN KEY/);
    db.$client.close();
  });
});
