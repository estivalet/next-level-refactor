import { defaultSettings, SystemSettingsSchema } from '@nextlevel/shared';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { GameRepository } from '../library/GameRepository.ts';
import { MediaRepository } from '../library/MediaRepository.ts';
import { ScrapeRepository } from '../library/ScrapeRepository.ts';
import { seedGames, tempLibrary } from '../library/testing.ts';
import { MediaWriter } from '../scraper/MediaWriter.ts';
import { buildIndex } from './buildIndex.ts';
import { LaunchBoxIndex } from './LaunchBoxIndex.ts';
import { LAUNCHBOX_IMAGES_URL, LaunchBoxScrapeService } from './LaunchBoxScrapeService.ts';
import { writeFixtureZip } from './testing.ts';

const cleanups: Array<() => Promise<void> | void> = [];
afterEach(async () => {
  for (const cleanup of cleanups.splice(0).reverse()) await cleanup();
});

const NOW = new Date('2026-11-02T12:00:00.000Z');
const png = (tag: string) =>
  Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.from(tag)]);

async function setup(options: { platform?: string | null; index?: boolean } = {}) {
  const library = await tempLibrary();
  cleanups.push(library.cleanup);
  const zip = join(library.dir, 'Metadata.zip');
  writeFixtureZip(zip);
  await buildIndex(zip, join(library.dir, 'launchbox.db'));
  const index = LaunchBoxIndex.open(join(library.dir, 'launchbox.db'));
  if (!index) throw new Error('no index');
  cleanups.push(() => {
    index.close();
  });
  const romDir = join(library.dir, 'roms');
  const settings = defaultSettings();
  settings.storage.locations = [{ id: 'loc-1', name: 'Roms', path: romDir, priority: 1 }];
  settings.systems['microsoft-xbox-360'] = SystemSettingsSchema.parse({ enabled: true });
  const [gameId = 0] = seedGames(library.db, 'microsoft-xbox-360', [
    { title: 'Ace Driver Collection', relPath: 'Ace Driver Collection (World).iso' },
  ]);
  const fetched: string[] = [];
  const fetch = ((url: string | URL) => {
    const text = String(url);
    fetched.push(text);
    const name = text.slice(LAUNCHBOX_IMAGES_URL.length);
    if (name.startsWith('87528771')) return Promise.resolve(new Response(null, { status: 404 }));
    if (name.startsWith('ce24b0f1')) {
      return Promise.resolve(new Response('<html>nope</html>', { status: 200 }));
    }
    return Promise.resolve(new Response(new Uint8Array(png(name)), { status: 200 }));
  }) as typeof globalThis.fetch;
  const slept: number[] = [];
  const service = new LaunchBoxScrapeService({
    launchbox: {
      index: () => {
        if (options.index === false) {
          throw Object.assign(new Error('LAUNCHBOX_INDEX_MISSING'), {});
        }
        return index;
      },
      platformOf: () => {
        if (options.platform === null) throw new Error('NO_LAUNCHBOX_PLATFORM');
        return options.platform ?? 'Microsoft Xbox 360';
      },
    },
    fetch,
    sleep: (ms) => {
      slept.push(ms);
      return Promise.resolve();
    },
    now: () => 0,
    games: new GameRepository(library.db, (row) => join(romDir, 'Xbox 360', row.relPath)),
    media: new MediaRepository(library.db),
    scrapes: new ScrapeRepository(library.db),
    writer: new MediaWriter({ toPng: (bytes) => bytes }),
    transaction: (fn) => {
      library.db.$client.transaction(fn)();
    },
    settings: () => settings,
    system: () => ({ defaultFolderName: 'Xbox 360', scraper: {} }),
    emit: () => undefined,
    clock: () => NOW,
    blocked: () => false,
  });
  return { service, gameId, fetched, slept };
}

describe('LaunchBoxScrapeService (FR-SCR-6)', () => {
  it('search finds the game by title on its platform, with a thumbnail', async () => {
    const { service, gameId } = await setup();
    const found = await service.search({ gameId });
    expect(found.method).toBe('title');
    expect(found.candidates[0]).toEqual({
      providerGameId: 472523,
      name: 'Ace Driver Collection',
      year: '2026',
      region: null,
      similarity: 100,
      thumb: 'nextlevel://launchbox-thumb/472523',
    });
  });

  it('preview lists what LaunchBox has against what the game has', async () => {
    const { service, gameId } = await setup();
    const preview = await service.preview({ gameId, providerGameId: 472523 });
    expect(preview.art['box-front']).toEqual({ local: false, available: true });
    expect(preview.art['logo-clear'].available).toBe(true);
    expect(preview.art['box-back'].available).toBe(false);
    expect(preview.art.video.available).toBe(false);
    expect(preview.fields.developer).toEqual({ current: null, scraped: 'Wans Zai', locked: false });
    expect(preview.fields.year.scraped).toBe(2026);
  });

  it('Review Focus 4: a 404 and a non-image fail alone; the rest is written as LaunchBox', async () => {
    const { service, gameId, fetched, slept } = await setup();
    const result = await service.apply({
      gameId,
      providerGameId: 472523,
      kinds: ['box-front', 'logo-clear', 'fanart'],
      fields: ['developer', 'year'],
      provider: 'launchbox',
    });
    expect(result.written).toEqual(['box-front']);
    expect(result.failed).toEqual([
      { kind: 'logo-clear', code: 'download' },
      { kind: 'fanart', code: 'download' },
    ]);
    expect(result.game.developer).toBe('Wans Zai');
    expect(result.game.year).toBe(2026);
    expect(result.game.scrape).toMatchObject({
      provider: 'launchbox',
      status: 'scraped',
      providerGameId: 472523,
    });
    expect(fetched[0]).toBe(`${LAUNCHBOX_IMAGES_URL}e398a646-ac7b-4774-9bd7-1da3691dc35c.png`);
    // Polite: a gap between image downloads.
    expect(slept.length).toBeGreaterThanOrEqual(2);
  });

  it('missing platform and missing index pass through as errors', async () => {
    const noPlatform = await setup({ platform: null });
    await expect(noPlatform.service.search({ gameId: noPlatform.gameId })).rejects.toThrow(
      /NO_LAUNCHBOX_PLATFORM/,
    );
    const noIndex = await setup({ index: false });
    await expect(noIndex.service.search({ gameId: noIndex.gameId })).rejects.toThrow(
      /LAUNCHBOX_INDEX_MISSING/,
    );
  });

  it('thumbnail serves the candidate box image, null for an unknown id', async () => {
    const { service } = await setup();
    expect((await service.thumbnail(472523))?.mime).toBe('image/png');
    expect(await service.thumbnail(1)).toBeNull();
  });
});
