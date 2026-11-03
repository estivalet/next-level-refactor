import { expect, test } from '@playwright/test';
import { zipSync } from 'fflate';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tinyPng } from './fakeScreenScraper.ts';
import { freshDataDir, launch, openScope } from './launch.ts';

/** A tiny LaunchBox database: one Nintendo 64 game with a box front. */
const METADATA = `<?xml version="1.0" standalone="yes"?>
<LaunchBox>
  <Game>
    <Name>Homebrew Demo</Name>
    <ReleaseDate>1999-01-01T00:00:00-03:00</ReleaseDate>
    <Overview>A demo from LaunchBox.</Overview>
    <DatabaseID>4242</DatabaseID>
    <Platform>Nintendo 64</Platform>
    <Genres>Demo</Genres>
    <Developer>LaunchBox Devs</Developer>
  </Game>
  <GameImage>
    <DatabaseID>4242</DatabaseID>
    <FileName>demo-box.png</FileName>
    <Type>Box - Front</Type>
    <Region>North America</Region>
  </GameImage>
</LaunchBox>`;

async function startFakeLaunchBox(box: Buffer) {
  const encode = (text: string) => new TextEncoder().encode(text);
  const zip = Buffer.from(
    zipSync({ 'Metadata.xml': encode(METADATA), 'Platforms.xml': encode('<LaunchBox/>') }),
  );
  const server = createServer((request, response) => {
    if (request.url === '/Metadata.zip') {
      response.writeHead(200, {
        'content-length': String(zip.length),
        etag: '"fixture"',
        'content-type': 'application/zip',
      });
      response.end(request.method === 'HEAD' ? undefined : zip);
    } else if (request.url === '/images/demo-box.png') {
      response.writeHead(200, { 'content-type': 'image/png' });
      response.end(box);
    } else {
      response.writeHead(404);
      response.end();
    }
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const url = `http://127.0.0.1:${String((server.address() as AddressInfo).port)}`;
  return {
    url,
    close: () =>
      new Promise<void>((resolve) => {
        server.close(() => {
          resolve();
        });
      }),
  };
}

test('FR-SCR-6: Scrape from LaunchBox downloads the database, then writes the box art', async () => {
  test.setTimeout(120_000);
  const data = await freshDataDir();
  const roms = await freshDataDir();
  const box = tinyPng();
  const server = await startFakeLaunchBox(box);
  try {
    await mkdir(join(roms.dir, 'Nintendo 64'));
    await writeFile(join(roms.dir, 'Nintendo 64', 'Homebrew Demo.z64'), 'DEMO');

    const app = await launch(data.dir, {
      NEXTLEVEL_E2E_PICK_FOLDER: roms.dir,
      NEXTLEVEL_LAUNCHBOX_URL: `${server.url}/Metadata.zip`,
      NEXTLEVEL_LAUNCHBOX_IMAGES: `${server.url}/images/`,
    });
    const page = await app.firstWindow();
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
    await openScope(library, ['Nintendo', 'Nintendo 64']);
    const games = library.getByRole('listbox', { name: 'Games' });
    await games.getByRole('option', { name: /Homebrew Demo/ }).click({ button: 'right' });
    await page.getByRole('menuitem', { name: 'Scrape from LaunchBox…' }).click();

    const dialog = library.getByRole('dialog', { name: 'Scrape from LaunchBox: Homebrew Demo' });
    await expect(dialog.getByText('Download the LaunchBox database (about 110 MB)?')).toBeVisible();
    await dialog.getByRole('button', { name: 'Download' }).click();
    await expect(dialog.getByRole('radio', { name: /Homebrew Demo/ })).toBeChecked({
      timeout: 30_000,
    });
    await expect(dialog.getByRole('checkbox', { name: 'Box front' })).toBeChecked();
    await dialog.getByRole('button', { name: 'Apply' }).click();
    await expect(dialog).toBeHidden();

    const details = library.getByRole('complementary', { name: 'Game details' });
    const art = details.getByRole('img', { name: 'Homebrew Demo' });
    await expect(art).toHaveAttribute('src', /^nextlevel:\/\/media\/\d+\/box-front\?v=\d+$/);
    await expect(details.getByText(/^Scraped .+ from LaunchBox$/)).toBeVisible();
    const written = await readFile(
      join(roms.dir, 'Nintendo 64', 'media', 'box-front', 'Homebrew Demo.png'),
    );
    expect(written.equals(box)).toBe(true);
    await app.close();
  } finally {
    await server.close();
    await data.remove();
    await roms.remove();
  }
});
