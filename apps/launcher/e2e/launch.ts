import {
  _electron as electron,
  expect,
  type ElectronApplication,
  type Page,
} from '@playwright/test';
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

/** Launches the built launcher against `dataDir`, with extra environment variables. */
export function launch(
  dataDir: string,
  extraEnv: Record<string, string> = {},
): Promise<ElectronApplication> {
  // VS Code terminals set ELECTRON_RUN_AS_NODE, which would start Electron as plain Node.
  const env = Object.fromEntries(
    Object.entries(process.env).filter(
      (entry): entry is [string, string] =>
        entry[0] !== 'ELECTRON_RUN_AS_NODE' && entry[1] !== undefined,
    ),
  );
  return electron.launch({
    args: [appDir],
    // Sign-in is off unless a test turns it on (D25); auth.spec.ts passes NEXTLEVEL_AUTH: 'on'.
    env: { ...env, NEXTLEVEL_AUTH: 'off', ...extraEnv, NEXTLEVEL_USER_DATA: dataDir },
  });
}

/** With games in the library the launcher boots into the front-end (FR-THM-5); M leaves it. */
export async function leaveFrontend(page: Page): Promise<void> {
  const layer = page.getByTestId('frontend-layer');
  await expect(layer).toBeVisible();
  await page.keyboard.press('KeyM');
  await expect(layer).toBeHidden();
}
