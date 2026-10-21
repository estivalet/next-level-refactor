import {
  AppErrorException,
  ERROR_CODES,
  type SystemDefinition,
  type AppPathKey,
  type Result,
  type SettingsSnapshot,
} from '@nextlevel/shared';
import { mkdir } from 'node:fs/promises';
import type { IpcHandlers } from './ipc/router.ts';
import type { LibraryRepository } from './library/LibraryRepository.ts';
import type { ScanService } from './scan/ScanService.ts';
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
  catalog: () => readonly SystemDefinition[];
  /** Native folder dialog; null when cancelled. */
  pickFolder: (title?: string) => Promise<string | null>;
  /** null when `library.db` could not be opened; library channels then fail. */
  library: { repo: LibraryRepository; scan: ScanService } | null;
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

  const library = () => {
    if (!deps.library) {
      throw new AppErrorException({
        code: 'LIBRARY_UNAVAILABLE',
        message: ERROR_CODES.LIBRARY_UNAVAILABLE,
      });
    }
    return deps.library;
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
    'app.pickFolder': ({ title }) => deps.pickFolder(title),
    'systems.catalog': () => [...deps.catalog()],
    'systems.list': () => {
      const counts = new Map(
        library()
          .repo.systemCounts()
          .map((row) => [row.systemId, row]),
      );
      const loaded = settings.get();
      const own = loaded.kind === 'ok' ? loaded.snapshot.settings.systems : {};
      return deps.catalog().map((system) => ({
        id: system.id,
        enabled: own[system.id]?.enabled ?? false,
        games: counts.get(system.id)?.games ?? 0,
        missing: counts.get(system.id)?.missing ?? 0,
      }));
    },
    'scan.start': ({ systemIds }) => library().scan.start(systemIds),
    'scan.cancel': () => library().scan.cancel(),
    'scan.status': () => library().scan.status(),
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
