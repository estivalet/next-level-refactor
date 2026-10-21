import { app, BrowserWindow, ipcMain } from 'electron';
import { join } from 'node:path';
import { createIpcRouter } from './ipc/router.ts';
import { userDataDirName } from './userData.ts';

app.setPath('userData', join(app.getPath('appData'), userDataDirName(app.isPackaged)));

// Replaced by electron-log in M1.
const log = {
  error(context: Record<string, unknown>, msg: string): void {
    console.error(msg, context);
  },
};

function registerIpc(): void {
  const router = createIpcRouter({ 'app.version': () => app.getVersion() }, log);
  for (const channel of router.channels) {
    ipcMain.handle(channel, (_event, input: unknown) => router.handle(channel, input));
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
    },
  });

  const devServerUrl = process.env['ELECTRON_RENDERER_URL'];
  if (!app.isPackaged && devServerUrl) {
    void window.loadURL(devServerUrl);
  } else {
    void window.loadFile(join(import.meta.dirname, '../renderer/index.html'));
  }
}

void app.whenReady().then(() => {
  registerIpc();
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
