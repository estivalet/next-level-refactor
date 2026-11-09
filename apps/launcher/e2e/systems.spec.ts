import { expect, test, type Page } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { freshDataDir, launch } from './launch.ts';

async function openSettingsSection(page: Page, section: string) {
  await page
    .getByRole('navigation', { name: 'Desktop apps' })
    .getByRole('button', { name: 'Settings' })
    .dblclick();
  const settings = page.getByRole('dialog', { name: 'Settings' });
  await settings.getByRole('button', { name: section }).click();
  return settings;
}

test('FR-EMU-1/FR-LIB-1/FR-LIB-2: enable a system, override its folder, add storage; all persist', async () => {
  const data = await freshDataDir();
  const roms = await freshDataDir();
  try {
    let app = await launch(data.dir, { NEXTLEVEL_E2E_PICK_FOLDER: roms.dir });
    let page = await app.firstWindow();

    // Systems: enable Nintendo 64 and rename its ROM folder.
    let settings = await openSettingsSection(page, 'Systems');
    await settings.getByRole('searchbox', { name: 'Search systems' }).fill('nintendo 64');
    await settings.getByRole('switch', { name: 'Enable Nintendo 64', exact: true }).click();
    await settings.getByRole('button', { name: 'Edit Nintendo 64', exact: true }).click();
    await settings.getByRole('textbox', { name: 'ROM folder name' }).fill('N64');
    await settings.getByRole('button', { name: 'Save' }).click();
    // While saving the button reads "Saving…"; the bar itself goes only once main has written.
    await expect(settings.getByRole('region', { name: 'You have unsaved changes.' })).toBeHidden();

    // Storage: add the (stubbed) picked folder.
    await settings.getByRole('button', { name: 'Storage' }).click();
    await settings.getByRole('button', { name: 'Add location…' }).click();
    await expect(settings.getByText(roms.dir)).toBeVisible();
    await settings.getByRole('button', { name: 'Save' }).click();
    // While saving the button reads "Saving…"; the bar itself goes only once main has written.
    await expect(settings.getByRole('region', { name: 'You have unsaved changes.' })).toBeHidden();
    await app.close();

    // Restart: everything was read back from settings.json.
    app = await launch(data.dir);
    page = await app.firstWindow();
    settings = await openSettingsSection(page, 'Systems');
    await settings.getByRole('searchbox', { name: 'Search systems' }).fill('nintendo 64');
    await expect(
      settings.getByRole('switch', { name: 'Enable Nintendo 64', exact: true }),
    ).toHaveAttribute('aria-checked', 'true');
    await expect(settings.getByText('Nintendo · Folder: N64')).toBeVisible();
    await settings.getByRole('button', { name: 'Storage' }).click();
    await expect(settings.getByText(roms.dir)).toBeVisible();
    await app.close();
  } finally {
    await data.remove();
    await roms.remove();
  }
});

test('FR-EMU-11, FR-LIB-3: add a custom system; it persists and scanning just it finds its game', async () => {
  const data = await freshDataDir();
  const roms = await freshDataDir();
  try {
    // An empty placeholder file with a made-up name.
    await mkdir(join(roms.dir, 'Nintendo Switch 2'));
    await writeFile(join(roms.dir, 'Nintendo Switch 2', 'Homebrew Demo.xci'), '');
    let app = await launch(data.dir, { NEXTLEVEL_E2E_PICK_FOLDER: roms.dir });
    let page = await app.firstWindow();

    let settings = await openSettingsSection(page, 'Systems');
    await settings.getByRole('button', { name: 'Add system' }).click();
    const form = settings.getByRole('form', { name: 'New system' });
    await form.getByRole('textbox', { name: 'Name' }).fill('Nintendo Switch 2');
    await form.getByRole('textbox', { name: 'File extensions' }).fill('xci, nsp');
    await form.getByRole('button', { name: 'Add' }).click();
    const editor = settings.getByRole('region', { name: 'Nintendo Switch 2' });
    await editor.getByRole('textbox', { name: 'Manufacturer' }).fill('Nintendo');
    await settings.getByRole('button', { name: 'Save' }).click();
    await expect(settings.getByRole('region', { name: 'You have unsaved changes.' })).toBeHidden();

    await settings.getByRole('button', { name: 'Storage' }).click();
    await settings.getByRole('button', { name: 'Add location…' }).click();
    await settings.getByRole('button', { name: 'Save' }).click();
    await expect(settings.getByRole('region', { name: 'You have unsaved changes.' })).toBeHidden();
    await app.close();

    // Restart: the system was read back from settings.json, and a scan finds its game.
    app = await launch(data.dir);
    page = await app.firstWindow();
    settings = await openSettingsSection(page, 'Systems');
    await settings.getByRole('searchbox', { name: 'Search systems' }).fill('switch 2');
    await expect(settings.getByText('Custom · Nintendo · Folder: Nintendo Switch 2')).toBeVisible();
    await expect(settings.getByText('1 of 448 enabled')).toBeVisible();
    // FR-LIB-3: scan just this system from its editor.
    await settings.getByRole('button', { name: 'Edit Nintendo Switch 2' }).click();
    await settings.getByRole('button', { name: 'Scan Nintendo Switch 2' }).click();
    await expect(settings.getByText('1 game in 1 system · 1 new')).toBeVisible();
    await app.close();
  } finally {
    await data.remove();
    await roms.remove();
  }
});
