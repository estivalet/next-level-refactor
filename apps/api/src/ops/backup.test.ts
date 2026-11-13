import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Readable } from 'node:stream';
import { buffer, text } from 'node:stream/consumers';
import { gunzipSync } from 'node:zlib';
import Database from 'better-sqlite3';
import { afterEach, describe, expect, it } from 'vitest';
import { openDb } from '../db/open.ts';
import { LocalDiskStore } from '../storage/LocalDiskStore.ts';
import { msUntilNext, runBackup } from './backup.ts';

const dirs: string[] = [];
afterEach(async () => {
  for (const dir of dirs.splice(0)) {
    await rm(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 });
  }
});

async function setup() {
  const dir = await mkdtemp(join(tmpdir(), 'nextlevel-backup-'));
  dirs.push(dir);
  const databaseFile = join(dir, 'nextlevel.db');
  const db = openDb(databaseFile);
  db.$client
    .prepare(
      `insert into users (id, google_sub, email, name, role, status, created_at)
       values ('u1', 'g1', 'a@example.test', 'A', 'subscriber', 'active', '2026-01-01T00:00:00.000Z')`,
    )
    .run();
  db.$client.close();
  return { dir, databaseFile, store: new LocalDiskStore(join(dir, 'files')) };
}

describe('daily backup (D56, deployment runbook)', () => {
  it('backup: writes a gzip of sqlite .backup to the backup store key backups/<date>.db.gz and a heartbeat', async () => {
    const t = await setup();
    const result = await runBackup({
      databaseFile: t.databaseFile,
      store: t.store,
      clock: () => new Date('2026-11-14T03:00:00.000Z'),
    });
    expect(result.key).toBe('backups/2026-11-14.db.gz');
    const restored = join(t.dir, 'restored.db');
    await writeFile(restored, gunzipSync(await buffer(await t.store.open(result.key))));
    const copy = new Database(restored, { readonly: true });
    expect(copy.prepare('select email from users').pluck().get()).toBe('a@example.test');
    copy.close();
    const heartbeat = JSON.parse(
      await text(await t.store.open('backups/heartbeat.json')),
    ) as unknown;
    expect(heartbeat).toEqual({
      at: '2026-11-14T03:00:00.000Z',
      key: 'backups/2026-11-14.db.gz',
      size: result.size,
      sha256: result.sha256,
    });
  });

  it('keeps 30 days of backups and leaves no temp copy behind', async () => {
    const t = await setup();
    await t.store.put('backups/2026-10-01.db.gz', Readable.from(['old']), 1024);
    await t.store.put('backups/2026-10-20.db.gz', Readable.from(['recent']), 1024);
    await runBackup({
      databaseFile: t.databaseFile,
      store: t.store,
      clock: () => new Date('2026-11-14T03:00:00.000Z'),
    });
    expect(await t.store.size('backups/2026-10-01.db.gz')).toBeNull();
    expect(await t.store.size('backups/2026-10-20.db.gz')).not.toBeNull();
    const { readdir } = await import('node:fs/promises');
    expect((await readdir(t.dir)).filter((name) => name.includes('backup-'))).toEqual([]);
  });

  it('the daily loop waits until the next 03:00 UTC', () => {
    expect(msUntilNext(3, new Date('2026-11-14T01:00:00.000Z'))).toBe(2 * 3600_000);
    expect(msUntilNext(3, new Date('2026-11-14T03:00:00.000Z'))).toBe(24 * 3600_000);
    expect(msUntilNext(3, new Date('2026-11-14T22:30:00.000Z'))).toBe(4.5 * 3600_000);
  });
});
