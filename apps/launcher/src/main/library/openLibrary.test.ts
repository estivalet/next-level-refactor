import { AppErrorException } from '@nextlevel/shared';
import Database from 'better-sqlite3';
import { readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { migrations } from './migrate.ts';
import { openLibrary } from './openLibrary.ts';
import { tempDir } from './testing.ts';

const clock = () => new Date(Date.UTC(2026, 9, 21, 12, 0, 0));
const cleanups: Array<() => Promise<void>> = [];
afterEach(async () => {
  for (const cleanup of cleanups.splice(0)) await cleanup();
});

async function folder() {
  const temp = await tempDir();
  cleanups.push(temp.cleanup);
  return temp.dir;
}

describe('openLibrary', () => {
  it('NFR-REL-1: a new library is created at the latest schema version with WAL', async () => {
    const dir = await folder();
    const db = openLibrary(join(dir, 'library.db'), { backupsDir: join(dir, 'backups'), clock });
    const client = db.$client;
    expect(
      client.prepare("select value from meta where key = 'schema_version'").pluck().get(),
    ).toBe(String(migrations().length));
    expect(client.pragma('journal_mode', { simple: true })).toBe('wal');
    expect(client.pragma('foreign_keys', { simple: true })).toBe(1);
    client.close();
    expect(await readdir(dir)).not.toContain('backups');
  });

  it('NFR-REL-1: migrating an existing library backs the file up first', async () => {
    const dir = await folder();
    const file = join(dir, 'library.db');
    const backupsDir = join(dir, 'backups');
    const first = openLibrary(file, { backupsDir, clock });
    first.$client
      .prepare(
        "insert into games (system_id, rel_path, size, mtime, added_at) values (?, ?, 1, 1, 'x')",
      )
      .run('nintendo-64', 'Game.zip');
    first.$client.close();

    const next = [
      ...migrations(),
      { version: migrations().length + 1, sql: 'create table extra (x integer);' },
    ];
    const second = openLibrary(file, { backupsDir, clock, migrations: next });
    second.$client.close();

    const backups = await readdir(backupsDir);
    expect(backups).toEqual([
      `library-2026-10-21T12-00-00-000Z-v${String(migrations().length)}.db`,
    ]);
    const copy = new Database(join(backupsDir, backups[0] ?? ''));
    expect(copy.prepare('select rel_path from games').pluck().all()).toEqual(['Game.zip']);
    copy.close();
  });

  it('NFR-REL-1: a library from a newer app version is refused and left untouched', async () => {
    const dir = await folder();
    const file = join(dir, 'library.db');
    const raw = new Database(file);
    raw.exec('create table meta (key text primary key, value text not null)');
    raw.exec("insert into meta values ('schema_version', '999')");
    raw.close();

    let thrown: unknown;
    try {
      openLibrary(file, { backupsDir: join(dir, 'backups'), clock });
    } catch (error) {
      thrown = error;
    }
    expect(thrown).toBeInstanceOf(AppErrorException);
    expect((thrown as AppErrorException).error).toMatchObject({
      code: 'LIBRARY_UNAVAILABLE',
      details: { reason: 'newerVersion' },
    });
    const check = new Database(file);
    expect(check.prepare("select value from meta where key = 'schema_version'").pluck().get()).toBe(
      '999',
    );
    check.close();
  });
});
