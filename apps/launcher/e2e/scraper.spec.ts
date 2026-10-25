import { expect, test, type ElectronApplication, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { FAKE_DEV, FAKE_USER, startFakeScreenScraper } from './fakeScreenScraper.ts';
import { freshDataDir, launch } from './launch.ts';

async function openScraperSettings(page: Page) {
  await page
    .getByRole('navigation', { name: 'Desktop apps' })
    .getByRole('button', { name: 'Settings' })
    .dblclick();
  const settings = page.getByRole('dialog', { name: 'Settings' });
  await settings.getByRole('button', { name: 'Scraper' }).click();
  await expect(settings.getByText('ScreenScraper account')).toBeVisible();
  return settings;
}

async function close(app: ElectronApplication) {
  const closed = app.waitForEvent('close');
  await app.close();
  await closed.catch(() => undefined);
}

test('US-D6, FR-SCR-3: credentials are saved encrypted, tested, and kept across restart', async () => {
  const data = await freshDataDir();
  const server = await startFakeScreenScraper();
  const env = { NEXTLEVEL_SCREENSCRAPER_URL: server.url };
  try {
    let app = await launch(data.dir, env);
    let page = await app.firstWindow();
    let settings = await openScraperSettings(page);
    await settings.getByLabel('User name').fill(FAKE_USER.id);
    await settings.getByLabel('Password', { exact: true }).fill(FAKE_USER.password);
    await settings.getByText('Developer credentials').click();
    await settings.getByLabel('Developer id').fill(FAKE_DEV.id);
    await settings.getByLabel('Developer password').fill(FAKE_DEV.password);
    await settings.getByRole('button', { name: 'Save credentials' }).click();
    await expect(settings.getByText('Credentials saved.')).toBeVisible();

    await settings.getByRole('button', { name: 'Test' }).click();
    await expect(
      settings.getByText(`Signed in as ${FAKE_USER.id} · 5 of 20000 requests today`),
    ).toBeVisible();

    // Nothing readable on disk.
    const secrets = await readFile(join(data.dir, 'secrets.bin'));
    expect(secrets.toString('latin1')).not.toContain(FAKE_USER.password);
    expect(secrets.toString('latin1')).not.toContain(FAKE_DEV.password);
    await close(app);

    app = await launch(data.dir, env);
    page = await app.firstWindow();
    settings = await openScraperSettings(page);
    await expect(settings.getByLabel('Password', { exact: true })).toHaveAttribute(
      'placeholder',
      'Saved',
    );
    await settings.getByRole('button', { name: 'Test' }).click();
    await expect(
      settings.getByText(`Signed in as ${FAKE_USER.id}`, { exact: false }),
    ).toBeVisible();
    await close(app);
  } finally {
    await server.close();
    await data.remove();
  }
});
