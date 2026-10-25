import {
  defaultSettings,
  SystemSettingsSchema,
  type IpcEvent,
  type Settings,
} from '@nextlevel/shared';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { GameRepository } from '../library/GameRepository.ts';
import { MediaRepository } from '../library/MediaRepository.ts';
import { ScrapeRepository } from '../library/ScrapeRepository.ts';
import { appErrorOfAsync, seedGames, tempLibrary } from '../library/testing.ts';
import { MediaWriter } from './MediaWriter.ts';
import { ScrapeService } from './ScrapeService.ts';
import { ScraperCache } from './screenscraper/cache.ts';
import { ScreenScraperClient } from './screenscraper/client.ts';
import { QuotaGate } from './screenscraper/quota.ts';
import type { SsGame } from './screenscraper/types.ts';
import { apiBody, fakeScreenScraper, ssGame, TEST_CREDENTIALS, type FakeRoute } from './testing.ts';

const cleanups: Array<() => Promise<void>> = [];
afterEach(async () => {
  for (const cleanup of cleanups.splice(0)) await cleanup();
});

const NOW = new Date(Date.UTC(2026, 9, 25, 12));
const HASH_HIT = { size: 3, crc: 'aaaaaaaa', md5: 'm', sha1: 's' };

/** An invented game with every field and three media kinds. */
const RACER: SsGame = ssGame(500, 'Zoom Racer', {
  synopsis: [{ langue: 'en', text: 'Drive fast.' }],
  dates: [{ region: 'wor', text: '1994-03-01' }],
  developpeur: { text: 'Dev Co' },
  editeur: { text: 'Pub Co' },
  genres: [{ noms: [{ langue: 'en', text: 'Racing' }] }],
  joueurs: { text: '1-2' },
  note: { text: '16' },
  medias: [
    {
      type: 'box-2D',
      region: 'us',
      url: 'https://m.invalid/mediaJeu.php?devid=dev-id&devpassword=dev-pw&media=box',
      format: 'jpg',
    },
    {
      type: 'wheel',
      region: 'us',
      url: 'https://m.invalid/mediaJeu.php?devid=dev-id&media=wheel',
      format: 'png',
    },
    {
      type: 'video',
      region: 'us',
      url: 'https://m.invalid/mediaJeu.php?devid=dev-id&media=video',
      format: 'mp4',
    },
  ],
});

/** Invented image bytes: a JPEG signature, then a tag. */
const img = (tag: string) => Buffer.concat([Buffer.from([0xff, 0xd8, 0xff]), Buffer.from(tag)]);

interface Options {
  /** A scan or import is running (apply must refuse). */
  blocked?: boolean;
  routes?: Record<string, FakeRoute>;
  hash?: typeof HASH_HIT | null;
  settings?: (s: Settings) => void;
  game?: { title: string; relPath: string; missing?: boolean };
}

async function setup(options: Options = {}) {
  const library = await tempLibrary();
  cleanups.push(library.cleanup);
  const romDir = join(library.dir, 'roms');
  const settings = defaultSettings();
  settings.storage.locations = [{ id: 'loc-1', name: 'Roms', path: romDir, priority: 1 }];
  settings.systems.snes = SystemSettingsSchema.parse({ enabled: true, screenscraperId: 4 });
  options.settings?.(settings);
  const game = options.game ?? { title: 'Zoom Racer', relPath: 'Zoom Racer (USA).sfc' };
  const [gameId = 0] = seedGames(library.db, 'snes', [game]);
  const routes: Record<string, FakeRoute> = {
    'jeuInfos.php': (params) => {
      if (params.get('crc')) {
        return params.get('crc') === HASH_HIT.crc
          ? { body: apiBody({ jeu: RACER }) }
          : { status: 404 };
      }
      return params.get('gameid') === '500' ? { body: apiBody({ jeu: RACER }) } : { status: 404 };
    },
    'jeuRecherche.php': () => ({ body: apiBody({ jeux: [RACER, ssGame(501, 'Zoom Racer II')] }) }),
    'mediaJeu.php': (params) => ({
      body: img(params.get('media') ?? ''),
      contentType: 'image/jpeg',
    }),
    ...options.routes,
  };
  const server = fakeScreenScraper(routes);
  const client = new ScreenScraperClient({
    fetch: server.fetch,
    credentials: () => Promise.resolve(TEST_CREDENTIALS),
    baseUrl: 'https://api.invalid/api2',
    cache: new ScraperCache(':memory:', () => NOW.getTime(), { warn: () => undefined }),
    quota: new QuotaGate({
      clock: () => NOW.getTime(),
      sleep: () => Promise.resolve(),
      minIntervalMs: 0,
    }),
    sleep: () => Promise.resolve(),
  });
  const games = new GameRepository(library.db, (row) =>
    join(romDir, 'Super Nintendo', row.relPath),
  );
  const media = new MediaRepository(library.db);
  const scrapes = new ScrapeRepository(library.db);
  const events: Array<{ event: IpcEvent; payload: unknown }> = [];
  const hashed: string[] = [];
  const service = new ScrapeService({
    client,
    games,
    media,
    scrapes,
    writer: new MediaWriter({ toPng: (bytes) => Buffer.concat([Buffer.from('PNG:'), bytes]) }),
    transaction: (fn) => {
      library.db.$client.transaction(fn)();
    },
    settings: () => settings,
    system: () => ({ defaultFolderName: 'Super Nintendo', scraper: {} }),
    hash: (path) => {
      hashed.push(path);
      return Promise.resolve(options.hash === undefined ? null : options.hash);
    },
    emit: (event, payload) => {
      events.push({ event, payload });
    },
    clock: () => NOW,
    blocked: () => options.blocked ?? false,
  });
  const mediaDir = join(romDir, 'Super Nintendo', 'media');
  return {
    library,
    service,
    server,
    games,
    media,
    scrapes,
    events,
    hashed,
    gameId,
    mediaDir,
    settings,
  };
}

describe('ScrapeService.search (FR-SCR-1, US-C5)', () => {
  it('a hash match is the one candidate, method hash, similarity 100', async () => {
    const { service, gameId } = await setup({ hash: HASH_HIT });
    const result = await service.search({ gameId });
    expect(result.method).toBe('hash');
    expect(result.candidates).toEqual([
      {
        providerGameId: 500,
        name: 'Zoom Racer',
        year: '1994',
        region: 'us',
        similarity: 100,
        thumb: 'nextlevel://scrape-thumb/500',
      },
    ]);
  });

  it('a hash miss falls back to the title search', async () => {
    const { service, gameId, server } = await setup({ hash: { ...HASH_HIT, crc: 'bbbbbbbb' } });
    const result = await service.search({ gameId });
    expect(result.method).toBe('title');
    expect(result.candidates.map((c) => c.providerGameId)).toContain(500);
    expect(server.callsTo('jeuRecherche.php')[0]?.searchParams.get('recherche')).toBe('zoom racer');
  });

  it('a missing game and a typed title never hash', async () => {
    const missing = await setup({
      hash: HASH_HIT,
      game: { title: 'Zoom Racer', relPath: 'Zoom Racer.sfc', missing: true },
    });
    expect((await missing.service.search({ gameId: missing.gameId })).method).toBe('title');
    expect(missing.hashed).toEqual([]);
    const typed = await setup({ hash: HASH_HIT });
    await typed.service.search({ gameId: typed.gameId, title: 'Zoom Racer II' });
    expect(typed.hashed).toEqual([]);
    expect(typed.server.callsTo('jeuRecherche.php')[0]?.searchParams.get('recherche')).toBe(
      'zoom racer ii',
    );
  });

  it('a system without a ScreenScraper id is NO_SCRAPER_SYSTEM', async () => {
    const { service, gameId } = await setup({
      settings: (s) => {
        s.systems.snes = SystemSettingsSchema.parse({ enabled: true });
      },
    });
    expect((await appErrorOfAsync(() => service.search({ gameId }))).code).toBe(
      'NO_SCRAPER_SYSTEM',
    );
  });

  it('Review Focus 3: no output string holds a credential or an http URL', async () => {
    const { service, gameId } = await setup();
    const result = await service.search({ gameId });
    const preview = await service.preview({ gameId, providerGameId: 500 });
    const text = JSON.stringify([result, preview]);
    expect(text).not.toMatch(/devpassword|dev-pw|http/i);
    expect(
      result.candidates.every((c) => c.thumb === null || c.thumb.startsWith('nextlevel://')),
    ).toBe(true);
  });

  it('thumbnail serves the box of a listed candidate and nothing else', async () => {
    const { service, gameId } = await setup();
    await service.search({ gameId });
    const thumb = await service.thumbnail(500);
    expect(thumb?.bytes.equals(img('box'))).toBe(true);
    expect(thumb?.mime).toBe('image/jpeg');
    expect(await service.thumbnail(999)).toBeNull();
  });
});

describe('ScrapeService.preview (FR-SCR-1, D19)', () => {
  it('marks local art from the media index and locked fields from the game', async () => {
    const { service, gameId, games, media } = await setup();
    media.upsert({ gameId, kind: 'box-front', path: 'C:/x.png', size: 1, version: 1 });
    games.updateMetadata(gameId, { genre: 'Mine' }, NOW);
    const preview = await service.preview({ gameId, providerGameId: 500 });
    expect(preview.art['box-front']).toEqual({ local: true, available: true });
    expect(preview.art['logo-clear']).toEqual({ local: false, available: true });
    expect(preview.art.fanart).toEqual({ local: false, available: false });
    expect(preview.fields.genre).toEqual({ current: 'Mine', scraped: 'Racing', locked: true });
    expect(preview.fields.title).toEqual({
      current: 'Zoom Racer',
      scraped: 'Zoom Racer',
      locked: false,
    });
    expect(preview.fields.rating).toEqual({ current: null, scraped: 4, locked: false });
    expect(preview.fields.year).toEqual({ current: null, scraped: 1994, locked: false });
  });
});

describe('ScrapeService.apply (FR-SCR-1, FR-SCR-4, FR-SCR-5)', () => {
  it('writes the kinds, indexes them, applies the fields, records the status and announces it', async () => {
    const { service, gameId, mediaDir, media, scrapes, events } = await setup();
    const result = await service.apply({
      gameId,
      providerGameId: 500,
      kinds: ['box-front', 'logo-clear'],
      fields: ['genre', 'year'],
    });
    expect(result.written).toEqual(['box-front', 'logo-clear']);
    expect(result.failed).toEqual([]);
    expect(result.game).toMatchObject({ genre: 'Racing', year: 1994, lockedFields: [] });
    expect(result.game.scrape).toMatchObject({ status: 'scraped', providerGameId: 500 });
    expect(await readFile(join(mediaDir, 'box-front', 'Zoom Racer (USA).png'))).toEqual(
      Buffer.concat([Buffer.from('PNG:'), img('box')]),
    );
    expect(media.path(gameId, 'logo-clear')).toBe(
      join(mediaDir, 'logo-clear', 'Zoom Racer (USA).png'),
    );
    expect(scrapes.get(gameId)?.scrapedAt).toBe(NOW.toISOString());
    expect(events).toEqual([
      { event: 'library.changed', payload: { systems: ['snes'], gameIds: [gameId] } },
    ]);
  });

  it('Review Focus 1: re-scraping a kind bumps its media version', async () => {
    const { service, gameId, media } = await setup();
    media.upsert({ gameId, kind: 'box-front', path: 'C:/old.jpg', size: 1, version: 1 });
    await service.apply({ gameId, providerGameId: 500, kinds: ['box-front'], fields: [] });
    expect(media.versionsByGame([gameId]).get(gameId)?.['box-front']).toBeGreaterThan(1);
  });

  it('D19: a ticked locked field is written and stays locked', async () => {
    const { service, gameId, games } = await setup();
    games.updateMetadata(gameId, { genre: 'Mine' }, NOW);
    const result = await service.apply({
      gameId,
      providerGameId: 500,
      kinds: [],
      fields: ['genre'],
    });
    expect(result.game.genre).toBe('Racing');
    expect(result.game.lockedFields).toEqual(['genre']);
  });

  it('Review Focus 5: an unwritable kind fails alone; metadata and other kinds still apply', async () => {
    const { service, gameId, mediaDir } = await setup();
    await mkdir(mediaDir, { recursive: true });
    await writeFile(join(mediaDir, 'video'), 'a file where the kind folder should be');
    const result = await service.apply({
      gameId,
      providerGameId: 500,
      kinds: ['box-front', 'video', 'fanart'],
      fields: ['developer'],
    });
    expect(result.written).toEqual(['box-front']);
    expect(result.failed).toEqual([
      { kind: 'video', code: 'write' },
      { kind: 'fanart', code: 'notAvailable' },
    ]);
    expect(result.game.developer).toBe('Dev Co');
  });

  it('a failed download is reported per kind', async () => {
    const { service, gameId } = await setup({
      routes: {
        'mediaJeu.php': (params) =>
          params.get('media') === 'wheel' ? { status: 500 } : { body: img('x') },
      },
    });
    const result = await service.apply({
      gameId,
      providerGameId: 500,
      kinds: ['box-front', 'logo-clear'],
      fields: [],
    });
    expect(result.failed).toEqual([{ kind: 'logo-clear', code: 'download' }]);
  });

  it('a second apply on the same game while one runs is BUSY', async () => {
    const { service, gameId } = await setup();
    const input = { gameId, providerGameId: 500, kinds: ['box-front' as const], fields: [] };
    const first = service.apply(input);
    expect((await appErrorOfAsync(() => service.apply(input))).code).toBe('BUSY');
    await first;
    await expect(service.apply(input)).resolves.toBeDefined();
  });

  it('review: apply is BUSY while a scan or import runs (their index write would undo it)', async () => {
    const { service, gameId, server } = await setup({ blocked: true });
    const error = await appErrorOfAsync(() =>
      service.apply({ gameId, providerGameId: 500, kinds: ['box-front'], fields: [] }),
    );
    expect(error.code).toBe('BUSY');
    expect(server.calls).toEqual([]);
  });

  it('review: a game sharing the stem (another subfolder) follows the replaced file', async () => {
    const { library, service, gameId, media, mediaDir } = await setup();
    const [twin = 0] = seedGames(library.db, 'snes', [
      { title: 'Zoom Racer Hack', relPath: '!hacks/Zoom Racer (USA).sfc' },
    ]);
    await mkdir(join(mediaDir, 'box-front'), { recursive: true });
    const old = join(mediaDir, 'box-front', 'Zoom Racer (USA).jpg');
    await writeFile(old, 'old');
    media.upsert({ gameId, kind: 'box-front', path: old, size: 3, version: 1 });
    await service.apply({ gameId: twin, providerGameId: 500, kinds: ['box-front'], fields: [] });
    const versions = media.versionsByGame([gameId, twin]);
    expect(media.path(gameId, 'box-front')).toBe(
      join(mediaDir, 'box-front', 'Zoom Racer (USA).png'),
    );
    expect(versions.get(gameId)?.['box-front']).toBe(versions.get(twin)?.['box-front']);
  });

  it('review: a body that is not an image fails as download and leaves the old art alone', async () => {
    const { service, gameId, mediaDir } = await setup({
      routes: {
        'mediaJeu.php': () => ({ body: Buffer.from('NOMEDIA'), contentType: 'text/plain' }),
      },
    });
    await mkdir(join(mediaDir, 'box-front'), { recursive: true });
    const old = join(mediaDir, 'box-front', 'Zoom Racer (USA).jpg');
    await writeFile(old, 'old');
    const result = await service.apply({
      gameId,
      providerGameId: 500,
      kinds: ['box-front'],
      fields: [],
    });
    expect(result.failed).toEqual([{ kind: 'box-front', code: 'download' }]);
    expect(await readFile(old, 'utf8')).toBe('old');
  });

  it('review: when nothing was saved the status is failed, not scraped', async () => {
    const { service, gameId, mediaDir } = await setup();
    await mkdir(mediaDir, { recursive: true });
    await writeFile(join(mediaDir, 'video'), 'a file where the kind folder should be');
    const result = await service.apply({
      gameId,
      providerGameId: 500,
      kinds: ['video'],
      fields: [],
    });
    expect(result.game.scrape).toMatchObject({ status: 'failed', error: 'write' });
  });
});

describe('ScrapeService thumbnails (review)', () => {
  it('only the first candidates get a thumbnail, so they never crowd the request queue', async () => {
    const many = Array.from({ length: 12 }, (_, i) => ssGame(600 + i, `Zoom Racer ${String(i)}`));
    const { service, gameId } = await setup({
      routes: { 'jeuRecherche.php': () => ({ body: apiBody({ jeux: many }) }) },
    });
    const result = await service.search({ gameId });
    expect(result.candidates.length).toBeGreaterThan(8);
    expect(result.candidates.filter((c) => c.thumb !== null)).toHaveLength(8);
    expect(await service.thumbnail(result.candidates[10]?.providerGameId ?? 0)).toBeNull();
  });
});

describe('ScrapeService thumbnail type (M6 minor)', () => {
  it('the type comes from the bytes, not the upstream header; a non-image is not served', async () => {
    const pngBytes = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a]);
    let body = pngBytes;
    const { service, gameId } = await setup({
      routes: { 'mediaJeu.php': () => ({ body, contentType: 'text/html' }) },
    });
    await service.search({ gameId });
    expect((await service.thumbnail(500))?.mime).toBe('image/png');
    body = Buffer.from('<html>nope</html>');
    expect(await service.thumbnail(500)).toBeNull();
  });
});

describe('ScrapeService.apply for a batch (FR-SCR-2)', () => {
  it('records the candidate count and uses the batch region order', async () => {
    const both: SsGame = {
      ...RACER,
      medias: [
        {
          type: 'box-2D',
          region: 'us',
          url: 'https://m.invalid/mediaJeu.php?devid=d&media=boxus',
          format: 'png',
        },
        {
          type: 'box-2D',
          region: 'jp',
          url: 'https://m.invalid/mediaJeu.php?devid=d&media=boxjp',
          format: 'png',
        },
      ],
    };
    const { service, gameId, server } = await setup({
      routes: { 'jeuInfos.php': () => ({ body: apiBody({ jeu: both }) }) },
    });
    const result = await service.apply(
      { gameId, providerGameId: 500, kinds: ['box-front'], fields: [] },
      { candidates: 3, regions: ['jp'] },
    );
    expect(result.game.scrape?.candidates).toBe(3);
    expect(server.callsTo('mediaJeu.php').map((url) => url.searchParams.get('media'))).toEqual([
      'boxjp',
    ]);
  });
});

describe('ScrapeService.apply in a batch: transport failures (review)', () => {
  it('a quota refusal on a download rejects the whole apply, writing nothing', async () => {
    const { service, gameId, scrapes, games } = await setup({
      routes: { 'mediaJeu.php': () => ({ status: 430 }) },
    });
    const error = await appErrorOfAsync(() =>
      service.apply(
        { gameId, providerGameId: 500, kinds: ['box-front'], fields: ['genre'] },
        { batch: true },
      ),
    );
    expect(error.code).toBe('SCRAPER_QUOTA');
    expect(scrapes.get(gameId)).toBeNull();
    expect(games.get(gameId).genre).toBeNull();
  });

  it('the single-game dialog still reports it per kind', async () => {
    const { service, gameId } = await setup({
      routes: { 'mediaJeu.php': () => ({ status: 430 }) },
    });
    const result = await service.apply({
      gameId,
      providerGameId: 500,
      kinds: ['box-front'],
      fields: [],
    });
    expect(result.failed).toEqual([{ kind: 'box-front', code: 'download' }]);
  });
});

describe('ScrapeService.apply clears Needs review (FR-SCR-2)', () => {
  it('scraping a game marked for review takes it off the Needs review list', async () => {
    const { service, gameId, scrapes, games } = await setup();
    scrapes.set(gameId, {
      status: 'review',
      providerGameId: null,
      candidates: 2,
      error: null,
      scrapedAt: NOW.toISOString(),
    });
    await service.apply({ gameId, providerGameId: 500, kinds: ['box-front'], fields: [] });
    const page = games.list({
      scope: { kind: 'system', systemId: 'snes' },
      tab: 'needsReview',
      offset: 0,
      limit: 10,
    });
    expect(page.total).toBe(0);
  });
});
