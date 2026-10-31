import { expect, test, type ElectronApplication } from '@playwright/test';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { appDir, freshDataDir, launch, openScope } from './launch.ts';

const FAKE_EMULATOR = join(appDir, 'test', 'fixtures', 'fake-emulator.mjs');
const LOCATION = '01900000-0000-7000-8000-00000000a001';
const EMULATOR = '01900000-0000-7000-8000-00000000e001';
const PROFILE = '01900000-0000-7000-8000-00000000f001';

const minimized = (app: ElectronApplication) =>
  app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0]?.isMinimized() ?? false);

test('US-C2, FR-EMU-4/6/10: play from the Library, see it in the log, and follow a failure to its fix', async () => {
  test.setTimeout(120_000);
  const data = await freshDataDir();
  const roms = await freshDataDir();
  try {
    // Empty placeholder files with made-up names; the folder name is the catalog default.
    await mkdir(join(roms.dir, 'Nintendo 64'));
    const demo = join(roms.dir, 'Nintendo 64', 'Homebrew Demo.z64');
    await writeFile(demo, '');
    await writeFile(join(roms.dir, 'Nintendo 64', 'Homebrew Crash.z64'), '');
    const out = join(data.dir, 'argv.json');
    // The emulator is node running the fake emulator, which stays open for 1.5 s. The Settings UI
    // for this is covered by emulators.spec.ts; here the settings are written up front.
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
            args: [FAKE_EMULATOR, '--out', out, '--ms', '1500', '{extraArgs}', '{rom}'],
            archives: 'pass',
            env: {},
          },
        ],
      }),
    );

    const app = await launch(data.dir);
    const page = await app.firstWindow();
    await page
      .getByRole('navigation', { name: 'Desktop apps' })
      .getByRole('button', { name: 'Game Library' })
      .dblclick();
    const library = page.getByRole('dialog', { name: 'Game Library' });
    await library.getByRole('button', { name: 'Scan for games' }).click();
    // D61: the Library opens on the menu; open the system.
    await openScope(library, ['Nintendo', 'Nintendo 64']);
    const games = library.getByRole('listbox', { name: 'Games' });
    await expect(games.getByRole('option')).toHaveCount(2);

    // Play: the window is minimized while the game runs, then comes back (D4).
    await games.getByRole('option', { name: /Homebrew Demo/ }).click();
    const details = library.getByRole('complementary', { name: 'Game details' });
    await details.getByRole('button', { name: 'Play' }).click();
    await expect.poll(() => minimized(app), { timeout: 10_000 }).toBe(true);
    await expect.poll(() => minimized(app), { timeout: 20_000 }).toBe(false);
    await expect(details.getByText('Played 1 time')).toBeVisible();
    await expect(games.getByRole('option', { name: /Homebrew Demo/ })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    const recorded = JSON.parse(await readFile(out, 'utf8')) as { argv: string[] };
    expect(recorded.argv.at(-1)).toBe(demo);

    // Per-game extra arguments make the other game exit with an error at once (D5: a failure).
    await games.getByRole('option', { name: /Homebrew Crash/ }).click();
    await details.getByRole('button', { name: 'Launch options…' }).click();
    const options = page.getByRole('dialog', { name: /Launch options/ });
    await options.getByRole('textbox', { name: 'Extra arguments' }).fill('--exit\n2');
    await options.getByRole('button', { name: 'Save' }).click();
    await expect(options).toBeHidden();
    await details.getByRole('button', { name: 'Play' }).click();
    const failure = page.getByRole('dialog', { name: 'Homebrew Crash didn’t start' });
    await expect(failure.getByText('Exit code 2')).toBeVisible({ timeout: 30_000 });
    await expect.poll(() => minimized(app)).toBe(false);
    await failure.getByRole('button', { name: 'Fix in Settings' }).click();

    const settings = page.getByRole('dialog', { name: 'Settings' });
    await expect(settings.getByRole('button', { name: 'Emulators', exact: true })).toHaveAttribute(
      'aria-current',
      'page',
    );
    await expect(settings.getByRole('region', { name: 'Edit profile' })).toBeVisible();

    // The launch log has both runs, newest first (FR-EMU-10).
    await settings.getByRole('button', { name: 'Data & logs' }).click();
    const log = settings.getByRole('list', { name: 'Launch log' });
    await expect(log.getByRole('listitem')).toHaveCount(2);
    await expect(log.getByRole('listitem').first()).toContainText('Homebrew Crash');
    await expect(log.getByRole('listitem').first()).toContainText('Failed');
    await expect(log.getByRole('listitem').nth(1)).toContainText('Exit code 0');
    await app.close();
  } finally {
    await data.remove();
    await roms.remove();
  }
});
