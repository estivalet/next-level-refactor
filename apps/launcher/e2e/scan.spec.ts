import { expect, test } from '@playwright/test';
import { mkdir, rename, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { freshDataDir, launch } from './launch.ts';

test('FR-LIB-3, FR-LIB-4: scan finds games, then marks them missing when the folder goes away', async () => {
  const data = await freshDataDir();
  const roms = await freshDataDir();
  try {
    // Empty placeholder files with made-up names; folder names are the catalog defaults.
    await mkdir(join(roms.dir, 'Nintendo 64'));
    await mkdir(join(roms.dir, 'Sony Playstation'));
    await writeFile(join(roms.dir, 'Nintendo 64', 'Homebrew Demo.z64'), '');
    await writeFile(join(roms.dir, 'Sony Playstation', 'Demo (Disc 1).chd'), '');
    await writeFile(join(roms.dir, 'Sony Playstation', 'Demo (Disc 2).chd'), '');

    const app = await launch(data.dir, { NEXTLEVEL_E2E_PICK_FOLDER: roms.dir });
    const page = await app.firstWindow();
    await page
      .getByRole('navigation', { name: 'Desktop apps' })
      .getByRole('button', { name: 'Settings' })
      .dblclick();
    const settings = page.getByRole('dialog', { name: 'Settings' });
    await settings.getByRole('button', { name: 'Storage' }).click();
    await settings.getByRole('button', { name: 'Add location…' }).click();
    await settings.getByRole('button', { name: 'Save' }).click();
    // While saving the button reads "Saving…"; the bar itself goes only once main has written.
    await expect(settings.getByRole('region', { name: 'You have unsaved changes.' })).toBeHidden();

    await settings.getByRole('button', { name: 'Scan now' }).click();
    await expect(
      settings.getByText('2 games in 2 systems · 2 new · 2 systems turned on'),
    ).toBeVisible();

    await rename(join(roms.dir, 'Nintendo 64'), join(roms.dir, 'Nintendo 64 (away)'));
    await rename(join(roms.dir, 'Sony Playstation'), join(roms.dir, 'Sony Playstation (away)'));
    await settings.getByRole('button', { name: 'Scan now' }).click();
    await expect(settings.getByText('0 games in 2 systems · 2 missing')).toBeVisible();

    // The scan turned both systems on in Settings → Systems.
    await settings.getByRole('button', { name: 'Systems' }).click();
    await expect(settings.getByText('2 of 438 enabled')).toBeVisible();
    await app.close();
  } finally {
    await data.remove();
    await roms.remove();
  }
});
