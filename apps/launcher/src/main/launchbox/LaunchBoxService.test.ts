import {
  defaultSettings,
  SystemSettingsSchema,
  type LaunchBoxStatus,
  type Settings,
} from '@nextlevel/shared';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { tempDir } from '../library/testing.ts';
import { buildIndex } from './buildIndex.ts';
import { LAUNCHBOX_METADATA_URL, LaunchBoxService } from './LaunchBoxService.ts';
import { FIXTURE_XML_PATH, writeFixtureZip } from './testing.ts';
import { buildInWorker } from './workerBuild.ts';

const cleanups: Array<() => Promise<void> | void> = [];
afterEach(async () => {
  for (const cleanup of cleanups.splice(0).reverse()) await cleanup();
});

interface FakeServer {
  fetch: typeof fetch;
  ranges: Array<string | null>;
  /** Serve only this many bytes of the body (a cut connection). */
  cutAt: number | null;
  bytes: Buffer;
  /** The file's version (ETag); a new daily file has a new one. */
  etag: string;
}

function fakeServer(zipBytes: Buffer): FakeServer {
  const server: FakeServer = {
    ranges: [],
    cutAt: null,
    bytes: zipBytes,
    etag: '"day-1"',
    fetch: (async (url: string | URL, init?: RequestInit) => {
      // A real fetch answers on a later tick.
      await Promise.resolve();
      if (String(url) !== LAUNCHBOX_METADATA_URL) return new Response(null, { status: 404 });
      if (init?.method === 'HEAD') {
        return new Response(null, {
          status: 200,
          headers: { 'content-length': String(server.bytes.length), etag: server.etag },
        });
      }
      const range = new Headers(init?.headers).get('range');
      server.ranges.push(range);
      const start = range ? Number(/bytes=(\d+)-/.exec(range)?.[1] ?? 0) : 0;
      const end = server.cutAt ?? server.bytes.length;
      return new Response(new Uint8Array(server.bytes.subarray(start, end)), {
        status: start > 0 ? 206 : 200,
      });
    }) as typeof fetch,
  };
  return server;
}

type BuildInWorker = ConstructorParameters<typeof LaunchBoxService>[0]['buildInWorker'];

async function setup(options: { settings?: Settings; buildInWorker?: BuildInWorker } = {}) {
  const temp = await tempDir('nextlevel-launchbox-');
  cleanups.push(temp.cleanup);
  const zipPath = join(temp.dir, 'fixture.zip');
  writeFixtureZip(zipPath);
  const server = fakeServer(readFileSync(zipPath));
  const events: LaunchBoxStatus[] = [];
  const warnings: Array<{ context: object; message: string }> = [];
  let settings = options.settings ?? defaultSettings();
  const service = new LaunchBoxService({
    dataDir: temp.dir,
    fetch: server.fetch,
    emit: (_event, status) => {
      events.push(status as LaunchBoxStatus);
    },
    settings: () => settings,
    system: (id) =>
      id === 'microsoft-xbox-360'
        ? { scraper: { launchboxPlatform: 'Microsoft Xbox 360' } }
        : id === 'snes'
          ? { scraper: {} }
          : undefined,
    buildInWorker:
      options.buildInWorker ??
      ((zip, out, onProgress, signal) => buildIndex(zip, out, onProgress, signal)),
    log: {
      warn: (context, message) => {
        warnings.push({ context, message });
      },
    },
  });
  cleanups.push(() => {
    service.dispose();
  });
  return {
    service,
    server,
    events,
    warnings,
    temp: temp.dir,
    dir: join(temp.dir, 'launchbox'),
    setSettings: (next: Settings) => {
      settings = next;
    },
  };
}

describe('LaunchBoxService (FR-SCR-6)', () => {
  it('starts missing; a refresh downloads, builds, swaps in and deletes the zip', async () => {
    const { service, events, dir } = await setup();
    expect(service.status()).toMatchObject({ state: 'missing', games: 0 });
    expect(() => service.index()).toThrow(/LAUNCHBOX_INDEX_MISSING/);
    expect(service.refresh().state).toBe('downloading');
    await service.idle();
    expect(service.status()).toMatchObject({ state: 'ready', games: 3, error: null });
    expect(events.map((e) => e.state)).toContain('building');
    expect(events.at(-1)?.state).toBe('ready');
    expect(service.index().game(472523)?.name).toBe('Ace Driver Collection');
    expect(existsSync(join(dir, 'Metadata.zip'))).toBe(false);
    expect(existsSync(join(dir, 'Metadata.zip.part'))).toBe(false);
    expect(existsSync(join(dir, 'launchbox.db'))).toBe(true);
  });

  it('Review Focus 1: no refresh while a batch uses the index; a swap reopens the index', async () => {
    const { service, server } = await setup();
    service.refresh();
    await service.idle();
    const before = service.index();
    service.setBusy(true);
    expect(() => service.refresh()).toThrow(/LAUNCHBOX_BUSY/);
    service.setBusy(false);
    // A newer database with a fourth game.
    const temp = await tempDir('nextlevel-launchbox-');
    cleanups.push(temp.cleanup);
    const xml = readFileSync(FIXTURE_XML_PATH, 'utf8').replace(
      '</LaunchBox>',
      '<Game><Name>New Game</Name><DatabaseID>9</DatabaseID><Platform>Nintendo DS</Platform></Game></LaunchBox>',
    );
    writeFixtureZip(join(temp.dir, 'newer.zip'), xml);
    server.bytes = readFileSync(join(temp.dir, 'newer.zip'));
    service.refresh();
    await service.idle();
    expect(service.index()).not.toBe(before);
    expect(service.index().game(9)?.name).toBe('New Game');
    expect(service.status().games).toBe(4);
  });

  it('Review Focus 2: a cut download fails, keeps the old index, and resumes from the part', async () => {
    const { service, server } = await setup();
    service.refresh();
    await service.idle();
    const half = Math.floor(server.bytes.length / 2);
    server.cutAt = half;
    service.refresh();
    await service.idle();
    expect(service.status()).toMatchObject({
      state: 'failed',
      error: 'errors.launchboxDownload',
      games: 3,
    });
    expect(service.index().game(472523)).not.toBeNull();
    server.cutAt = null;
    service.refresh();
    await service.idle();
    expect(server.ranges.at(-1)).toBe(`bytes=${String(half)}-`);
    expect(service.status().state).toBe('ready');
  });

  it('cancel stops the work and returns to the previous state', async () => {
    const { service } = await setup();
    service.refresh();
    expect(service.cancel().state).toBe('missing');
    await service.idle();
    expect(service.status()).toMatchObject({ state: 'missing', error: null });
  });

  it('platformOf prefers the settings override, then the catalog', async () => {
    const settings = defaultSettings();
    const { service, setSettings } = await setup({ settings });
    expect(service.platformOf('microsoft-xbox-360')).toBe('Microsoft Xbox 360');
    expect(() => service.platformOf('snes')).toThrow(/NO_LAUNCHBOX_PLATFORM/);
    setSettings({
      ...settings,
      systems: {
        snes: SystemSettingsSchema.parse({
          launchboxPlatform: 'Super Nintendo Entertainment System',
        }),
      },
    });
    expect(service.platformOf('snes')).toBe('Super Nintendo Entertainment System');
  });

  it('PR (a) review: a cancel during a worker build settles cleanly and leaves no build file', async () => {
    // Big enough that the worker is still building when the cancel arrives.
    const games = Array.from(
      { length: 40_000 },
      (_, i) =>
        `<Game><Name>Game ${String(i)}</Name><DatabaseID>${String(i + 1)}</DatabaseID><Platform>P</Platform></Game>`,
    ).join('');
    const { service, server, events, dir, temp } = await setup({
      buildInWorker: buildInWorker(new URL('./indexWorker.ts', import.meta.url)),
    });
    writeFixtureZip(join(temp, 'big.zip'), `<LaunchBox>${games}</LaunchBox>`);
    server.bytes = readFileSync(join(temp, 'big.zip'));
    service.refresh();
    await vi.waitFor(() => {
      expect(events.some((e) => e.state === 'building')).toBe(true);
    });
    service.cancel();
    await expect(service.idle()).resolves.toBeUndefined();
    expect(service.status()).toMatchObject({ state: 'missing', error: null });
    expect(existsSync(join(dir, 'launchbox.db.building'))).toBe(false);
  });

  it('PR (a) review: a build that ends while a batch is busy swaps only when the batch ends', async () => {
    let release = () => {};
    let gated = false;
    const { service, server, temp } = await setup({
      buildInWorker: async (zip, out, onProgress, signal) => {
        if (gated) {
          await new Promise<void>((resolve) => {
            release = resolve;
          });
        }
        return buildIndex(zip, out, onProgress, signal);
      },
    });
    service.refresh();
    await service.idle();
    const before = service.index();
    const xml = readFileSync(FIXTURE_XML_PATH, 'utf8').replace(
      '</LaunchBox>',
      '<Game><Name>New Game</Name><DatabaseID>9</DatabaseID><Platform>Nintendo DS</Platform></Game></LaunchBox>',
    );
    writeFixtureZip(join(temp, 'newer.zip'), xml);
    server.bytes = readFileSync(join(temp, 'newer.zip'));
    gated = true;
    service.refresh();
    await vi.waitFor(() => {
      expect(service.status().state).toBe('building');
    });
    service.setBusy(true);
    release();
    await service.idle();
    expect(service.index()).toBe(before);
    expect(service.status()).toMatchObject({ state: 'ready', games: 3 });
    service.setBusy(false);
    expect(service.index()).not.toBe(before);
    expect(service.status()).toMatchObject({ state: 'ready', games: 4 });
  });

  it('PR (a) review: a part of an older daily file is dropped, not resumed', async () => {
    const { service, server, temp } = await setup();
    server.cutAt = Math.floor(server.bytes.length / 2);
    service.refresh();
    await service.idle();
    expect(service.status().state).toBe('failed');
    const xml = readFileSync(FIXTURE_XML_PATH, 'utf8').replace(
      '</LaunchBox>',
      '<Game><Name>New Game</Name><DatabaseID>9</DatabaseID><Platform>Nintendo DS</Platform></Game></LaunchBox>',
    );
    writeFixtureZip(join(temp, 'newer.zip'), xml);
    server.bytes = readFileSync(join(temp, 'newer.zip'));
    server.etag = '"day-2"';
    server.cutAt = null;
    service.refresh();
    await service.idle();
    expect(server.ranges.at(-1)).toBeNull();
    expect(service.status()).toMatchObject({ state: 'ready', games: 4 });
  });

  it('PR (a) review: a build failure is logged with its cause', async () => {
    const { service, warnings } = await setup({
      buildInWorker: () => Promise.reject(new Error('disk is full')),
    });
    service.refresh();
    await service.idle();
    expect(service.status()).toMatchObject({ state: 'failed', error: 'errors.internal' });
    expect(JSON.stringify(warnings)).toContain('disk is full');
  });
});
