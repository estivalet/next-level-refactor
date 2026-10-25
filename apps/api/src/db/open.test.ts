import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { defaultAppSettings } from '@nextlevel/shared';
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
