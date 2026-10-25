import { expect, test, type Page } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import {
  FAKE_DEV,
  FAKE_USER,
  startFakeScreenScraper,
  tinyPng,
  type FakeRoute,
} from './fakeScreenScraper.ts';
import { freshDataDir, launch } from './launch.ts';

// Invented games only. A generous per-minute limit keeps the client's request spacing short.
const SSUSER = { id: FAKE_USER.id, maxthreads: '1', maxrequestspermin: '6000' };
const ROMS = ['Hash Hit', 'Single Match', 'Ambiguous Pair', 'Nothing Here'];

function routes(base: () => string): Record<string, FakeRoute> {
  const auth = `devid=${FAKE_DEV.id}&devpassword=${FAKE_DEV.password}`;
  const jeu = (id: number, name: string) => ({
    id: String(id),
    noms: [{ region: 'us', text: name }],
    regions: [{ nom: 'usa' }],
    systeme: { id: '14' },
    medias: [
      {
        type: 'box-2D',
        region: 'us',
        url: `${base()}/mediaJeu.php?${auth}&id=${String(id)}`,
        format: 'png',
      },
    ],
  });
  // Built per request: the media URLs need the server's address, known only once it listens.
  const names: Record<number, string> = {
    800: 'Hash Hit',
    801: 'Single Match',
    802: 'Ambiguous Pair',
    803: 'Ambiguous Pair II',
  };
  const game = (id: number) => (names[id] ? jeu(id, names[id]) : undefined);
  const answer = (payload: Record<string, unknown>) => ({
    body: { response: { ...payload, ssuser: SSUSER } },
  });
  return {
    'jeuInfos.php': (params) => {
      if (params.get('crc')) {
        return params.get('romnom') === 'Hash Hit.z64'
          ? answer({ jeu: game(800) })
          : { status: 404 };
      }
      const found = game(Number(params.get('gameid')));
      return found ? answer({ jeu: found }) : { status: 404 };
    },
    'jeuRecherche.php': (params) => {
      const query = params.get('recherche') ?? '';
      if (query === 'single match') return answer({ jeux: [game(801)] });
      if (query === 'ambiguous pair') return answer({ jeux: [game(802), game(803)] });
      return answer({ jeux: [] });
    },
    'mediaJeu.php': () => ({ bytes: tinyPng(), contentType: 'image/png' }),
  };
}

async function prepare(page: Page) {
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
  await expect(library.getByRole('listbox', { name: 'Games' }).getByRole('option')).toHaveCount(4);
  return library;
}

async function startBatch(page: Page) {
  const library = page.getByRole('dialog', { name: 'Game Library' });
  await library.getByRole('button', { name: 'Scrape', exact: true }).click();
  await page.getByRole('menuitem', { name: 'Scrape Nintendo 64…' }).click();
  const rules = library.getByRole('dialog', { name: 'Scrape Nintendo 64' });
  await rules.getByRole('button', { name: 'Start' }).click();
  await expect(rules).toBeHidden();
}

async function setupRoms() {
  const roms = await freshDataDir();
  await mkdir(join(roms.dir, 'Nintendo 64'));
  for (const name of ROMS) {
    await writeFile(join(roms.dir, 'Nintendo 64', `${name}.z64`), `rom ${name}`);
  }
  return roms;
}

test('US-C6, FR-SCR-2, D18: a system batch applies sure matches; Needs review lists the rest until scraped', async () => {
  test.setTimeout(120_000);
  const data = await freshDataDir();
  const roms = await setupRoms();
  let base = '';
  const server = await startFakeScreenScraper(routes(() => base));
  base = server.url;
  try {
    const app = await launch(data.dir, {
      NEXTLEVEL_E2E_PICK_FOLDER: roms.dir,
      NEXTLEVEL_SCREENSCRAPER_URL: server.url,
    });
    const page = await app.firstWindow();
    const library = await prepare(page);
    await startBatch(page);
    await expect(
      library.getByText('Scraped 4 games · applied 2 · review 1 · not found 1 · failed 0'),
    ).toBeVisible({ timeout: 60_000 });
    await expect(library.getByText(/1 needs review/)).toBeVisible();

    await library.getByRole('button', { name: 'Show Needs review' }).click();
    const games = library.getByRole('listbox', { name: 'Games' });
    await expect(games.getByRole('option')).toHaveCount(1);
    await games.getByRole('option', { name: /Ambiguous Pair/ }).click({ button: 'right' });
    await page.getByRole('menuitem', { name: 'Scrape…' }).click();
    const dialog = library.getByRole('dialog', { name: 'Scrape: Ambiguous Pair' });
    await dialog
      .getByRole('radio', { name: /^Ambiguous Pair usa?/ })
      .first()
      .check();
    await expect(dialog.getByRole('checkbox', { name: 'Box front' })).toBeChecked();
    await dialog.getByRole('button', { name: 'Apply' }).click();
    await expect(dialog).toBeHidden();
    await expect(games.getByRole('option')).toHaveCount(0);
    await app.close();
  } finally {
    await server.close();
    await data.remove();
    await roms.remove();
  }
});

test('Review Focus 4: the daily quota running out pauses the batch and says when it resumes', async () => {
  test.setTimeout(120_000);
  const data = await freshDataDir();
  const roms = await setupRoms();
  let base = '';
  let requests = 0;
  const normal = routes(() => base);
  const counted = Object.fromEntries(
    Object.entries(normal).map(([endpoint, route]) => [
      endpoint,
      (params: URLSearchParams) => {
        requests += 1;
        return requests > 2 ? { status: 430 } : route(params);
      },
    ]),
  );
  const server = await startFakeScreenScraper(counted);
  base = server.url;
  try {
    const app = await launch(data.dir, {
      NEXTLEVEL_E2E_PICK_FOLDER: roms.dir,
      NEXTLEVEL_SCREENSCRAPER_URL: server.url,
    });
    const page = await app.firstWindow();
    const library = await prepare(page);
    await startBatch(page);
    await expect(library.getByText(/Daily quota reached — resumes at/)).toBeVisible({
      timeout: 60_000,
    });
    await expect(library.getByRole('button', { name: 'Resume' })).toBeVisible();
    await app.close();
  } finally {
    await server.close();
    await data.remove();
    await roms.remove();
  }
});
