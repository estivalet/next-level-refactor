import { app, BrowserWindow, dialog, ipcMain, protocol, safeStorage, shell } from 'electron';
import { existsSync } from 'node:fs';
import { stat } from 'node:fs/promises';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { defaultSettings } from '@nextlevel/shared';
import { emulatorPresets, getSystem, systemCatalog } from '@nextlevel/system-catalog';
import { path7za } from '7zip-bin';
import { v7 as uuidv7 } from 'uuid';
import { seedBuiltInSmartFilters } from './library/builtInSmartFilters.ts';
import { SmartFilterRepository } from './library/SmartFilterRepository.ts';
import { MenuRepository } from './menus/MenuRepository.ts';
import { ImportService } from './import/ImportService.ts';
import { detectEmulators } from './launch/detect.ts';
import { ImportRepository } from './library/ImportRepository.ts';
import { listBackupIds } from './settings/backups.ts';
import { createHandlers, type MainDeps } from './handlers.ts';
import { createEventSink } from './ipc/events.ts';
import { registerIpcRouter } from './ipc/register.ts';
import { createIpcRouter } from './ipc/router.ts';
import { sevenZipExtractor } from './launch/archives.ts';
import { LaunchService } from './launch/LaunchService.ts';
import { spawnProcess } from './launch/spawnProcess.ts';
import { initLogger, logger as log } from './log.ts';
import { externalUrlAllowed, isAllowedNavigation } from './navigation.ts';
import { CollectionRepository } from './library/CollectionRepository.ts';
import { expectedGamePath } from './library/expectedPath.ts';
import { GameRepository } from './library/GameRepository.ts';
import { LaunchRepository } from './library/LaunchRepository.ts';
import { LibraryRepository } from './library/LibraryRepository.ts';
import { MediaRepository } from './library/MediaRepository.ts';
import { openLibrary } from './library/openLibrary.ts';
import { ArtIndexService } from './frontend/ArtIndexService.ts';
import { FrontendService } from './frontend/FrontendService.ts';
import { createMenuWatch } from './menus/menuWatch.ts';
import { createNextlevelHandler, NEXTLEVEL_SCHEME } from './protocol/register.ts';
import { ScanService } from './scan/ScanService.ts';
import scanWorkerPath from './scan/scanWorker.ts?modulePath';
import { createWorkerWalker } from './scan/workerWalker.ts';
import { accountOf, createScraperClient } from './scraper/runtime.ts';
import { SCREENSCRAPER_URL } from './scraper/screenscraper/client.ts';
import { SecretStore } from './secrets/SecretStore.ts';
import { SettingsService } from './settings/SettingsService.ts';
import { userDataPath } from './userData.ts';

app.setPath(
  'userData',
  userDataPath({
    appData: app.getPath('appData'),
    isPackaged: app.isPackaged,
    override: process.env['NEXTLEVEL_USER_DATA'],
  }),
);
const dataDir = app.getPath('userData');
// Must happen before the app is ready (FR-THM-6).
protocol.registerSchemesAsPrivileged([NEXTLEVEL_SCHEME]);
const logsDir = join(dataDir, 'logs');
initLogger(logsDir);

const devServerUrl = app.isPackaged ? undefined : process.env['ELECTRON_RENDERER_URL'];
const rendererPage = join(import.meta.dirname, '../renderer/index.html');
const rendererPageUrl = pathToFileURL(rendererPage).href;
const JSON_FILES = [{ name: 'JSON', extensions: ['json'] }];

function openExternally(url: string): void {
  if (externalUrlAllowed(url)) {
    shell.openExternal(url).catch((error: unknown) => {
      log.error({ url, error }, 'could not open external URL');
    });
  }
}

function setOpenAtLogin(openAtLogin: boolean): void {
  // In development this would register electron.exe itself, so it only applies when packaged.
  if (app.isPackaged) app.setLoginItemSettings({ openAtLogin });
  else log.info({ openAtLogin }, 'start with Windows skipped in development');
}

function createWindow(): BrowserWindow {
  const window = new BrowserWindow({
    width: 1280,
    height: 800,
    title: 'NextLevel',
    webPreferences: {
      preload: join(import.meta.dirname, '../preload/index.cjs'),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
      webSecurity: true,
    },
  });

  // Security doc §3: no remote content in app windows; https links go to the system browser.
  window.webContents.setWindowOpenHandler(({ url }) => {
    openExternally(url);
    return { action: 'deny' };
  });
  window.webContents.on('will-navigate', (event, url) => {
    if (isAllowedNavigation(url, devServerUrl, rendererPageUrl)) return;
    event.preventDefault();
    openExternally(url);
  });

  const loading = devServerUrl ? window.loadURL(devServerUrl) : window.loadFile(rendererPage);
  loading.catch((error: unknown) => {
    log.error({ error }, 'could not load the renderer');
  });
  return window;
}

let mainWindow: BrowserWindow | null = null;

/** The launcher window while a game runs (owner decision D4): minimized, then restored. */
const launcherWindow = {
  minimize: () => {
    mainWindow?.minimize();
  },
  restore: () => {
    if (!mainWindow || mainWindow.isDestroyed()) return;
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  },
};

const currentSettings = (settings: SettingsService) => {
  const loaded = settings.get();
  return loaded.kind === 'ok' ? loaded.snapshot.settings : defaultSettings();
};

// menus.changed also goes out when a game or settings change alters what the menu can show.
const menuWatch = createMenuWatch(
  createEventSink(
    () =>
      BrowserWindow.getAllWindows()
        .map((window) => window.webContents)
        .filter((contents) => !contents.isDestroyed()),
    log,
  ),
  log,
);
const emit = menuWatch.emit;

/** Opens `library.db`; without it the app still runs and library channels fail (M2b). */
function startLibrary(settings: SettingsService): MainDeps['library'] {
  let db: ReturnType<typeof openLibrary>;
  try {
    db = openLibrary(join(dataDir, 'library.db'), {
      backupsDir: join(dataDir, 'backups'),
      clock: () => new Date(),
    });
  } catch (error) {
    log.error({ error }, 'library could not be opened');
    return null;
  }
  const repo = new LibraryRepository(db);
  const media = new MediaRepository(db);
  const folderExists = (dir: string) =>
    stat(dir).then(
      (info) => info.isDirectory(),
      () => false,
    );
  const scan = new ScanService({
    repo,
    media,
    settings,
    catalog: systemCatalog,
    createWalker: () => createWorkerWalker(scanWorkerPath),
    folderExists,
    clock: () => new Date(),
    emit,
    log,
    newId: uuidv7,
  });
  // Paths follow the current settings, so a changed folder name or location applies at once.
  const games = new GameRepository(db, (row) => {
    const loaded = settings.get();
    return expectedGamePath({
      settings: loaded.kind === 'ok' ? loaded.snapshot.settings : defaultSettings(),
      system: systemCatalog().find((system) => system.id === row.systemId),
      ...row,
    });
  });
  const collections = new CollectionRepository(db, () => new Date());
  const launches = new LaunchRepository(db);
  const launch = new LaunchService({
    settings: () => currentSettings(settings),
    system: getSystem,
    launches,
    spawn: spawnProcess,
    exists: existsSync,
    clock: () => new Date(),
    emit,
    window: launcherWindow,
    // ADR-014: packaged builds run 7za.exe from outside the asar archive.
    extractor: sevenZipExtractor(path7za.replace('app.asar', 'app.asar.unpacked')),
    tempDir: app.getPath('temp'),
    baseEnv: process.env,
    log,
  });
  launch.cleanupStaleExtractions().catch((error: unknown) => {
    log.warn({ error }, 'could not remove old extraction folders');
  });
  // will-quit: after before-quit has let pending settings writes finish (start()).
  app.on('will-quit', () => {
    scan.cancel();
    db.$client.close();
  });
  const menus = new MenuRepository(db, () => new Date(), uuidv7);
  const smartFilters = new SmartFilterRepository(db, () => new Date());
  try {
    seedBuiltInSmartFilters(smartFilters, currentSettings(settings).general.language);
  } catch (error) {
    log.warn({ error }, 'could not create the built-in smart filters');
  }
  const frontend = new FrontendService({
    db,
    catalog: systemCatalog,
    settings: () => currentSettings(settings),
    collections,
    menus,
    smartFilters,
  });
  menuWatch.watch(() => frontend.menuFingerprint());
  const importer = new ImportService({
    catalog: systemCatalog(),
    presets: emulatorPresets(),
    settings,
    scan,
    repo: new ImportRepository(db),
    menus,
    emit,
    clock: () => new Date(),
    newId: uuidv7,
    detect: (folder) => detectEmulators(folder, emulatorPresets()),
    createWalker: () => createWorkerWalker(scanWorkerPath),
    folderExists,
    latestBackupId: async () => (await listBackupIds(settings.paths.backups))[0] ?? null,
  });
  return {
    repo,
    media,
    frontend,
    scan,
    games,
    collections,
    launches,
    launch,
    menus,
    smartFilters,
    importer,
  };
}

async function start(): Promise<void> {
  const settings = new SettingsService({
    dir: dataDir,
    clock: () => new Date(),
    log,
    onChanged: (snapshot) => {
      emit('settings.changed', snapshot);
    },
    dialogs: {
      pickExportPath: async (defaultName) => {
        const window = BrowserWindow.getFocusedWindow();
        const options = { defaultPath: defaultName, filters: JSON_FILES };
        const result = await (window
          ? dialog.showSaveDialog(window, options)
          : dialog.showSaveDialog(options));
        return result.canceled || !result.filePath ? null : result.filePath;
      },
      pickImportPath: async () => {
        const window = BrowserWindow.getFocusedWindow();
        const options = { filters: JSON_FILES, properties: ['openFile' as const] };
        const result = await (window
          ? dialog.showOpenDialog(window, options)
          : dialog.showOpenDialog(options));
        return result.canceled ? null : (result.filePaths[0] ?? null);
      },
    },
  });
  await settings.load();
  // A theme switch right before quitting must still be remembered (FR-THM-5).
  let settingsSettled = false;
  app.on('before-quit', (event) => {
    if (settingsSettled) return;
    event.preventDefault();
    // Capped, so a stuck disk can't keep the app from quitting.
    const capped = new Promise<void>((resolve) => setTimeout(resolve, 3000));
    void Promise.race([settings.idle(), capped]).finally(() => {
      settingsSettled = true;
      app.quit();
    });
  });
  const library = startLibrary(settings);
  const artPaths = () => {
    const { assetsPath, themesPath } = currentSettings(settings).storage;
    return { assetsPath, themesPath };
  };
  protocol.handle(
    'nextlevel',
    createNextlevelHandler({
      mediaPath: (gameId, kind) => library?.media.path(gameId, kind) ?? null,
      paths: artPaths,
    }),
  );

  const secrets = new SecretStore(
    join(dataDir, 'secrets.bin'),
    {
      available: () => safeStorage.isAsyncEncryptionAvailable(),
      encrypt: (text) => safeStorage.encryptStringAsync(text),
      decrypt: async (data) => {
        const { result, shouldReEncrypt } = await safeStorage.decryptStringAsync(data);
        return { text: result, reEncrypt: shouldReEncrypt };
      },
    },
    log,
  );
  // e2e points the client at a local fake ScreenScraper; packaged builds never read the variable.
  const scraperUrl = app.isPackaged ? undefined : process.env['NEXTLEVEL_SCREENSCRAPER_URL'];
  const scraper = createScraperClient({
    fetch: (input, init) => fetch(input, init),
    secrets,
    cacheFile: join(dataDir, 'scraper-cache.sqlite'),
    baseUrl: scraperUrl ?? SCREENSCRAPER_URL,
    log,
  });
  app.on('will-quit', () => {
    scraper.cache.close();
  });

  const handlers = createHandlers({
    settings,
    appVersion: () => app.getVersion(),
    quit: () => {
      app.quit();
    },
    paths: { data: dataDir, logs: logsDir },
    openPath: (path) => shell.openPath(path),
    setOpenAtLogin,
    log,
    catalog: systemCatalog,
    library,
    artIndex: new ArtIndexService({ paths: artPaths }),
    clock: () => new Date(),
    emit,
    revealFile: (path) => {
      shell.showItemInFolder(path);
    },
    pathExists: existsSync,
    newId: uuidv7,
    secrets,
    scraperAccount: () => accountOf(scraper.client, scraper.quota),
    presets: emulatorPresets,
    pickFile: async (title) => {
      const e2eFile = app.isPackaged ? undefined : process.env['NEXTLEVEL_E2E_PICK_FILE'];
      if (e2eFile) return e2eFile;
      const window = BrowserWindow.getFocusedWindow();
      const options = {
        properties: ['openFile' as const],
        filters: [{ name: 'Programs', extensions: ['exe'] }],
        ...(title ? { title } : {}),
      };
      const result = await (window
        ? dialog.showOpenDialog(window, options)
        : dialog.showOpenDialog(options));
      return result.canceled ? null : (result.filePaths[0] ?? null);
    },
    pickFolder: async (title) => {
      // End-to-end tests can't drive the native dialog; development builds only.
      const e2eFolder = app.isPackaged ? undefined : process.env['NEXTLEVEL_E2E_PICK_FOLDER'];
      if (e2eFolder) return e2eFolder;
      const window = BrowserWindow.getFocusedWindow();
      const options = { properties: ['openDirectory' as const], ...(title ? { title } : {}) };
      const result = await (window
        ? dialog.showOpenDialog(window, options)
        : dialog.showOpenDialog(options));
      return result.canceled ? null : (result.filePaths[0] ?? null);
    },
  });
  registerIpcRouter(ipcMain, createIpcRouter(handlers, log));
  mainWindow = createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) mainWindow = createWindow();
  });
}

app
  .whenReady()
  .then(start)
  .catch((error: unknown) => {
    log.error({ error }, 'launcher failed to start');
    app.exit(1);
  });

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
