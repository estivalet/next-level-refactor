import { app, BrowserWindow, dialog, ipcMain, protocol, safeStorage, shell } from 'electron';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { emulatorPresets, systemCatalog } from '@nextlevel/system-catalog';
import { v7 as uuidv7 } from 'uuid';
import { createAuth } from './auth/startAuth.ts';
import { createHandlers } from './handlers.ts';
import { createEventSink } from './ipc/events.ts';
import { registerIpcRouter } from './ipc/register.ts';
import { createIpcRouter } from './ipc/router.ts';
import { initLogger, logger as log } from './log.ts';
import { externalUrlAllowed, isAllowedNavigation } from './navigation.ts';
import { ArtIndexService } from './frontend/ArtIndexService.ts';
import { createMenuWatch } from './menus/menuWatch.ts';
import { createNextlevelHandler, NEXTLEVEL_SCHEME } from './protocol/register.ts';
import { accountOf, createScraperClient } from './scraper/runtime.ts';
import { SCREENSCRAPER_URL } from './scraper/screenscraper/client.ts';
import { SecretStore } from './secrets/SecretStore.ts';
import { SettingsService } from './settings/SettingsService.ts';
import { startCatalog } from './catalog/startCatalog.ts';
import { currentSettings, startLibrary, type LibraryHost } from './startLibrary.ts';
import { preparePortable, setPortablePaths } from './portable/boot.ts';
import { electronPaths } from './portable/portableRoot.ts';

// D50: everything the launcher writes lives in its own folder; set before `ready`.
const portable = setPortablePaths();
// One launcher at a time: two would race moving old data in and writing the same files.
if (!app.requestSingleInstanceLock()) app.exit(0);
const dataDir = portable.data;
// Must happen before the app is ready (FR-THM-6).
protocol.registerSchemesAsPrivileged([NEXTLEVEL_SCHEME]);
const logsDir = electronPaths(dataDir).logs;
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

/** A Save dialog for a JSON file; null when cancelled. */
async function pickJsonSavePath(defaultName: string): Promise<string | null> {
  const window = BrowserWindow.getFocusedWindow();
  const options = { defaultPath: defaultName, filters: JSON_FILES };
  const result = await (window
    ? dialog.showSaveDialog(window, options)
    : dialog.showSaveDialog(options));
  return result.canceled || !result.filePath ? null : result.filePath;
}

async function start(): Promise<void> {
  if (!(await preparePortable(portable))) return;
  const settings = new SettingsService({
    dir: dataDir,
    clock: () => new Date(),
    log,
    onChanged: (snapshot) => {
      emit('settings.changed', snapshot);
    },
    dialogs: {
      pickExportPath: pickJsonSavePath,
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
  const adopted = await settings.adoptRoot(portable.root);
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
  let libraryParts: Parameters<NonNullable<LibraryHost['onOpened']>>[0] | null = null;
  const library = startLibrary(settings, scraper.client, scraper.quota, {
    dataDir,
    emit,
    menuWatch,
    launcherWindow,
    tempDir: electronPaths(dataDir).temp,
    baseEnv: portable.originalEnv,
    moved: adopted.movedFrom ? { from: adopted.movedFrom, to: portable.root } : null,
    skipSetup: !app.isPackaged && process.env['NEXTLEVEL_E2E_SETUP'] === 'skip',
    onOpened: (parts) => {
      libraryParts = parts;
    },
  });
  // Set once sign-in is set up (below); the protocol handler asks it for catalog art.
  const catalogRef: { current: ReturnType<typeof startCatalog> | undefined } = {
    current: undefined,
  };
  const artPaths = () => {
    const { assetsPath, themesPath } = currentSettings(settings).storage;
    return { assetsPath, themesPath };
  };
  protocol.handle(
    'nextlevel',
    createNextlevelHandler({
      mediaPath: (gameId, kind) => library?.media.path(gameId, kind) ?? null,
      scrapeThumb: (id) => library?.scrape.thumbnail(id) ?? Promise.resolve(null),
      // The catalog starts after sign-in is set up (below); until then there is no art.
      catalogArt: (itemId, kind) => catalogRef.current?.art(itemId, kind) ?? Promise.resolve(null),
      paths: artPaths,
    }),
  );

  const signIn = createAuth({
    isPackaged: app.isPackaged,
    env: process.env,
    builtApiUrl: import.meta.env.MAIN_VITE_API_URL,
    secrets,
    emit,
    log,
    appVersion: app.getVersion(),
    language: () => currentSettings(settings).general.language,
    openExternal: (url) => shell.openExternal(url),
    // e2e (development builds only): Download my data saves without a dialog.
    pickSavePath: (name) => {
      const e2eFile = app.isPackaged ? undefined : process.env['NEXTLEVEL_E2E_PICK_FILE'];
      return e2eFile ? Promise.resolve(e2eFile) : pickJsonSavePath(name);
    },
  });
  app.on('will-quit', () => {
    signIn.dispose();
  });
  // The catalog needs the library and a sign-in (none with sign-in off, D25).
  const opened = libraryParts as Parameters<NonNullable<LibraryHost['onOpened']>>[0] | null;
  const gameCatalog =
    opened && signIn.catalog
      ? startCatalog({
          ...opened,
          settings,
          // Packaged: <NextLevel folder>\Catalog (D45, D50). Development (and e2e): inside the
          // data folder, never the repo.
          root: app.isPackaged ? portable.root : dataDir,
          dataDir,
          api: signIn.catalog.api,
          session: signIn.catalog.service,
          emit,
          log,
          // End-to-end tests pause a download mid-way; development builds only.
          fileDelayMs: app.isPackaged
            ? 0
            : Number(process.env['NEXTLEVEL_E2E_DOWNLOAD_DELAY_MS'] ?? 0),
        })
      : undefined;
  catalogRef.current = gameCatalog;
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
    auth: signIn.auth,
    ...(gameCatalog ? { gameCatalog } : {}),
    scraperAccount: () => accountOf(scraper.client, scraper.quota),
    scraperSystems: (opts) => scraper.client.systems(opts),
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
  // The gate shows "checking" until boot routing (F2) settles; it never blocks the window.
  signIn.start().catch((error: unknown) => {
    log.error({ error }, 'sign-in could not start');
  });
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
