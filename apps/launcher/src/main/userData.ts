/** Folder name under %APPDATA%; development builds get their own so they never touch a real install. */
export function userDataDirName(isPackaged: boolean): string {
  return isPackaged ? 'NextLevel' : 'NextLevel-dev';
}
