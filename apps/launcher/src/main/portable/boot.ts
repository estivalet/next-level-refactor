import { app, dialog } from 'electron';
import { mkdir, rm } from 'node:fs/promises';
import { mainText } from '../i18n/mainText.ts';
import { checkWritable } from './checkWritable.ts';
import { electronPaths, portableRoot, type ElectronPathName } from './portableRoot.ts';

/**
 * Points every Electron path into the data folder (D50). Must run before `ready`: Chromium
 * creates its profile, caches and crash dumps there at startup.
 */
export function setPortablePaths(): { root: string; data: string } {
  const where = portableRoot({
    execPath: process.execPath,
    isPackaged: app.isPackaged,
    appPath: app.getAppPath(),
    override: process.env['NEXTLEVEL_USER_DATA'],
  });
  const paths = electronPaths(where.data);
  for (const name of Object.keys(paths) as ElectronPathName[]) app.setPath(name, paths[name]);
  return where;
}

/** The OS language, for the few messages shown before settings load. */
const osLanguage = () => (app.getLocale().toLowerCase().startsWith('pt') ? 'pt-BR' : 'en');

/**
 * After `ready`: a folder the launcher can't write (e.g. under Program Files) gets a dialog and
 * the launcher quits; otherwise the temp folder starts empty. Answers whether to go on.
 */
export async function preparePortable(data: string): Promise<boolean> {
  const writable = await checkWritable(data);
  if (!writable.ok) {
    dialog.showErrorBox('NextLevel', mainText(osLanguage(), 'portable.notWritable'));
    app.exit(1);
    return false;
  }
  const temp = electronPaths(data).temp;
  await rm(temp, { recursive: true, force: true });
  await mkdir(temp, { recursive: true });
  return true;
}
