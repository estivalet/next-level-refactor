import { copyFile, mkdir, readdir, rm } from 'node:fs/promises';
import { join } from 'node:path';

export const MAX_BACKUPS = 10;
const BACKUP_NAME = /^settings-(\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}Z)(?:-(\d+))?\.json$/;

function sortKey(id: string): string {
  const match = BACKUP_NAME.exec(id);
  return match ? `${match[1] ?? ''}#${(match[2] ?? '0').padStart(6, '0')}` : '';
}

/** The ISO time a backup was taken, recovered from its id. */
export function backupCreatedAt(id: string): string {
  const stamp = BACKUP_NAME.exec(id)?.[1] ?? '';
  const [date = '', time = ''] = stamp.split('T');
  const [h, m, s, ms] = time.replace('Z', '').split('-');
  return `${date}T${h ?? '00'}:${m ?? '00'}:${s ?? '00'}.${ms ?? '000'}Z`;
}

/** Backup ids (file names) in `dir`, newest first. Files that don't look like backups are ignored. */
export async function listBackupIds(dir: string): Promise<string[]> {
  const names = await readdir(dir).catch(() => [] as string[]);
  return names
    .filter((name) => BACKUP_NAME.test(name))
    .sort((a, b) => sortKey(b).localeCompare(sortKey(a)));
}

/** Copies `file` into `dir` as `settings-<stamp>.json`, never overwriting an existing backup. */
export async function createBackup(dir: string, file: string, now: Date): Promise<string> {
  await mkdir(dir, { recursive: true });
  const stamp = now.toISOString().replace(/[:.]/g, '-');
  const existing = new Set(await listBackupIds(dir));
  let id = `settings-${stamp}.json`;
  for (let n = 1; existing.has(id); n += 1) id = `settings-${stamp}-${String(n)}.json`;
  await copyFile(file, join(dir, id));
  return id;
}

/** Deletes all but the newest `MAX_BACKUPS` backups. */
export async function pruneBackups(dir: string): Promise<void> {
  const ids = await listBackupIds(dir);
  await Promise.all(ids.slice(MAX_BACKUPS).map((id) => rm(join(dir, id), { force: true })));
}
