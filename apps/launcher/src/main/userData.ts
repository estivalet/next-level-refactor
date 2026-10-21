import { join } from 'node:path';

/** Folder name under %APPDATA%; development builds get their own so they never touch a real install. */
export function userDataDirName(isPackaged: boolean): string {
  return isPackaged ? 'NextLevel' : 'NextLevel-dev';
}

/**
 * The launcher's data folder. Development builds honour an override (NEXTLEVEL_USER_DATA) so
 * end-to-end tests run against a throwaway folder; packaged builds ignore it.
 */
export function userDataPath(options: {
  appData: string;
  isPackaged: boolean;
  override: string | undefined;
}): string {
  if (!options.isPackaged && options.override) return options.override;
  return join(options.appData, userDataDirName(options.isPackaged));
}
