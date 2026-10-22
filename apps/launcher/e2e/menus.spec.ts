import { expect, test } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { freshDataDir, launch } from './launch.ts';

const LOCATION = '01900000-0000-7000-8000-00000000a001';

test('FR-MENU-1, FR-MENU-3, US-D5: edit the generated menu, save, and the front-end follows', async () => {
  test.setTimeout(120_000);
  const data = await freshDataDir();
  const roms = await freshDataDir();
  try {
    // Empty placeholder files with made-up names; folder names are the catalog defaults.
    await mkdir(join(roms.dir, 'Nintendo 64'));
    await writeFile(join(roms.dir, 'Nintendo 64', 'Homebrew Alpha.z64'), '');
    await mkdir(join(roms.dir, 'Sega Genesis'));
    await writeFile(join(roms.dir, 'Sega Genesis', 'Homebrew Gamma.bin'), '');
    await writeFile(
      join(data.dir, 'settings.json'),
      JSON.stringify({
        schemaVersion: 1,
        storage: { locations: [{ id: LOCATION, name: 'Main', path: roms.dir, priority: 1 }] },
      }),
    );
    const app = await launch(data.dir);
    const page = await app.firstWindow();
    const icons = page.getByRole('navigation', { name: 'Desktop apps' });
    await icons.getByRole('button', { name: 'Game Library' }).dblclick();
    const library = page.getByRole('dialog', { name: 'Game Library' });
    await library.getByRole('button', { name: 'Scan for games' }).click();
    const games = library.getByRole('listbox', { name: 'Games' }).getByRole('option');
    // The Library lists one system at a time: one game in each.
    const librarySystems = async () => {
      for (const name of [/Nintendo 64/, /Sega Genesis/]) {
        await library.getByRole('treeitem', { name }).click();
        await expect(games).toHaveCount(1);
      }
    };
    await expect(library.getByRole('treeitem', { name: /Sega Genesis/ })).toBeVisible();
    await librarySystems();
    await library.getByRole('button', { name: 'Close' }).click();

    // FR-MENU-3: no menu is stored yet, so the editor opens the generated one.
    await icons.getByRole('button', { name: 'Menu Editor' }).dblclick();
    const editor = page.getByRole('dialog', { name: 'Menu Editor' });
    await expect(editor.getByRole('combobox', { name: 'Menu' })).toContainText('(not saved)');
    const tree = editor.getByRole('tree', { name: 'Menu tree' });
    await tree.getByRole('treeitem', { name: 'Sega', exact: true }).click();
    await page.keyboard.press('ArrowRight');
    // FR-MENU-1: drag Sega Genesis into Nintendo, then rename Nintendo.
    await tree
      .getByRole('treeitem', { name: 'Sega Genesis' })
      .dragTo(tree.getByRole('treeitem', { name: 'Nintendo', exact: true }));
    await tree.getByRole('treeitem', { name: 'Nintendo', exact: true }).click();
    await page.keyboard.press('F2');
    await tree.getByRole('textbox', { name: 'New name' }).fill('Consoles');
    await page.keyboard.press('Enter');
    await expect(tree.getByRole('treeitem', { name: 'Consoles' })).toBeVisible();
    await editor.getByRole('button', { name: 'Save' }).click();
    await expect(editor.getByRole('combobox', { name: 'Menu' })).toContainText('(active)');
    await editor.getByRole('button', { name: 'Close' }).click();

    // The front-end shows the new structure: Consoles › Nintendo 64, Sega Genesis.
    await page.getByRole('button', { name: 'Front-end' }).click();
    const layer = page.getByTestId('frontend-layer');
    await expect(layer).toBeVisible();
    const card = layer.locator('.bigbox-card');
    await expect(card).toContainText('Consoles');
    await page.keyboard.press('Enter');
    await expect(card).toContainText('Nintendo 64');
    await page.keyboard.press('ArrowRight');
    await expect(card).toContainText('Sega Genesis');
    await page.keyboard.press('KeyM');
    await expect(layer).toBeHidden();

    // The Library is untouched by menu edits.
    await icons.getByRole('button', { name: 'Game Library' }).dblclick();
    await librarySystems();
    await app.close();
  } finally {
    await data.remove();
    await roms.remove();
  }
});
