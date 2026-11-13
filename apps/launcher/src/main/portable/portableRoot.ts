import { dirname, join, resolve } from 'node:path';

/**
 * The NextLevel folder and its data folder (D50: the launcher writes nothing outside them).
 * Packaged: the folder of NextLevel.exe, data in `<folder>\data`. Development: the repo, data in
 * `<repo>\.nextlevel-dev`; `NEXTLEVEL_USER_DATA` (e2e) replaces the data folder in development
 * only. A packaged build started by electron-builder's `portable` target runs from a copy unpacked
 * into a temporary folder; `PORTABLE_EXECUTABLE_DIR` (`portableDir`) names the folder of the real
 * exe and wins (D51).
 */
export function portableRoot(o: {
  execPath: string;
  isPackaged: boolean;
  appPath: string;
  override?: string | undefined;
  portableDir?: string | undefined;
}): { root: string; data: string } {
  if (o.isPackaged) {
    const root = o.portableDir || dirname(o.execPath);
    return { root, data: join(root, 'data') };
  }
  const root = resolve(o.appPath, '../..');
  return { root, data: o.override || join(root, '.nextlevel-dev') };
}

export type ElectronPathName = 'userData' | 'sessionData' | 'logs' | 'crashDumps' | 'temp';

/** Where Electron and Chromium keep their files: all inside the data folder. */
export function electronPaths(data: string): Record<ElectronPathName, string> {
  return {
    userData: data,
    sessionData: join(data, 'chromium'),
    logs: join(data, 'logs'),
    crashDumps: join(data, 'crashes'),
    temp: join(data, 'temp'),
  };
}
