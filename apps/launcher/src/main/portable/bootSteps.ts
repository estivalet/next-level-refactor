import * as nodeFs from 'node:fs/promises';
import { join } from 'node:path';

/**
 * The folder launchers before D50 kept their data in, to move in once — or null when the data
 * folder is a development override (e2e): a throwaway folder must never take the real data.
 */
export function oldDataSource(o: {
  appData: string;
  isPackaged: boolean;
  overridden: boolean;
}): string | null {
  if (o.overridden) return null;
  return join(o.appData, o.isPackaged ? 'NextLevel' : 'NextLevel-dev');
}

/**
 * The launcher's environment with TMP/TEMP in the data folder (D50: Chromium, SQLite and
 * dependencies read these, not Electron's `temp` path), and the original one, which emulators
 * get: they are the player's programs, not the launcher.
 */
export function portableEnv(
  env: NodeJS.ProcessEnv,
  temp: string,
): { launcher: NodeJS.ProcessEnv; original: NodeJS.ProcessEnv } {
  return { launcher: { ...env, TMP: temp, TEMP: temp }, original: { ...env } };
}

/** Empties `<data>\temp` at boot; a file still held open is logged and left, never fatal. */
export async function cleanTemp(
  temp: string,
  log: { warn(context: object, msg: string): void },
  fs: Pick<typeof nodeFs, 'rm' | 'mkdir'> = nodeFs,
): Promise<void> {
  try {
    await fs.rm(temp, { recursive: true, force: true, maxRetries: 2 });
  } catch (error) {
    log.warn({ code: (error as NodeJS.ErrnoException).code }, 'temp folder not fully emptied');
  }
  await fs.mkdir(temp, { recursive: true });
}
