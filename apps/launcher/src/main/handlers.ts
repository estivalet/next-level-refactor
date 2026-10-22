import {
  AppErrorException,
  ERROR_CODES,
  type EmulatorPreset,
  type SystemDefinition,
  type AppPathKey,
  type Result,
  type SettingsSnapshot,
} from '@nextlevel/shared';
import { mkdir } from 'node:fs/promises';
import type { EmitEvent } from './ipc/events.ts';
import type { IpcHandlers } from './ipc/router.ts';
import type { LaunchService } from './launch/LaunchService.ts';
import type { FrontendService } from './frontend/FrontendService.ts';
import { createFrontendHandlers } from './frontendHandlers.ts';
import { createLaunchHandlers } from './launchHandlers.ts';
import type { CollectionRepository } from './library/CollectionRepository.ts';
import type { GameRepository } from './library/GameRepository.ts';
import type { LaunchRepository } from './library/LaunchRepository.ts';
import type { LibraryRepository } from './library/LibraryRepository.ts';
import type { MediaRepository } from './library/MediaRepository.ts';
import { createLibraryHandlers } from './libraryHandlers.ts';
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
  /** Native file dialog for an emulator executable; null when cancelled. */
  pickFile: (title?: string) => Promise<string | null>;
  presets: () => readonly EmulatorPreset[];
  /** null when `library.db` could not be opened; library channels then fail. */
  library: {
    repo: LibraryRepository;
    media: MediaRepository;
    frontend: FrontendService;
    scan: ScanService;
    games: GameRepository;
    collections: CollectionRepository;
    launches: LaunchRepository;
    launch: LaunchService;
  } | null;
  clock: () => Date;
  emit: EmitEvent;
  /** Shows a file (or folder) selected in the OS file manager. */
  revealFile: (path: string) => void;
  pathExists: (path: string) => boolean;
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
    ...createLibraryHandlers(deps),
    ...createFrontendHandlers({ frontend: () => library().frontend }),
    ...createLaunchHandlers({
      launch: () => {
        const { launch, launches } = library();
        return { service: launch, launches };
      },
      emit: deps.emit,
      presets: deps.presets,
      pickFile: deps.pickFile,
    }),
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
