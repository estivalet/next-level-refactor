import { expect, test } from '@playwright/test';
import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { appDir, freshDataDir, launch, openScope } from './launch.ts';

const FAKE_EMULATOR = join(appDir, 'test', 'fixtures', 'fake-emulator.mjs');
const LOCATION = '01900000-0000-7000-8000-00000000a001';
const EMULATOR = '01900000-0000-7000-8000-00000000e001';
const PROFILE = '01900000-0000-7000-8000-00000000f001';

test('FR-EMU-9: a mounted Singe game plays and the drive is released', async () => {
  test.setTimeout(120_000);
  const data = await freshDataDir();
  const roms = await freshDataDir();
  // NEXTLEVEL_E2E_FAKE_MOUNT: "mounting" an image shows this folder as the drive.
  const mounted = await freshDataDir();
  try {
    await mkdir(join(roms.dir, 'Singe'));
    await writeFile(join(roms.dir, 'Singe', 'Agent328OB.wsquashfs'), '');
    await writeFile(join(mounted.dir, 'Agent328OB.singe'), '');
    await writeFile(join(mounted.dir, 'Agent328OB.txt'), '');
    const out = join(data.dir, 'argv.json');
    await writeFile(
      join(data.dir, 'settings.json'),
      JSON.stringify({
        schemaVersion: 1,
        storage: { locations: [{ id: LOCATION, name: 'Main', path: roms.dir, priority: 1 }] },
        emulators: [{ id: EMULATOR, name: 'Fake Hypseus', executable: process.execPath }],
        profiles: [
          {
            id: PROFILE,
            name: 'Fake Singe',
            emulatorId: EMULATOR,
            systems: ['singe'],
            args: [
              FAKE_EMULATOR,
              '--out',
              out,
              '--ms',
              '1000',
              '-framefile',
              '{gameDir}\\{romName}.txt',
              '{entryArgs}',
              '{extraArgs}',
            ],
            archives: 'pass',
            squashfs: 'mount',
            entries: [{ file: '{gameDir}\\{romName}.singe', args: ['-script', '{entry}'] }],
            env: {},
          },
        ],
      }),
    );

    const app = await launch(data.dir, { NEXTLEVEL_E2E_FAKE_MOUNT: mounted.dir });
    const page = await app.firstWindow();
    await page
      .getByRole('navigation', { name: 'Desktop apps' })
      .getByRole('button', { name: 'Game Library' })
      .dblclick();
    const library = page.getByRole('dialog', { name: 'Game Library' });
    await library.getByRole('button', { name: 'Scan for games' }).click();
    await openScope(library, ['Other', 'Singe']);
    const games = library.getByRole('listbox', { name: 'Games' });
    await games.getByRole('option', { name: /Agent328OB/ }).click();
    const details = library.getByRole('complementary', { name: 'Game details' });
    await details.getByRole('button', { name: 'Play' }).click();
    const launchScreen = page.getByRole('status', { name: 'Starting a game' });
    await expect(launchScreen).toBeVisible({ timeout: 10_000 });
    await expect(launchScreen).toBeHidden({ timeout: 20_000 });
    await expect(details.getByText('Played 1 time')).toBeVisible();

    const recorded = JSON.parse(await readFile(out, 'utf8')) as { argv: string[] };
    expect(recorded.argv.slice(-4)).toEqual([
      '-framefile',
      join(mounted.dir, 'Agent328OB.txt'),
      '-script',
      join(mounted.dir, 'Agent328OB.singe'),
    ]);
    // The fake mounter leaves this file when the launcher releases the image.
    await expect.poll(() => existsSync(join(mounted.dir, 'unmounted.txt'))).toBe(true);
    await app.close();
  } finally {
    await data.remove();
    await roms.remove();
    await mounted.remove();
  }
});
