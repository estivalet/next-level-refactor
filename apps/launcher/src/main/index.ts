import { app, BrowserWindow, dialog, ipcMain, shell } from 'electron';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { systemCatalog } from '@nextlevel/system-catalog';
import { createHandlers } from './handlers.ts';
import { registerIpcRouter } from './ipc/register.ts';
import { createIpcRouter } from './ipc/router.ts';
import { initLogger, logger as log } from './log.ts';
import { externalUrlAllowed, isAllowedNavigation } from './navigation.ts';
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

async function start(): Promise<void> {
  const settings = new SettingsService({
    dir: dataDir,
    clock: () => new Date(),
    log,
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
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
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
