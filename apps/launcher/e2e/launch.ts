import { _electron as electron, type ElectronApplication } from '@playwright/test';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

export const appDir = join(import.meta.dirname, '..');

export async function appVersion(): Promise<string> {
  const pkg = JSON.parse(await readFile(join(appDir, 'package.json'), 'utf8')) as {
    version: string;
  };
  return pkg.version;
}

/** A fresh data folder so e2e runs never read or write the developer's NextLevel-dev data. */
export async function freshDataDir(): Promise<{ dir: string; remove: () => Promise<void> }> {
  const dir = await mkdtemp(join(tmpdir(), 'nextlevel-e2e-'));
  // Electron can keep a file locked for a while after closing on Windows. The folder is in the
  // OS temp dir, so cleanup is best effort and never fails a test.
  const remove = () =>
    rm(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 }).catch(
      () => undefined,
    );
  return { dir, remove };
}

/** Launches the built launcher against `dataDir`. */
export function launch(dataDir: string): Promise<ElectronApplication> {
  // VS Code terminals set ELECTRON_RUN_AS_NODE, which would start Electron as plain Node.
  const env = Object.fromEntries(
    Object.entries(process.env).filter(
      (entry): entry is [string, string] =>
        entry[0] !== 'ELECTRON_RUN_AS_NODE' && entry[1] !== undefined,
    ),
  );
  return electron.launch({ args: [appDir], env: { ...env, NEXTLEVEL_USER_DATA: dataDir } });
}
