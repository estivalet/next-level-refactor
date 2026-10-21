import {
  AppErrorException,
  type AppPathKey,
  type Result,
  type SettingsSnapshot,
} from '@nextlevel/shared';
import { mkdir } from 'node:fs/promises';
import type { IpcHandlers } from './ipc/router.ts';
import type { SettingsService } from './settings/SettingsService.ts';

export interface MainDeps {
  settings: SettingsService;
  appVersion: () => string;
  quit: () => void;
  paths: { data: string; logs: string };
  /** Opens a folder in the OS; resolves an error message, or '' on success (Electron's shell). */
  openPath: (path: string) => Promise<string>;
  setOpenAtLogin: (enabled: boolean) => void;
  log: { warn(context: object, msg: string): void };
}

function unwrap<T>(result: Result<T>): T {
  if (!result.ok) throw new AppErrorException(result.error);
  return result.value;
}

/** Every IPC channel's main-process implementation. */
export function createHandlers(deps: MainDeps): IpcHandlers {
  const { settings } = deps;
  const folders = (): Record<AppPathKey, string> => ({
    data: deps.paths.data,
    backups: settings.paths.backups,
    logs: deps.paths.logs,
  });

  // Settings that affect the OS are applied after every successful write.
  const applied = (snapshot: SettingsSnapshot): SettingsSnapshot => {
    deps.setOpenAtLogin(snapshot.settings.general.startWithWindows);
    return snapshot;
  };

  return {
    'app.version': () => deps.appVersion(),
    'app.quit': () => {
      deps.quit();
    },
    'app.paths': () => ({ ...folders(), settings: settings.paths.settings }),
    'app.openPath': async ({ key }) => {
      const path = folders()[key];
      // The backups and logs folders only appear after the first backup or log line.
      await mkdir(path, { recursive: true });
      const failure = await deps.openPath(path);
      if (failure) deps.log.warn({ key, path, failure }, 'could not open folder');
    },
    // Replaced by the catalog and folder picker in M2a Task 4.
    'app.pickFolder': () => null,
    'systems.catalog': () => [],
    'settings.get': () => settings.get(),
    'settings.save': async ({ settings: next, baseRevision }) =>
      applied(unwrap(await settings.save(next, baseRevision))),
    'settings.reset': async () => applied(await settings.reset()),
    'settings.backups.list': () => settings.listBackups(),
    'settings.backups.restore': async ({ id }) => applied(unwrap(await settings.restore(id))),
    'settings.export': async () => unwrap(await settings.exportTo()),
    'settings.import': async () => {
      const result = unwrap(await settings.importFrom());
      if (result.status === 'imported') applied(result.snapshot);
      return result;
    },
  };
}
