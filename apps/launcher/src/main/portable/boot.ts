import { app, dialog } from 'electron';
import { mkdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { mainText } from '../i18n/mainText.ts';
import { logger as log } from '../log.ts';
import { checkWritable } from './checkWritable.ts';
import { moveOldData } from './moveOldData.ts';
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
  const moved = await moveOldData({ from: oldDataDir(), to: data });
  if (typeof moved === 'object') {
    log.error({ reason: moved.failed }, 'old data could not be moved');
    dialog.showErrorBox('NextLevel', mainText(osLanguage(), 'portable.moveFailed'));
    app.exit(1);
    return false;
  }
  if (moved === 'moved') log.info({}, 'old data moved into the NextLevel folder');
  return true;
}

/**
 * Where launchers before D50 kept their data. The only OS folder the launcher still reads, once,
 * to bring that data in (moveOldData).
 */
function oldDataDir(): string {
  return join(app.getPath('appData'), app.isPackaged ? 'NextLevel' : 'NextLevel-dev');
}
