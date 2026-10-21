import {
  ERROR_CODES,
  SettingsSchema,
  changedPaths,
  defaultSettings,
  err,
  ok,
  type BackupInfo,
  type Result,
  type Settings,
  type SettingsLoad,
  type SettingsSnapshot,
} from '@nextlevel/shared';
import { readFile, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { atomicWrite } from '../fs/atomicWrite.ts';
import { backupCreatedAt, createBackup, listBackupIds, pruneBackups } from './backups.ts';
import { migrate } from './migrate.ts';

/** Larger files are rejected before parsing; real settings files are a few KB. */
const MAX_IMPORT_BYTES = 1024 * 1024;
const EXPORT_NAME = 'nextlevel-settings.json';

type ImportResult = { status: 'cancelled' } | { status: 'imported'; snapshot: SettingsSnapshot };

export interface SettingsDeps {
  dir: string;
  clock: () => Date;
  log: { warn(context: object, msg: string): void };
  dialogs: {
    pickExportPath(defaultName: string): Promise<string | null>;
    pickImportPath(): Promise<string | null>;
  };
}

type Invalid = Extract<SettingsLoad, { kind: 'invalid' }>;

const exists = (path: string) =>
  stat(path).then(
    () => true,
    () => false,
  );

/** Parses settings file text; never throws. */
export function parseSettings(
  text: string,
): { kind: 'ok'; settings: Settings } | { kind: 'invalid'; reason: Invalid['reason'] } {
  let raw: unknown;
  try {
    // Notepad and PowerShell 5 write UTF-8 with a byte-order mark; JSON.parse rejects it.
    raw = JSON.parse(text.charCodeAt(0) === 0xfeff ? text.slice(1) : text);
  } catch {
    return { kind: 'invalid', reason: 'unreadable' };
  }
  const migrated = migrate(raw);
  if (migrated.kind === 'newerVersion') return { kind: 'invalid', reason: 'newerVersion' };
  const parsed = SettingsSchema.safeParse(migrated.value);
  return parsed.success
    ? { kind: 'ok', settings: parsed.data }
    : { kind: 'invalid', reason: 'invalid' };
}

/**
 * Owns `settings.json` (data model §2.2): loads, validates, saves atomically with a backup of the
 * previous file, and rejects stale saves through an in-memory revision.
 */
export class SettingsService {
  readonly paths: { settings: string; backups: string };
  protected state: SettingsLoad = {
    kind: 'ok',
    snapshot: { settings: defaultSettings(), revision: 0 },
  };
  protected revision = 0;
  private queue: Promise<unknown> = Promise.resolve();

  constructor(protected readonly deps: SettingsDeps) {
    this.paths = { settings: join(deps.dir, 'settings.json'), backups: join(deps.dir, 'backups') };
  }

  get(): SettingsLoad {
    return this.state;
  }

  async load(): Promise<SettingsLoad> {
    let text: string;
    try {
      text = await readFile(this.paths.settings, 'utf8');
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return this.setOk(defaultSettings());
      // Locked, a folder, no permission…: show recovery rather than exiting.
      this.deps.log.warn({ error }, 'settings file could not be read');
      return this.setInvalid('unreadable');
    }
    const parsed = parseSettings(text);
    if (parsed.kind === 'ok') return this.setOk(parsed.settings);
    this.deps.log.warn({ reason: parsed.reason }, 'settings file is not usable');
    return this.setInvalid(parsed.reason);
  }

  save(settings: Settings, baseRevision: number): Promise<Result<SettingsSnapshot>> {
    return this.exclusive(() => this.saveNow(settings, baseRevision));
  }

  private async saveNow(
    settings: Settings,
    baseRevision: number,
  ): Promise<Result<SettingsSnapshot>> {
    if (this.state.kind === 'invalid') {
      return err('INVALID_SETTINGS', ERROR_CODES.INVALID_SETTINGS, { reason: 'file is invalid' });
    }
    if (baseRevision !== this.revision) return err('CONFLICT', ERROR_CODES.CONFLICT);
    const parsed = SettingsSchema.safeParse(settings);
    if (!parsed.success) {
      return err('INVALID_SETTINGS', ERROR_CODES.INVALID_SETTINGS, parsed.error.issues);
    }
    return ok(await this.write(parsed.data));
  }

  reset(): Promise<SettingsSnapshot> {
    return this.exclusive(() => this.write(defaultSettings()));
  }

  /** Backups newest first, each with what the next newer state changed (US-D3). */
  async listBackups(): Promise<BackupInfo[]> {
    const ids = await listBackupIds(this.paths.backups);
    const newest = this.state.kind === 'ok' ? this.state.snapshot.settings : null;
    const infos: BackupInfo[] = [];
    let newer: Settings | null = newest;
    for (const id of ids) {
      const file = join(this.paths.backups, id);
      const [text, info] = await Promise.all([readFile(file, 'utf8'), stat(file)]);
      const parsed = parseSettings(text);
      const settings = parsed.kind === 'ok' ? parsed.settings : null;
      const changes = settings && newer ? changedPaths(settings, newer) : [];
      infos.push({ id, createdAt: backupCreatedAt(id), size: info.size, changes });
      newer = settings;
    }
    return infos;
  }

  /** Restores a backup by id; the current file is backed up first. Works from the invalid state. */
  restore(id: string): Promise<Result<SettingsSnapshot>> {
    return this.exclusive(() => this.restoreNow(id));
  }

  private async restoreNow(id: string): Promise<Result<SettingsSnapshot>> {
    // Only ids that exist in the backups folder are accepted, so no path can escape it.
    if (!(await listBackupIds(this.paths.backups)).includes(id)) {
      return err('NOT_FOUND', ERROR_CODES.NOT_FOUND);
    }
    // Read before writing: the write's own backup may prune the very file being restored.
    const parsed = parseSettings(await readFile(join(this.paths.backups, id), 'utf8'));
    if (parsed.kind === 'invalid') {
      return err('INVALID_SETTINGS', ERROR_CODES.INVALID_SETTINGS, { reason: parsed.reason });
    }
    return ok(await this.write(parsed.settings));
  }

  /** Writes the current settings to a file the user picks (FR-SET-4). */
  async exportTo(): Promise<Result<{ status: 'saved' | 'cancelled' }>> {
    if (this.state.kind !== 'ok') return err('INVALID_SETTINGS', ERROR_CODES.INVALID_SETTINGS);
    const path = await this.deps.dialogs.pickExportPath(EXPORT_NAME);
    if (!path) return ok({ status: 'cancelled' });
    await atomicWrite(path, `${JSON.stringify(this.state.snapshot.settings, null, 2)}\n`);
    return ok({ status: 'saved' });
  }

  /** Replaces the settings with a file the user picks, validated like a load (FR-SET-4). */
  async importFrom(): Promise<Result<ImportResult>> {
    const path = await this.deps.dialogs.pickImportPath();
    if (!path) return ok({ status: 'cancelled' });
    return this.exclusive(() => this.importNow(path));
  }

  private async importNow(path: string): Promise<Result<ImportResult>> {
    if ((await stat(path)).size > MAX_IMPORT_BYTES) {
      return err('INVALID_SETTINGS', ERROR_CODES.INVALID_SETTINGS, { reason: 'tooLarge' });
    }
    const parsed = parseSettings(await readFile(path, 'utf8'));
    if (parsed.kind === 'invalid') {
      return err('INVALID_SETTINGS', ERROR_CODES.INVALID_SETTINGS, { reason: parsed.reason });
    }
    return ok({ status: 'imported', snapshot: await this.write(parsed.settings) });
  }

  /** Backs up the current file (if any), writes `settings`, prunes backups, bumps the revision. */
  protected async write(settings: Settings): Promise<SettingsSnapshot> {
    if (await exists(this.paths.settings)) {
      await createBackup(this.paths.backups, this.paths.settings, this.deps.clock());
    }
    await atomicWrite(this.paths.settings, `${JSON.stringify(settings, null, 2)}\n`);
    await pruneBackups(this.paths.backups);
    this.revision += 1;
    return this.setOk(settings).snapshot;
  }

  /** Enters the invalid state, pointing at the newest backup that is itself usable. */
  private async setInvalid(reason: Invalid['reason']): Promise<SettingsLoad> {
    let latestBackupId: string | null = null;
    for (const id of await listBackupIds(this.paths.backups)) {
      const text = await readFile(join(this.paths.backups, id), 'utf8').catch(() => '');
      if (parseSettings(text).kind === 'ok') {
        latestBackupId = id;
        break;
      }
    }
    this.state = { kind: 'invalid', reason, latestBackupId };
    return this.state;
  }

  /** Runs writes one at a time so the revision check and the file stay consistent. */
  private exclusive<T>(task: () => Promise<T>): Promise<T> {
    const run = this.queue.then(task, task);
    this.queue = run.catch(() => undefined);
    return run;
  }

  private setOk(settings: Settings): Extract<SettingsLoad, { kind: 'ok' }> {
    const state = { kind: 'ok' as const, snapshot: { settings, revision: this.revision } };
    this.state = state;
    return state;
  }
}
