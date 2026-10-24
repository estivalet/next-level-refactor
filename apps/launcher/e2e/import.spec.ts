import { expect, test, type Locator, type Page } from '@playwright/test';
import { cp, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { appDir, freshDataDir, launch } from './launch.ts';

/** The invented NextLevelOS install, copied so its storage paths point at the copy. */
async function legacyCopy(root: string): Promise<string> {
  await cp(join(appDir, 'test', 'fixtures', 'nextlevelos'), root, { recursive: true });
  const config = join(root, 'data', 'config.json');
  const text = await readFile(config, 'utf8');
  await writeFile(config, text.replaceAll('%FIXTURE%', root.replaceAll('\\', '/')));
  return join(root, 'data');
}

async function openApp(page: Page, name: string): Promise<Locator> {
  await page
    .getByRole('navigation', { name: 'Desktop apps' })
    .getByRole('button', { name })
    .dblclick();
  return page.getByRole('dialog', { name });
}

async function importOnce(settings: Locator, page: Page): Promise<void> {
  await settings.getByRole('button', { name: 'Choose NextLevelOS data folder…' }).click();
  await settings.getByRole('button', { name: 'Dry run' }).click();
  await expect(settings.getByText('No matching system in NextLevel').first()).toBeVisible({
    timeout: 20_000,
  });
  await settings.getByRole('button', { name: 'Import…' }).click();
  await page
    .getByRole('dialog', { name: 'Import NextLevelOS?' })
    .getByRole('button', { name: 'Import' })
    .click();
  await expect(
    settings.getByText('Imported 12 games (4 missing), 2 collections and 2 menus.'),
  ).toBeVisible({ timeout: 30_000 });
}

test('FR-IMP-1/2, US-B3: import a NextLevelOS folder, then import it again', async () => {
  // A dry run, two imports with scans and three apps: CI runners need time.
  test.setTimeout(120_000);
  const data = await freshDataDir();
  const legacy = await freshDataDir();
  try {
    const folder = await legacyCopy(legacy.dir);
    const app = await launch(data.dir, { NEXTLEVEL_E2E_PICK_FOLDER: folder });
    const page = await app.firstWindow();

    let settings = await openApp(page, 'Settings');
    await settings.getByRole('button', { name: 'Data & logs' }).click();
    await importOnce(settings, page);
    await settings.getByRole('button', { name: 'Open Library' }).click();

    const library = page.getByRole('dialog', { name: 'Game Library' });
    await library.getByRole('treeitem', { name: /Atari 2600/ }).click();
    const games = library.getByRole('listbox', { name: 'Games' });
    await expect(games.getByRole('option', { name: /Pixel Quest/ })).toBeVisible();
    await library.getByRole('combobox', { name: 'Filter' }).selectOption('favorites');
    await expect(games.getByRole('option')).toHaveCount(1);
    await library.getByRole('combobox', { name: 'Filter' }).selectOption('all');
    await library.getByRole('treeitem', { name: /Party Picks/ }).click();
    await expect(games.getByRole('option')).toHaveCount(4);
    await library.getByRole('button', { name: 'Close' }).click();
    // On CI's smaller screen an open Settings window covers the desktop icons.
    await settings.getByRole('button', { name: 'Close' }).click();

    const editor = await openApp(page, 'Menu Editor');
    await expect(editor.getByRole('combobox', { name: 'Menu' })).toContainText('Main');
    await expect(
      editor.getByRole('tree', { name: 'Menu tree' }).getByRole('treeitem', { name: 'Consoles' }),
    ).toBeVisible();
    await editor.getByRole('button', { name: 'Close' }).click();

    // The front-end shows the imported menu.
    await page
      .getByRole('navigation', { name: 'Taskbar' })
      .getByRole('button', { name: 'Front-end' })
      .click();
    const layer = page.getByTestId('frontend-layer');
    await expect(layer).toBeVisible();
    await expect(layer).toContainText('Consoles');
    await page.keyboard.press('KeyM');
    await expect(layer).toBeHidden();

    // A second import changes no counts (D12).
    settings = await openApp(page, 'Settings');
    await settings.getByRole('button', { name: 'Data & logs' }).click();
    await importOnce(settings, page);
    await app.close();
  } finally {
    await data.remove();
    await legacy.remove();
  }
});
