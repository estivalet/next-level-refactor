import {
  AppErrorException,
  ERROR_CODES,
  type EmulatorPreset,
  type SystemDefinition,
  type AppPathKey,
  type Result,
  type ScraperAccount,
  type ScraperSystem,
  type SettingsSnapshot,
  uiScaleFactor,
} from '@nextlevel/shared';
import { mkdir } from 'node:fs/promises';
import type { EmitEvent } from './ipc/events.ts';
import type { IpcHandlers } from './ipc/router.ts';
import type { LaunchService } from './launch/LaunchService.ts';
import type { ArtIndexService } from './frontend/ArtIndexService.ts';
import type { FrontendService } from './frontend/FrontendService.ts';
import { createFrontendHandlers } from './frontendHandlers.ts';
import { createLaunchHandlers } from './launchHandlers.ts';
import type { CollectionRepository } from './library/CollectionRepository.ts';
import type { GameRepository } from './library/GameRepository.ts';
import type { LaunchRepository } from './library/LaunchRepository.ts';
import type { LibraryRepository } from './library/LibraryRepository.ts';
import type { MediaRepository } from './library/MediaRepository.ts';
import type { SmartFilterRepository } from './library/SmartFilterRepository.ts';
import type { MenuRepository } from './menus/MenuRepository.ts';
import { createLibraryHandlers } from './libraryHandlers.ts';
import { createSmartFilterHandlers } from './library/smartFilterHandlers.ts';
import { createCredentialHandlers } from './scraper/credentialHandlers.ts';
import { createBatchHandlers } from './scraper/batch/batchHandlers.ts';
import type { BatchScrapeService } from './scraper/batch/BatchScrapeService.ts';
import { createAuthHandlers, type AuthApi } from './auth/authHandlers.ts';
import {
  createCatalogHandlers,
  UNAVAILABLE_CATALOG,
  type CatalogApi,
} from './catalog/catalogHandlers.ts';
import { createScrapeHandlers } from './scraper/scrapeHandlers.ts';
import type { ScrapeService } from './scraper/ScrapeService.ts';
import type { SecretsLike } from './secrets/SecretStore.ts';
import { createMenuHandlers } from './menus/menuHandlers.ts';
import { createImportHandlers } from './import/importHandlers.ts';
import type { ImportService } from './import/ImportService.ts';
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
  /** Sets the launcher window's zoom factor (FR-SET-8). */
  setUiScale: (factor: number) => void;
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
    menus: MenuRepository;
    smartFilters: SmartFilterRepository;
    importer: ImportService;
    scrape: Pick<ScrapeService, 'search' | 'preview' | 'apply' | 'thumbnail'>;
    batch: Pick<BatchScrapeService, 'begin' | 'pause' | 'resume' | 'cancel' | 'status'>;
  } | null;
  /** Theme art lists (FR-THM-2); works without the library. */
  artIndex: Pick<ArtIndexService, 'index'>;
  clock: () => Date;
  emit: EmitEvent;
  /** Shows a file (or folder) selected in the OS file manager. */
  revealFile: (path: string) => void;
  pathExists: (path: string) => boolean;
  /** UUIDv7 for menus and menu nodes. */
  newId: () => string;
  /** OS-encrypted secrets (`secrets.bin`, FR-SCR-3). */
  secrets: SecretsLike;
  /** Settings → Scraper → Test: one ScreenScraper request with the stored credentials. */
  scraperAccount: () => Promise<ScraperAccount>;
  /** ScreenScraper's system list (cached 30 days unless `refresh`). */
  scraperSystems: (opts: { refresh?: boolean | undefined }) => Promise<ScraperSystem[]>;
  /** Sign-in and the entitlement (FR-AUTH-*); `DISABLED_AUTH` when sign-in is off. */
  auth: AuthApi;
  /** Catalog games and downloads (FR-CAT-*); unavailable until it is wired (M9e). */
  gameCatalog?: CatalogApi;
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

  // Settings that affect the OS or the window are applied after every successful write.
  const applied = (snapshot: SettingsSnapshot): SettingsSnapshot => {
    deps.setOpenAtLogin(snapshot.settings.general.startWithWindows);
    deps.setUiScale(uiScaleFactor(snapshot.settings.general.uiScale));
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
    ...createSmartFilterHandlers({ smartFilters: () => library().smartFilters, emit: deps.emit }),
    ...createMenuHandlers({
      menus: () => library().menus,
      generatedDraft: () => library().frontend.generatedDraft(deps.newId),
      newId: deps.newId,
      emit: deps.emit,
    }),
    ...createImportHandlers({
      importer: () => library().importer,
      folderExists: (dir) => Promise.resolve(deps.pathExists(dir)),
    }),
    ...createFrontendHandlers({
      frontend: () => library().frontend,
      artIndex: deps.artIndex,
      // A write only when the theme changed: each write keeps a settings backup.
      rememberTheme: async (themeId) => {
        const current = settings.get();
        if (current.kind === 'ok' && current.snapshot.settings.themes.lastUsed === themeId) return;
        unwrap(
          await settings.update((next) => ({
            ...next,
            themes: { ...next.themes, lastUsed: themeId },
          })),
        );
      },
    }),
    ...createCredentialHandlers({ secrets: deps.secrets, account: deps.scraperAccount }),
    ...createBatchHandlers({ batch: () => library().batch }),
    ...createAuthHandlers(deps.auth),
    ...createCatalogHandlers(deps.gameCatalog ?? UNAVAILABLE_CATALOG),
    ...createScrapeHandlers({
      service: () => library().scrape,
      systems: deps.scraperSystems,
      updateSettings: async (change) => {
        unwrap(await settings.update(change));
      },
      systemExists: (systemId) => deps.catalog().some((system) => system.id === systemId),
    }),
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
        review: counts.get(system.id)?.review ?? 0,
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
