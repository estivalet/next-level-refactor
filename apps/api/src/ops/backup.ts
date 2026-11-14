import { randomUUID } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { rm } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { Readable } from 'node:stream';
import { fileURLToPath } from 'node:url';
import { createGzip } from 'node:zlib';
import Database from 'better-sqlite3';
import { fileStoreFor } from '../context.ts';
import { S3Store } from '../storage/S3Store.ts';
import { loadEnv } from '../env.ts';
import type { FileStore } from '../storage/FileStore.ts';

// The daily database backup (D56): `node apps/api/src/ops/backup.ts` once, or `--daily` (the
// compose `backup` service) at 03:00 UTC every day. Backups go to the file store (R2 in
// production) under `backups/`, which the orphan sweep never touches.

const KEEP_DAYS = 30;
/** The first of each month is kept this long (deployment §4). */
const KEEP_MONTHLY_DAYS = 365;
const DAY_MS = 24 * 3600_000;
/** A backup is never refused for size (the database is far below this). */
const LIMIT = 64 * 1024 ** 3;
const BACKUP_KEY = /^backups\/(\d{4}-\d{2}-\d{2})\.db\.gz$/;

export interface BackupResult {
  key: string;
  size: number;
  sha256: string;
}

/**
 * An online SQLite backup of `databaseFile` (consistent while the API writes), gzipped to
 * `backups/<date>.db.gz`, then `backups/heartbeat.json` (when and what), then backups older than
 * 30 days go. The temp copy next to the database is always removed.
 */
export async function runBackup(o: {
  databaseFile: string;
  store: FileStore;
  clock: () => Date;
}): Promise<BackupResult> {
  const now = o.clock();
  const temp = `${o.databaseFile}.backup-${randomUUID()}`;
  const key = `backups/${now.toISOString().slice(0, 10)}.db.gz`;
  try {
    const source = new Database(o.databaseFile, { readonly: true, fileMustExist: true });
    try {
      await source.backup(temp);
    } finally {
      source.close();
    }
    const stored = await o.store.put(key, createReadStream(temp).pipe(createGzip()), LIMIT);
    const heartbeat = { at: now.toISOString(), key, ...stored };
    await o.store.put('backups/heartbeat.json', Readable.from([JSON.stringify(heartbeat)]), 1024);
    await prune(o.store, now);
    return { key, ...stored };
  } finally {
    await rm(temp, { force: true });
  }
}

async function prune(store: FileStore, now: Date): Promise<void> {
  const daily = now.getTime() - KEEP_DAYS * DAY_MS;
  const monthly = now.getTime() - KEEP_MONTHLY_DAYS * DAY_MS;
  for await (const file of store.list('backups/')) {
    const day = BACKUP_KEY.exec(file.key)?.[1];
    if (day === undefined) continue;
    const at = Date.parse(`${day}T00:00:00.000Z`);
    if (at < (day.endsWith('-01') ? monthly : daily)) await store.delete(file.key);
  }
}

/** Milliseconds from `now` until the next `hour`:00 UTC (a full day when it is that time now). */
export function msUntilNext(hour: number, now: Date): number {
  const next = new Date(now);
  next.setUTCHours(hour, 0, 0, 0);
  if (next.getTime() <= now.getTime()) next.setTime(next.getTime() + DAY_MS);
  return next.getTime() - now.getTime();
}

async function main(): Promise<void> {
  const env = loadEnv(process.env);
  const run = async () => {
    try {
      const result = await runBackup({
        databaseFile: env.databaseFile,
        store: env.backupStore
          ? new S3Store({ ...env.backupStore, tempDir: dirname(env.databaseFile) })
          : fileStoreFor(env),
        clock: () => new Date(),
      });
      console.log(JSON.stringify({ msg: 'backup written', key: result.key, size: result.size }));
    } catch (error) {
      const code = (error as { code?: unknown }).code;
      console.error(
        JSON.stringify({ msg: 'backup failed', code: typeof code === 'string' ? code : null }),
      );
      if (!process.argv.includes('--daily')) process.exitCode = 1;
    }
  };
  if (!process.argv.includes('--daily')) {
    await run();
    return;
  }
  for (;;) {
    await new Promise((done) => setTimeout(done, msUntilNext(3, new Date())));
    await run();
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  void main();
}
