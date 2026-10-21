import {
  ERROR_CODES,
  SettingsSchema,
  defaultSettings,
  err,
  ok,
  type Result,
  type Settings,
  type SettingsLoad,
  type SettingsSnapshot,
} from '@nextlevel/shared';
import { readFile, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { atomicWrite } from '../fs/atomicWrite.ts';
import { createBackup, listBackupIds, pruneBackups } from './backups.ts';
import { migrate } from './migrate.ts';

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
    raw = JSON.parse(text);
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
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
      return this.setOk(defaultSettings());
    }
    const parsed = parseSettings(text);
    if (parsed.kind === 'ok') return this.setOk(parsed.settings);
    const [latestBackupId = null] = await listBackupIds(this.paths.backups);
    this.deps.log.warn({ reason: parsed.reason }, 'settings file is not usable');
    this.state = { kind: 'invalid', reason: parsed.reason, latestBackupId };
    return this.state;
  }

  async save(settings: Settings, baseRevision: number): Promise<Result<SettingsSnapshot>> {
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

  async reset(): Promise<SettingsSnapshot> {
    return this.write(defaultSettings());
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

  private setOk(settings: Settings): Extract<SettingsLoad, { kind: 'ok' }> {
    const state = { kind: 'ok' as const, snapshot: { settings, revision: this.revision } };
    this.state = state;
    return state;
  }
}
