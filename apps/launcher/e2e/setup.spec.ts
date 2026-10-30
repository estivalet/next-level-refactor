import { expect, test } from '@playwright/test';
import { freshDataDir, launch } from './launch.ts';

test('FR-ONB-1, FR-ONB-2: a new install runs the wizard; skipping everything opens the Catalog', async () => {
  const data = await freshDataDir();
  try {
    let app = await launch(data.dir, { NEXTLEVEL_E2E_SETUP: 'show' });
    let page = await app.firstWindow();
    await expect(page.getByRole('heading', { name: 'Choose your systems' })).toBeVisible();
    await expect(page.getByRole('checkbox', { name: 'Nintendo NES' })).toBeChecked();
    for (let i = 0; i < 4; i += 1) await page.getByRole('button', { name: 'Skip' }).click();
    await page.getByRole('button', { name: 'Browse catalog' }).click();
    const catalog = page.getByRole('dialog', { name: 'Catalog' });
    await expect(catalog.getByRole('tab', { name: 'Browse' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    await app.close();

    // Setup is done: the next start goes straight to the shell.
    app = await launch(data.dir, { NEXTLEVEL_E2E_SETUP: 'show' });
    page = await app.firstWindow();
    await expect(page.getByRole('navigation', { name: 'Desktop apps' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Choose your systems' })).toHaveCount(0);
    await app.close();
  } finally {
    await data.remove();
  }
});
