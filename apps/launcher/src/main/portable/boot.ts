import { app, dialog } from 'electron';
import { mainText } from '../i18n/mainText.ts';
import { logger as log } from '../log.ts';
import { cleanTemp, oldDataSource, portableEnv } from './bootSteps.ts';
import { checkWritable } from './checkWritable.ts';
import { moveOldData } from './moveOldData.ts';
import { electronPaths, portableRoot, type ElectronPathName } from './portableRoot.ts';

export interface PortableFolders {
  root: string;
  data: string;
  /** `NEXTLEVEL_USER_DATA` replaced the data folder (development, e2e). */
  overridden: boolean;
  /** The environment the launcher started with, for emulators (TMP/TEMP untouched). */
  originalEnv: NodeJS.ProcessEnv;
}

/**
 * Points every Electron path, and TMP/TEMP, into the data folder (D50). Must run before `ready`:
 * Chromium creates its profile, caches and crash dumps there at startup.
 */
export function setPortablePaths(): PortableFolders {
  const override = process.env['NEXTLEVEL_USER_DATA'];
  const where = portableRoot({
    execPath: process.execPath,
    isPackaged: app.isPackaged,
    appPath: app.getAppPath(),
    override,
  });
  const paths = electronPaths(where.data);
  for (const name of Object.keys(paths) as ElectronPathName[]) app.setPath(name, paths[name]);
  const env = portableEnv(process.env, paths.temp);
  Object.assign(process.env, env.launcher);
  return {
    ...where,
    overridden: !app.isPackaged && Boolean(override),
    originalEnv: env.original,
  };
}

/** The OS language, for the few messages shown before settings load. */
const osLanguage = () => (app.getLocale().toLowerCase().startsWith('pt') ? 'pt-BR' : 'en');

/**
 * After `ready`: a folder the launcher can't write (e.g. under Program Files) gets a dialog and
 * the launcher quits; otherwise temp starts empty (best effort) and old AppData data moves in.
 * Answers whether to go on.
 */
export async function preparePortable(folders: PortableFolders): Promise<boolean> {
  const { data } = folders;
  const writable = await checkWritable(data);
  if (!writable.ok) {
    dialog.showErrorBox('NextLevel', mainText(osLanguage(), 'portable.notWritable'));
    app.exit(1);
    return false;
  }
  await cleanTemp(electronPaths(data).temp, log);
  // The only OS folder the launcher still reads, once, to bring older data in.
  const from = oldDataSource({
    appData: app.getPath('appData'),
    isPackaged: app.isPackaged,
    overridden: folders.overridden,
  });
  if (from === null) return true;
  const moved = await moveOldData({ from, to: data });
  if (typeof moved === 'object') {
    log.error({ reason: moved.failed }, 'old data could not be moved');
    dialog.showErrorBox('NextLevel', mainText(osLanguage(), 'portable.moveFailed'));
    app.exit(1);
    return false;
  }
  if (moved === 'moved') log.info({}, 'old data moved into the NextLevel folder');
  return true;
}
