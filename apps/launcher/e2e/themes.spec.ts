import { expect, test } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { freshDataDir, launch } from './launch.ts';

const LOCATION = '01900000-0000-7000-8000-00000000a001';

test('FR-THM-1, FR-THM-4: HyperSpin follows an option saved in Settings; Showcase keeps the game', async () => {
  test.setTimeout(150_000);
  const data = await freshDataDir();
  const roms = await freshDataDir();
  try {
    await mkdir(join(roms.dir, 'Nintendo 64'));
    for (const name of ['Homebrew Alpha', 'Homebrew Beta']) {
      await writeFile(join(roms.dir, 'Nintendo 64', `${name}.z64`), '');
    }
    await writeFile(
      join(data.dir, 'settings.json'),
      JSON.stringify({
        schemaVersion: 1,
        storage: { locations: [{ id: LOCATION, name: 'Main', path: roms.dir, priority: 1 }] },
        themes: { activeDefault: 'hyperspin', lastUsed: 'hyperspin' },
      }),
    );
    let app = await launch(data.dir);
    let page = await app.firstWindow();
    await page
      .getByRole('navigation', { name: 'Desktop apps' })
      .getByRole('button', { name: 'Game Library' })
      .dblclick();
    const library = page.getByRole('dialog', { name: 'Game Library' });
    await library.getByRole('button', { name: 'Scan for games' }).click();
    await expect(library.getByRole('listbox', { name: 'Games' }).getByRole('option')).toHaveCount(
      2,
    );
    await app.close();

    // FR-THM-5: the last theme is HyperSpin.
    app = await launch(data.dir);
    page = await app.firstWindow();
    const layer = page.getByTestId('frontend-layer');
    await expect(layer).toHaveAttribute('data-theme', 'hyperspin');
    const focused = layer.locator('[data-wheel] [data-focused="true"]');
    await expect(focused).toContainText('Nintendo');
    await page.keyboard.press('Enter');
    await expect(focused).toContainText('Nintendo 64');
    await page.keyboard.press('Enter');
    await expect(focused).toContainText('Homebrew Alpha');
    await page.keyboard.press('ArrowDown');
    await expect(focused).toContainText('Homebrew Beta');
    await expect(focused).toHaveCSS('height', '96px');

    // FR-THM-4: change the game list wheel's item height in Settings; the open theme follows.
    await page.keyboard.press('KeyM');
    await expect(layer).toBeHidden();
    await page
      .getByRole('navigation', { name: 'Desktop apps' })
      .getByRole('button', { name: 'Settings' })
      .dblclick();
    const settings = page.getByRole('dialog', { name: 'Settings' });
    await settings.getByRole('button', { name: 'Themes' }).click();
    await settings
      .getByRole('article', { name: 'HyperSpin Classic' })
      .getByRole('button', { name: 'Options' })
      .click();
    await settings
      .getByRole('group', { name: 'Game list wheel' })
      .getByRole('spinbutton', { name: 'Item height' })
      .fill('150');
    await settings.getByRole('button', { name: 'Save' }).click();
    await expect(settings.getByRole('button', { name: 'Save' })).toBeHidden();
    await page
      .getByRole('navigation', { name: 'Taskbar' })
      .getByRole('button', { name: 'Front-end' })
      .click();
    await expect(layer).toBeVisible();
    await expect(focused).toContainText('Homebrew Beta');
    await expect(focused).toHaveCSS('height', '150px');

    // FR-THM-1: the switcher's next theme is Showcase, on the same game.
    const switcher = page.getByRole('dialog', { name: 'Switch theme' });
    await page.keyboard.press('KeyT');
    await expect(switcher).toBeFocused();
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('Enter');
    await expect(switcher).toBeHidden();
    await expect(layer).toHaveAttribute('data-theme', 'showcase');
    await expect(layer.getByRole('heading', { level: 1, name: 'Homebrew Beta' })).toBeVisible();
    await page.keyboard.press('ArrowRight');
    await expect(layer.getByRole('heading', { level: 1, name: 'Homebrew Alpha' })).toBeVisible();
    await app.close();
  } finally {
    await data.remove();
    await roms.remove();
  }
});
