import { expect, test } from '@playwright/test';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { appDir, freshDataDir, launch } from './launch.ts';

const FAKE_EMULATOR = join(appDir, 'test', 'fixtures', 'fake-emulator.mjs');

test('US-D1, FR-EMU-5: add a custom emulator and profile, then Test launch a scanned game', async () => {
  test.setTimeout(120_000);
  const data = await freshDataDir();
  const roms = await freshDataDir();
  try {
    await mkdir(join(roms.dir, 'Nintendo 64'));
    const rom = join(roms.dir, 'Nintendo 64', 'Homebrew Demo (USA) [!].z64');
    await writeFile(rom, '');
    const out = join(data.dir, 'argv.json');

    // The "emulator" is node running the fake emulator script, which records its argv.
    const app = await launch(data.dir, {
      NEXTLEVEL_E2E_PICK_FOLDER: roms.dir,
      NEXTLEVEL_E2E_PICK_FILE: process.execPath,
    });
    const page = await app.firstWindow();
    await page
      .getByRole('navigation', { name: 'Desktop apps' })
      .getByRole('button', { name: 'Settings' })
      .dblclick();
    const settings = page.getByRole('dialog', { name: 'Settings' });
    const saved = settings.getByRole('region', { name: 'You have unsaved changes.' });

    await settings.getByRole('button', { name: 'Storage' }).click();
    await settings.getByRole('button', { name: 'Add location…' }).click();
    await settings.getByRole('button', { name: 'Save' }).click();
    await expect(saved).toBeHidden();
    await settings.getByRole('button', { name: 'Scan now' }).click();
    await expect(settings.getByText(/1 games? in 1 system/)).toBeVisible();

    await settings.getByRole('button', { name: 'Emulators', exact: true }).click();
    await settings.getByRole('button', { name: 'Add emulator…' }).click();
    const add = page.getByRole('dialog', { name: 'Add emulator' });
    await add.getByRole('button', { name: 'Choose program…' }).click();
    await add.getByRole('button', { name: 'Add', exact: true }).click();

    await settings.getByRole('button', { name: 'New profile' }).click();
    const editor = settings.getByRole('region', { name: 'Edit profile' });
    await editor.getByRole('searchbox', { name: 'Search systems' }).fill('nintendo 64');
    await editor.getByRole('checkbox', { name: 'Nintendo 64', exact: true }).check();
    await editor.getByRole('textbox', { name: 'Argument 1' }).fill(FAKE_EMULATOR);
    for (const [n, value] of [
      [2, '--out'],
      [3, out],
      [4, '{rom}'],
    ] as const) {
      await editor.getByRole('button', { name: 'Add argument' }).click();
      await editor.getByRole('textbox', { name: `Argument ${String(n)}` }).fill(value);
    }
    await settings.getByRole('button', { name: 'Save' }).click();
    await expect(saved).toBeHidden();

    await editor.getByRole('searchbox', { name: 'Search a game' }).fill('homebrew');
    await editor.getByRole('button', { name: /Homebrew Demo/ }).click();
    await editor.getByRole('button', { name: 'Test launch' }).click();
    await expect(editor.getByText('Exit code 0')).toBeVisible({ timeout: 30_000 });

    const recorded = JSON.parse(await readFile(out, 'utf8')) as { argv: string[] };
    expect(recorded.argv).toEqual(['--out', out, rom]);
    await app.close();
  } finally {
    await data.remove();
    await roms.remove();
  }
});
