import { expect, test, type ElectronApplication, type Page } from '@playwright/test';
import { freshDataDir, launch } from './launch.ts';

async function close(app: ElectronApplication) {
  const closed = app.waitForEvent('close');
  await app.close();
  await closed.catch(() => undefined);
}

const desktopApps = (page: Page) => page.getByRole('navigation', { name: 'Desktop apps' });

test('FR-SET-6, US-D4: kiosk with PIN 1234 → restart → desktop and Settings hidden → hold Esc → 1234 → shown', async () => {
  const data = await freshDataDir();
  try {
    // 1. Settings → Kiosk: turn it on with 1234 (everything ticked to hide by default).
    let app = await launch(data.dir);
    let page = await app.firstWindow();
    await desktopApps(page).getByRole('button', { name: 'Settings' }).dblclick();
    const settings = page.getByRole('dialog', { name: 'Settings' });
    await settings.getByRole('button', { name: 'Kiosk' }).click();
    await settings.getByRole('switch', { name: 'Kiosk mode' }).click();
    await settings.getByLabel('New PIN').fill('1234');
    await settings.getByLabel('PIN again').fill('1234');
    await settings.getByRole('button', { name: 'Save' }).click();
    await expect(settings.getByRole('button', { name: 'Lock now' })).toBeVisible();
    await close(app);

    // 2. Restart: locked, the front-end covers everything and M can't leave it.
    app = await launch(data.dir);
    page = await app.firstWindow();
    const layer = page.getByTestId('frontend-layer');
    await expect(layer).toBeVisible();
    await page.keyboard.press('KeyM');
    await expect(layer).toBeVisible();
    await expect(desktopApps(page).getByRole('button', { name: 'Settings' })).toBeHidden();

    // 3. Hold Esc for 3 seconds → PIN pad → 1234.
    await page.keyboard.down('Escape');
    const pad = page.getByRole('dialog', { name: 'Enter the kiosk PIN' });
    await expect(pad).toBeVisible({ timeout: 6000 });
    await page.keyboard.up('Escape');
    await page.keyboard.type('1234');
    await page.keyboard.press('Enter');
    await expect(pad).toBeHidden();

    // 4. Unlocked until restart: M leaves the front-end and Settings is back.
    await page.keyboard.press('Escape');
    await page.keyboard.press('KeyM');
    await expect(layer).toBeHidden();
    await expect(desktopApps(page).getByRole('button', { name: 'Settings' })).toBeVisible();
    await close(app);
  } finally {
    await data.remove();
  }
});
