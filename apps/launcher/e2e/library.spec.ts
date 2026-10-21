import { expect, test, type Page } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { freshDataDir, launch } from './launch.ts';

async function openLibrary(page: Page) {
  await page
    .getByRole('navigation', { name: 'Desktop apps' })
    .getByRole('button', { name: 'Game Library' })
    .dblclick();
  return page.getByRole('dialog', { name: 'Game Library' });
}

test('FR-LIB-6..8, FR-LIB-10: browse, search, favorite, edit and collect', async () => {
  // Two app launches and a long flow: CI runners need more than the default 30 s.
  test.setTimeout(90_000);
  const data = await freshDataDir();
  const roms = await freshDataDir();
  try {
    // Empty placeholder files with made-up names; the folder name is the catalog default.
    await mkdir(join(roms.dir, 'Nintendo 64'));
    await writeFile(join(roms.dir, 'Nintendo 64', 'Homebrew Demo.z64'), '');
    await writeFile(join(roms.dir, 'Nintendo 64', 'Homebrew Racer.z64'), '');

    let app = await launch(data.dir, { NEXTLEVEL_E2E_PICK_FOLDER: roms.dir });
    let page = await app.firstWindow();
    await page
      .getByRole('navigation', { name: 'Desktop apps' })
      .getByRole('button', { name: 'Settings' })
      .dblclick();
    const settings = page.getByRole('dialog', { name: 'Settings' });
    await settings.getByRole('button', { name: 'Storage' }).click();
    await settings.getByRole('button', { name: 'Add location…' }).click();
    await settings.getByRole('button', { name: 'Save' }).click();
    await expect(settings.getByRole('region', { name: 'You have unsaved changes.' })).toBeHidden();

    let library = await openLibrary(page);
    await library.getByRole('button', { name: 'Scan for games' }).click();
    await expect(library.getByRole('treeitem', { name: /Nintendo 64/ })).toBeVisible();
    const games = library.getByRole('listbox', { name: 'Games' });
    await expect(games.getByRole('option')).toHaveCount(2);

    // Global search (FR-LIB-10).
    const search = library.getByRole('searchbox', { name: 'Search all games' });
    await search.fill('racer');
    const results = library.getByRole('listbox', { name: 'Search results' });
    await expect(results.getByRole('option')).toHaveCount(1);
    await expect(results.getByRole('option')).toContainText('Homebrew Racer');
    await search.press('Escape');

    // Favorite (FR-LIB-7) and the Favorites filter.
    await games.getByRole('option', { name: /Homebrew Racer/ }).click();
    const details = library.getByRole('complementary', { name: 'Game details' });
    await details.getByRole('button', { name: 'Favorite' }).click();
    await expect(details.getByRole('button', { name: 'Favorite' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await library.getByRole('combobox', { name: 'Filter' }).selectOption('favorites');
    await expect(games.getByRole('option')).toHaveCount(1);
    await library.getByRole('combobox', { name: 'Filter' }).selectOption('all');

    // Edit details (FR-LIB-6).
    await games.getByRole('option', { name: /Homebrew Racer/ }).click();
    await details.getByRole('button', { name: 'Edit details' }).click();
    const edit = library.getByRole('dialog', { name: 'Edit details' });
    await edit.getByRole('textbox', { name: 'Title' }).fill('Racer Deluxe');
    await edit.getByRole('button', { name: 'Save' }).click();
    await expect(games.getByRole('option', { name: /Racer Deluxe/ })).toBeVisible();

    // Collections (FR-LIB-8).
    await library.getByRole('button', { name: 'New collection' }).click();
    const create = library.getByRole('dialog', { name: 'New collection' });
    await create.getByRole('textbox', { name: 'Name' }).fill('Picks');
    await create.getByRole('button', { name: 'Create' }).click();
    await games.getByRole('option', { name: /Racer Deluxe/ }).click({ button: 'right' });
    await page.getByRole('menuitem', { name: 'Add to collection…' }).click();
    await library
      .getByRole('dialog', { name: 'Add 1 game to a collection' })
      .getByRole('button', { name: 'Picks' })
      .click();
    await library.getByRole('treeitem', { name: /Picks/ }).click();
    await expect(games.getByRole('option')).toHaveCount(1);
    await app.close();

    // Everything survives a restart.
    app = await launch(data.dir);
    page = await app.firstWindow();
    library = await openLibrary(page);
    await library.getByRole('treeitem', { name: /Picks/ }).click();
    const picks = library.getByRole('listbox', { name: 'Games' });
    await expect(picks.getByRole('option')).toHaveCount(1);
    await expect(picks.getByRole('option', { name: /Racer Deluxe/ })).toBeVisible();
    await picks.getByRole('option', { name: /Racer Deluxe/ }).click();
    await expect(
      library.getByRole('complementary', { name: 'Game details' }).getByRole('button', {
        name: 'Favorite',
      }),
    ).toHaveAttribute('aria-pressed', 'true');
    await app.close();
  } finally {
    await data.remove();
    await roms.remove();
  }
});
