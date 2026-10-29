import { expect, test, type Page } from '@playwright/test';
import { freshDataDir, launch } from './launch.ts';
import { startTestApi } from './testApi.ts';

// The launcher installs from the real API (in-process, AUTH_STUB=1) with made-up homebrew items
// whose files are dummy bytes (test-strategy §2). Downloads, installs and the Catalog folder all
// live in the test's data folder (D50).

function signedInEnv(url: string, extra: Record<string, string> = {}) {
  return {
    NEXTLEVEL_AUTH: 'on',
    NEXTLEVEL_API_URL: url,
    NEXTLEVEL_E2E_BROWSER: 'stub:subscriber',
    ...extra,
  };
}

const desktopApps = (page: Page) => page.getByRole('navigation', { name: 'Desktop apps' });

async function signInAndOpenCatalog(page: Page) {
  // A fresh data folder shows the sign-in; a restart with a stored session goes to the desktop.
  const signIn = page.getByRole('button', { name: 'Sign in with Google' });
  await expect(signIn.or(desktopApps(page))).toBeVisible();
  if (await signIn.isVisible()) await signIn.click();
  await expect(desktopApps(page)).toBeVisible();
  await desktopApps(page).getByRole('button', { name: 'Catalog' }).dblclick();
  return page.getByRole('dialog', { name: 'Catalog' });
}

async function openItem(catalog: ReturnType<Page['getByRole']>, title: string) {
  await catalog
    .getByRole('list', { name: 'New' })
    .getByRole('button', { name: new RegExp(title) })
    .click();
  return catalog.getByRole('region', { name: title });
}

async function findInLibrary(page: Page, title: string) {
  await desktopApps(page).getByRole('button', { name: 'Library' }).dblclick();
  const library = page.getByRole('dialog', { name: 'Library' });
  await library.getByRole('searchbox', { name: 'Search all games' }).fill(title.toLowerCase());
  return { library, results: library.getByRole('listbox', { name: 'Search results' }) };
}

async function expectEmptyLibrary(page: Page) {
  await desktopApps(page).getByRole('button', { name: 'Library' }).dblclick();
  const library = page.getByRole('dialog', { name: 'Library' });
  await expect(library.getByRole('heading', { name: 'No games yet' })).toBeVisible();
}

test('US-E2, US-E3: install a fixture game, it is in the Library with art; uninstall removes it', async () => {
  test.setTimeout(90_000);
  const api = await startTestApi();
  const data = await freshDataDir();
  try {
    await api.publishItem('star-hopper');
    const app = await launch(data.dir, signedInEnv(api.url));
    const page = await app.firstWindow();
    const catalog = await signInAndOpenCatalog(page);
    const detail = await openItem(catalog, 'Star Hopper');
    await expect(detail.getByText("License: Author's permission · © Pixel Pals")).toBeVisible();
    await detail.getByRole('button', { name: 'Install' }).click();
    await expect(detail.getByRole('button', { name: 'Play' })).toBeVisible({ timeout: 20_000 });

    const { library, results } = await findInLibrary(page, 'Star Hopper');
    await expect(results.getByRole('option')).toHaveCount(1);
    await results.getByRole('option').click();
    await expect(library.locator('img[src^="nextlevel://media/"]').first()).toBeVisible();
    await library.getByRole('button', { name: 'Close' }).click();

    await detail.getByRole('button', { name: 'Uninstall' }).click();
    await expect(detail.getByRole('button', { name: 'Install' })).toBeVisible();
    // It was the only game: the Library is empty again.
    await expectEmptyLibrary(page);
    await app.close();
  } finally {
    await api.close();
    await data.remove();
  }
});

test('FR-CAT-4: a download paused, the launcher restarted, then resumed completes', async () => {
  test.setTimeout(90_000);
  const api = await startTestApi();
  const data = await freshDataDir();
  try {
    await api.publishItem('star-hopper');
    // Each file request waits 5 s, so the download is still running when it is paused.
    const env = signedInEnv(api.url, { NEXTLEVEL_E2E_DOWNLOAD_DELAY_MS: '5000' });
    let app = await launch(data.dir, env);
    let page = await app.firstWindow();
    let catalog = await signInAndOpenCatalog(page);
    const detail = await openItem(catalog, 'Star Hopper');
    await detail.getByRole('button', { name: 'Install' }).click();
    await catalog.getByRole('tab', { name: 'Downloads' }).click();
    const downloads = catalog.getByRole('list', { name: 'Downloads' });
    await downloads.getByRole('button', { name: 'Pause' }).click();
    await expect(downloads).toContainText('Paused');
    await app.close();

    app = await launch(data.dir, { ...env, NEXTLEVEL_E2E_DOWNLOAD_DELAY_MS: '0' });
    page = await app.firstWindow();
    catalog = await signInAndOpenCatalog(page);
    await catalog.getByRole('tab', { name: 'Downloads' }).click();
    const again = catalog.getByRole('list', { name: 'Downloads' });
    await expect(again).toContainText('Paused');
    await again.getByRole('button', { name: 'Resume' }).click();
    await catalog.getByRole('tab', { name: 'Installed' }).click();
    await expect(
      catalog.getByRole('list', { name: 'Installed games' }).getByText('Star Hopper'),
    ).toBeVisible({ timeout: 20_000 });
    await app.close();
  } finally {
    await api.close();
    await data.remove();
  }
});

test('D43: unpublishing a remove item removes it at the next sync, with a notice', async () => {
  test.setTimeout(90_000);
  const api = await startTestApi();
  const data = await freshDataDir();
  try {
    const id = await api.publishItem('star-hopper', { onLapse: 'remove' });
    const app = await launch(data.dir, signedInEnv(api.url));
    const page = await app.firstWindow();
    const catalog = await signInAndOpenCatalog(page);
    const detail = await openItem(catalog, 'Star Hopper');
    await detail.getByRole('button', { name: 'Install' }).click();
    await expect(detail.getByRole('button', { name: 'Play' })).toBeVisible({ timeout: 20_000 });

    await api.unpublish(id);
    // The sync runs after an entitlement check: Account → Refresh asks for one now.
    await desktopApps(page).getByRole('button', { name: 'Account' }).dblclick();
    await page
      .getByRole('dialog', { name: 'Account' })
      .getByRole('button', { name: 'Refresh' })
      .click();
    // The notice is the shell's: it shows whatever window is open (D43).
    await expect(
      page.getByText('Removed because they left the catalog: Star Hopper'),
    ).toBeVisible();
    // The Account window covers the desktop icons on small screens.
    await page
      .getByRole('dialog', { name: 'Account' })
      .getByRole('button', { name: 'Close' })
      .click();
    await expectEmptyLibrary(page);
    await app.close();
  } finally {
    await api.close();
    await data.remove();
  }
});
