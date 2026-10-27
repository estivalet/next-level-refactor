import { readFile, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { expect, test, type Page } from '@playwright/test';
import { freshDataDir, launch } from './launch.ts';
import { startTestApi } from './testApi.ts';

// The launcher signs in against the real API (in-process, AUTH_STUB=1). The "browser" is a fetch
// of the stub's authorize URL with the persona as login hint (NEXTLEVEL_E2E_BROWSER), which
// redirects to the launcher's loopback listener like Google would.

type Persona = 'subscriber' | 'suspended' | 'outsider';

function signedInEnv(url: string, persona: Persona, extra: Record<string, string> = {}) {
  return {
    NEXTLEVEL_AUTH: 'on',
    NEXTLEVEL_API_URL: url,
    NEXTLEVEL_E2E_BROWSER: `stub:${persona}`,
    ...extra,
  };
}

const desktopApps = (page: Page) => page.getByRole('navigation', { name: 'Desktop apps' });

test('US-A1, FR-AUTH-6, D24: sign in with the stub, see the account, sign out', async () => {
  const api = await startTestApi();
  const data = await freshDataDir();
  const app = await launch(data.dir, signedInEnv(api.url, 'subscriber'));
  const page = await app.firstWindow();

  await page.getByRole('button', { name: 'Sign in with Google' }).click();
  await expect(desktopApps(page)).toBeVisible();
  await desktopApps(page).getByRole('button', { name: 'Account' }).dblclick();
  const account = page.getByRole('dialog', { name: 'Account' });
  await expect(account.getByText('subscriber@nextlevel.test')).toBeVisible();
  await expect(account.getByText('Default plan — billing not enabled')).toBeVisible();
  await expect(account.getByRole('list', { name: 'Devices' }).getByText('This PC')).toBeVisible();
  await account.getByRole('button', { name: 'Sign out' }).click();
  await expect(page.getByRole('button', { name: 'Sign in with Google' })).toBeVisible();

  await app.close();
  await api.close();
  await data.remove();
});

test('D22, FR-AUTH-7: an outsider is refused; a suspended account is locked out', async () => {
  const api = await startTestApi();
  const data = await freshDataDir();
  let app = await launch(data.dir, signedInEnv(api.url, 'outsider'));
  let page = await app.firstWindow();
  await page.getByRole('button', { name: 'Sign in with Google' }).click();
  await expect(page.getByRole('alert')).toHaveText("This Google account isn't authorized.");
  await app.close();

  app = await launch(data.dir, signedInEnv(api.url, 'suspended'));
  page = await app.firstWindow();
  await page.getByRole('button', { name: 'Sign in with Google' }).click();
  await expect(page.getByRole('heading', { name: 'This account is suspended' })).toBeVisible();
  await expect(desktopApps(page)).toBeHidden();

  await app.close();
  await api.close();
  await data.remove();
});

test('US-A3, FR-AUTH-5: offline within the grace opens with the indicator; after it, connect', async () => {
  const api = await startTestApi();
  const data = await freshDataDir();
  let app = await launch(data.dir, signedInEnv(api.url, 'subscriber'));
  let page = await app.firstWindow();
  await page.getByRole('button', { name: 'Sign in with Google' }).click();
  await expect(desktopApps(page)).toBeVisible();
  await app.close();
  await api.close();

  app = await launch(data.dir, signedInEnv(api.url, 'subscriber'));
  page = await app.firstWindow();
  await expect(desktopApps(page)).toBeVisible();
  await expect(
    page.getByRole('navigation', { name: 'Taskbar' }).getByText('Offline'),
  ).toBeVisible();
  await app.close();

  app = await launch(
    data.dir,
    signedInEnv(api.url, 'subscriber', { NEXTLEVEL_E2E_CLOCK_OFFSET_DAYS: '15' }),
  );
  page = await app.firstWindow();
  await expect(page.getByRole('alert')).toHaveText('Connect to the internet to continue.');
  await app.close();
  await data.remove();
});

test('US-A4: with 3 devices already, remove one and continue', async () => {
  const api = await startTestApi();
  await api.addDevices('subscriber', 3);
  const data = await freshDataDir();
  const app = await launch(data.dir, signedInEnv(api.url, 'subscriber'));
  const page = await app.firstWindow();
  await page.getByRole('button', { name: 'Sign in with Google' }).click();
  await expect(page.getByRole('heading', { name: 'Too many devices' })).toBeVisible();
  await page.getByRole('button', { name: 'Remove and continue' }).first().click();
  await expect(desktopApps(page)).toBeVisible();

  await app.close();
  await api.close();
  await data.remove();
});

test('US-A2: Subscribe → Choose → the stub Checkout is paid → the launcher unlocks, no restart', async () => {
  const api = await startTestApi({ billing: true });
  const data = await freshDataDir();
  const app = await launch(data.dir, signedInEnv(api.url, 'subscriber'));
  const page = await app.firstWindow();

  await page.getByRole('button', { name: 'Sign in with Google' }).click();
  await expect(page.getByRole('heading', { name: 'Choose a plan' })).toBeVisible();
  const basic = page.getByRole('article', { name: 'Basic' });
  await expect(basic.getByText(/19\.90/)).toBeVisible();
  await basic.getByRole('button', { name: 'Choose Basic' }).click();
  await expect(desktopApps(page)).toBeVisible({ timeout: 10_000 });
  await desktopApps(page).getByRole('button', { name: 'Account' }).dblclick();
  const account = page.getByRole('dialog', { name: 'Account' });
  await expect(account.getByText(/Basic · Monthly · Renews on/)).toBeVisible();
  await expect(account.getByRole('button', { name: 'Manage billing' })).toBeVisible();

  await app.close();
  await api.close();
  await data.remove();
});

test('D36, security §5: download my data, then delete the account; the library stays', async () => {
  const api = await startTestApi();
  const data = await freshDataDir();
  const exported = join(data.dir, 'my-data.json');
  const app = await launch(data.dir, {
    ...signedInEnv(api.url, 'subscriber'),
    NEXTLEVEL_E2E_PICK_FILE: exported,
  });
  const page = await app.firstWindow();
  await page.getByRole('button', { name: 'Sign in with Google' }).click();
  await desktopApps(page).getByRole('button', { name: 'Account' }).dblclick();
  const account = page.getByRole('dialog', { name: 'Account' });

  await account.getByRole('button', { name: 'Download my data' }).click();
  await expect(account.getByText('Saved.')).toBeVisible();
  const file = JSON.parse(await readFile(exported, 'utf8')) as { user: { email: string } };
  expect(file.user.email).toBe('subscriber@nextlevel.test');
  const library = (await stat(join(data.dir, 'library.db'))).isFile();

  await account.getByRole('button', { name: 'Delete account…' }).click();
  const dialog = page.getByRole('dialog', { name: 'Delete your NextLevel account?' });
  await dialog.getByLabel('Type your email to confirm').fill('subscriber@nextlevel.test');
  await dialog.getByRole('button', { name: 'Delete account' }).click();
  await expect(page.getByText('Your account was deleted.')).toBeVisible();
  await app.close();

  // The local library is untouched: still there, and it opens with sign-in off.
  expect(library).toBe(true);
  expect((await stat(join(data.dir, 'library.db'))).isFile()).toBe(true);
  const offline = await launch(data.dir);
  await expect(desktopApps(await offline.firstWindow())).toBeVisible();
  await offline.close();
  await api.close();
  await data.remove();
});
