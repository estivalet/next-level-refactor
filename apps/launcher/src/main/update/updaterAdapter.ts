import { existsSync } from 'node:fs';
import { join } from 'node:path';
import type { NsisUpdater } from 'electron-updater';
import type { AppAdapter } from 'electron-updater/out/AppAdapter.js';
import { ElectronAppAdapter } from 'electron-updater/out/ElectronAppAdapter.js';

/** The part of Electron's `app` the updater reads. */
export type UpdaterApp = ConstructorParameters<typeof ElectronAppAdapter>[0];

/**
 * electron-updater's own adapter with its cache moved into `<data>\updates` (D50): by default it
 * downloads to `%LOCALAPPDATA%\<name>-updater`, outside the NextLevel folder.
 */
class PortableAppAdapter extends ElectronAppAdapter {
  private readonly cacheRoot: string;

  constructor(app: UpdaterApp, dataRoot: string) {
    super(app);
    this.cacheRoot = join(dataRoot, 'updates');
  }

  override get baseCachePath(): string {
    return this.cacheRoot;
  }
}

export function createUpdaterAdapter(dataRoot: string, app: UpdaterApp): AppAdapter {
  return new PortableAppAdapter(app, dataRoot);
}

/**
 * How this copy was installed (D51): the NSIS installer leaves its uninstaller beside the exe and
 * can update; a zip copy can't (it only gets a notice).
 */
export function installKind(execDir: string): 'nsis' | 'zip' {
  return existsSync(join(execDir, 'Uninstall NextLevel.exe')) ? 'nsis' : 'zip';
}

export type UpdaterEvent =
  | { type: 'checking' }
  | { type: 'available'; version: string }
  | { type: 'none' }
  | { type: 'progress'; percent: number }
  | { type: 'downloaded'; version: string }
  | { type: 'error'; error: unknown };

/** What UpdateService needs from electron-updater. */
export interface UpdaterPort {
  setPrerelease(allow: boolean): void;
  /** Never rejects: a failure arrives as an `error` event. */
  check(): Promise<void>;
  /** Installs silently and starts NextLevel again. */
  quitAndInstall(): void;
  subscribe(listener: (event: UpdaterEvent) => void): void;
}

/**
 * Downloads in the background and installs when NextLevel quits (D53); the service decides when
 * to check.
 */
export function bindUpdater(updater: NsisUpdater): UpdaterPort {
  updater.autoDownload = true;
  updater.autoInstallOnAppQuit = true;
  return {
    setPrerelease: (allow) => {
      updater.allowPrerelease = allow;
    },
    check: () =>
      updater.checkForUpdates().then(
        () => undefined,
        () => undefined,
      ),
    quitAndInstall: () => {
      updater.quitAndInstall(true, true);
    },
    subscribe: (listener) => {
      updater.on('checking-for-update', () => {
        listener({ type: 'checking' });
      });
      updater.on('update-available', (info) => {
        listener({ type: 'available', version: info.version });
      });
      updater.on('update-not-available', () => {
        listener({ type: 'none' });
      });
      updater.on('download-progress', (progress) => {
        listener({ type: 'progress', percent: progress.percent });
      });
      updater.on('update-downloaded', (info) => {
        listener({ type: 'downloaded', version: info.version });
      });
      updater.on('error', (error) => {
        listener({ type: 'error', error });
      });
    },
  };
}
