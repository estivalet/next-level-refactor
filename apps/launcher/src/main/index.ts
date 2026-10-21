import { app, BrowserWindow, ipcMain, shell } from 'electron';
import { join } from 'node:path';
import { registerIpcRouter } from './ipc/register.ts';
import { createIpcRouter } from './ipc/router.ts';
import { externalUrlAllowed, isAllowedNavigation } from './navigation.ts';
import { userDataDirName } from './userData.ts';

app.setPath('userData', join(app.getPath('appData'), userDataDirName(app.isPackaged)));

// Replaced by electron-log in M1b.
const log = {
  error(context: Record<string, unknown>, msg: string): void {
    console.error(msg, context);
  },
};

const devServerUrl = app.isPackaged ? undefined : process.env['ELECTRON_RENDERER_URL'];

function openExternally(url: string): void {
  if (externalUrlAllowed(url)) {
    shell.openExternal(url).catch((error: unknown) => {
      log.error({ url, error }, 'could not open external URL');
    });
  }
}

function createWindow(): void {
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
    if (isAllowedNavigation(url, devServerUrl)) return;
    event.preventDefault();
    openExternally(url);
  });

  const loading = devServerUrl
    ? window.loadURL(devServerUrl)
    : window.loadFile(join(import.meta.dirname, '../renderer/index.html'));
  loading.catch((error: unknown) => {
    log.error({ error }, 'could not load the renderer');
  });
}

void app.whenReady().then(() => {
  const handlers = {
    'app.version': () => app.getVersion(),
    'app.quit': () => {
      app.quit();
    },
  };
  registerIpcRouter(ipcMain, createIpcRouter(handlers, log));
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
