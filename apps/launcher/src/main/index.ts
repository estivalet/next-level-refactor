import { app, BrowserWindow, dialog, ipcMain, shell } from 'electron';
import { existsSync } from 'node:fs';
import { stat } from 'node:fs/promises';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { defaultSettings } from '@nextlevel/shared';
import { emulatorPresets, getSystem, systemCatalog } from '@nextlevel/system-catalog';
import { path7za } from '7zip-bin';
import { v7 as uuidv7 } from 'uuid';
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
import { openLibrary } from './library/openLibrary.ts';
import { ScanService } from './scan/ScanService.ts';
import scanWorkerPath from './scan/scanWorker.ts?modulePath';
import { createWorkerWalker } from './scan/workerWalker.ts';
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

const emit = createEventSink(
  () =>
    BrowserWindow.getAllWindows()
      .map((window) => window.webContents)
      .filter((contents) => !contents.isDestroyed()),
  log,
);

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
  const scan = new ScanService({
    repo,
    settings,
    catalog: systemCatalog,
    createWalker: () => createWorkerWalker(scanWorkerPath),
    folderExists: (dir) =>
      stat(dir).then(
        (info) => info.isDirectory(),
        () => false,
      ),
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
  app.on('before-quit', () => {
    scan.cancel();
    db.$client.close();
  });
  return { repo, scan, games, collections, launches, launch };
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
    library: startLibrary(settings),
    clock: () => new Date(),
    emit,
    revealFile: (path) => {
      shell.showItemInFolder(path);
    },
    pathExists: existsSync,
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
