import { expect, test, type ElectronApplication } from '@playwright/test';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { appDir, freshDataDir, launch } from './launch.ts';

const FAKE_EMULATOR = join(appDir, 'test', 'fixtures', 'fake-emulator.mjs');
const LOCATION = '01900000-0000-7000-8000-00000000a001';
const EMULATOR = '01900000-0000-7000-8000-00000000e001';
const PROFILE = '01900000-0000-7000-8000-00000000f001';

const minimized = (app: ElectronApplication) =>
  app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0]?.isMinimized() ?? false);

test('FR-THM-1, FR-THM-5, US-C2: boot into Big Box, play, back on the same game, desktop and back', async () => {
  test.setTimeout(150_000);
  const data = await freshDataDir();
  const roms = await freshDataDir();
  try {
    // Empty placeholder files with made-up names; the folder name is the catalog default.
    await mkdir(join(roms.dir, 'Nintendo 64'));
    await writeFile(join(roms.dir, 'Nintendo 64', 'Homebrew Alpha.z64'), '');
    const beta = join(roms.dir, 'Nintendo 64', 'Homebrew Beta.z64');
    await writeFile(beta, '');
    const out = join(data.dir, 'argv.json');
    await writeFile(
      join(data.dir, 'settings.json'),
      JSON.stringify({
        schemaVersion: 1,
        storage: { locations: [{ id: LOCATION, name: 'Main', path: roms.dir, priority: 1 }] },
        emulators: [{ id: EMULATOR, name: 'Fake', executable: process.execPath }],
        profiles: [
          {
            id: PROFILE,
            name: 'Fake N64',
            emulatorId: EMULATOR,
            systems: ['nintendo-64'],
            args: [FAKE_EMULATOR, '--out', out, '--ms', '1500', '{rom}'],
            archives: 'pass',
            env: {},
          },
        ],
      }),
    );

    // D1: with no games yet the launcher starts on the desktop. Scan, then start again.
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

    // FR-THM-5: now it boots into the last theme, Big Box the first time.
    app = await launch(data.dir);
    page = await app.firstWindow();
    const layer = page.getByTestId('frontend-layer');
    await expect(layer).toBeVisible();
    await expect(layer).toHaveAttribute('data-theme', 'big-box');
    const card = layer.locator('.bigbox-card');
    await expect(card).toContainText('Nintendo');

    // Nintendo → Nintendo 64 → the second game, with the keyboard.
    await page.keyboard.press('Enter');
    await expect(card).toContainText('Nintendo 64');
    await page.keyboard.press('Enter');
    await expect(card).toContainText('Homebrew Alpha');
    await page.keyboard.press('ArrowRight');
    await expect(card).toContainText('Homebrew Beta');

    // US-C2: Play minimizes the window; when the game closes the front-end is back on the game.
    await page.keyboard.press('Enter');
    await expect.poll(() => minimized(app), { timeout: 10_000 }).toBe(true);
    await expect.poll(() => minimized(app), { timeout: 20_000 }).toBe(false);
    await expect(layer.getByRole('status', { name: 'Playing' })).toBeHidden();
    await expect(card).toContainText('Homebrew Beta');
    const recorded = JSON.parse(await readFile(out, 'utf8')) as { argv: string[] };
    expect(recorded.argv.at(-1)).toBe(beta);
    await page.keyboard.press('ArrowLeft');
    await expect(card).toContainText('Homebrew Alpha');

    // FR-THM-3: M goes to the desktop; the taskbar's Front-end button comes back to the same game.
    await page.keyboard.press('KeyM');
    await expect(layer).toBeHidden();
    await page
      .getByRole('navigation', { name: 'Taskbar' })
      .getByRole('button', { name: 'Front-end' })
      .click();
    await expect(layer).toBeVisible();
    await expect(card).toContainText('Homebrew Alpha');

    // Back up to the root, then back opens the theme menu; Desktop leaves the front-end.
    await page.keyboard.press('Escape');
    await page.keyboard.press('Escape');
    await expect(card).toContainText('Nintendo');
    await page.keyboard.press('Escape');
    const menu = page.getByRole('dialog', { name: 'Theme menu' });
    await expect(menu).toBeVisible();
    await page.keyboard.press('Enter');
    await expect(layer).toBeHidden();
    await app.close();
  } finally {
    await data.remove();
    await roms.remove();
  }
});
