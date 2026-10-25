import { expect, test } from '@playwright/test';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { FAKE_DEV, FAKE_USER, startFakeScreenScraper, tinyPng } from './fakeScreenScraper.ts';
import { freshDataDir, launch } from './launch.ts';

test('US-C5, FR-SCR-1, FR-SCR-5: Scrape… writes box art beside the ROMs and the Library shows it', async () => {
  test.setTimeout(90_000);
  const data = await freshDataDir();
  const roms = await freshDataDir();
  const box = tinyPng();
  let base = '';
  const auth = `devid=${FAKE_DEV.id}&devpassword=${FAKE_DEV.password}`;
  // An invented game; the hash lookup misses, so the dialog falls back to the title search.
  const jeu = () => ({
    id: '700',
    noms: [{ region: 'us', text: 'Homebrew Demo' }],
    regions: [{ nom: 'usa' }],
    systeme: { id: '14' },
    dates: [{ region: 'wor', text: '1999-01-01' }],
    genres: [{ noms: [{ langue: 'en', text: 'Demo' }] }],
    medias: [
      {
        type: 'box-2D',
        region: 'us',
        url: `${base}/mediaJeu.php?${auth}&media=box`,
        format: 'png',
      },
    ],
  });
  const ssuser = { id: FAKE_USER.id, maxthreads: '1' };
  const server = await startFakeScreenScraper({
    'jeuInfos.php': (params) =>
      params.get('gameid') === '700'
        ? { body: { response: { jeu: jeu(), ssuser } } }
        : { status: 404 },
    'jeuRecherche.php': () => ({ body: { response: { jeux: [jeu()], ssuser } } }),
    'mediaJeu.php': () => ({ bytes: box, contentType: 'image/png' }),
  });
  base = server.url;
  try {
    await mkdir(join(roms.dir, 'Nintendo 64'));
    await writeFile(join(roms.dir, 'Nintendo 64', 'Homebrew Demo.z64'), 'DEMO');

    const app = await launch(data.dir, {
      NEXTLEVEL_E2E_PICK_FOLDER: roms.dir,
      NEXTLEVEL_SCREENSCRAPER_URL: server.url,
    });
    const page = await app.firstWindow();
    await page.evaluate(
      async ({ dev, user }) => {
        const result = await window.nextlevel?.invoke('scraper.credentials.set', {
          devId: dev.id,
          devPassword: dev.password,
          user: user.id,
          password: user.password,
        });
        if (!result?.ok) throw new Error('credentials not saved');
      },
      { dev: FAKE_DEV, user: FAKE_USER },
    );
    await page
      .getByRole('navigation', { name: 'Desktop apps' })
      .getByRole('button', { name: 'Settings' })
      .dblclick();
    const settings = page.getByRole('dialog', { name: 'Settings' });
    await settings.getByRole('button', { name: 'Storage' }).click();
    await settings.getByRole('button', { name: 'Add location…' }).click();
    await settings.getByRole('button', { name: 'Save' }).click();
    await expect(settings.getByRole('region', { name: 'You have unsaved changes.' })).toBeHidden();
    await settings.getByRole('button', { name: 'Close' }).click();

    await page
      .getByRole('navigation', { name: 'Desktop apps' })
      .getByRole('button', { name: 'Game Library' })
      .dblclick();
    const library = page.getByRole('dialog', { name: 'Game Library' });
    await library.getByRole('button', { name: 'Scan for games' }).click();
    const games = library.getByRole('listbox', { name: 'Games' });
    await games.getByRole('option', { name: /Homebrew Demo/ }).click({ button: 'right' });
    await page.getByRole('menuitem', { name: 'Scrape…' }).click();

    const dialog = library.getByRole('dialog', { name: 'Scrape: Homebrew Demo' });
    await expect(dialog.getByRole('radio', { name: /Homebrew Demo/ })).toBeChecked();
    await expect(dialog.getByRole('checkbox', { name: 'Box front' })).toBeChecked();
    await dialog.getByRole('button', { name: 'Apply' }).click();
    await expect(dialog).toBeHidden();

    const details = library.getByRole('complementary', { name: 'Game details' });
    const art = details.getByRole('img', { name: 'Homebrew Demo' });
    await expect(art).toHaveAttribute('src', /^nextlevel:\/\/media\/\d+\/box-front\?v=\d+$/);
    await expect.poll(() => art.evaluate((img: HTMLImageElement) => img.naturalWidth)).toBe(1);
    await expect(details.getByText(/^Scraped /)).toBeVisible();
    await expect(details.getByText('Demo', { exact: true })).toBeVisible();

    const written = await readFile(
      join(roms.dir, 'Nintendo 64', 'media', 'box-front', 'Homebrew Demo.png'),
    );
    expect(written.equals(box)).toBe(true);
    // The credentials never reached the renderer.
    expect(await page.content()).not.toContain(FAKE_DEV.password);
    await app.close();
  } finally {
    await server.close();
    await data.remove();
    await roms.remove();
  }
});
