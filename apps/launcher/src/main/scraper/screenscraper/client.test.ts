import { describe, expect, it, vi } from 'vitest';
import { AppErrorException } from '@nextlevel/shared';
import {
  apiBody,
  fakeScreenScraper,
  ssGame,
  TEST_CREDENTIALS,
  type FakeRoute,
} from '../testing.ts';
import { ScraperCache } from './cache.ts';
import { ScreenScraperClient, type ScreenScraperCredentials } from './client.ts';
import { QuotaGate } from './quota.ts';

const BASE = 'https://api.invalid/api2';
const HASHES = { size: 3, crc: '352441c2', md5: 'a', sha1: 'b' };

function setup(
  routes: Record<string, FakeRoute>,
  credentials: ScreenScraperCredentials | null = TEST_CREDENTIALS,
  fetchOverride?: typeof fetch,
) {
  let now = Date.UTC(2026, 9, 24, 12);
  const sleeps: number[] = [];
  const sleep = (ms: number) => {
    sleeps.push(ms);
    now += ms;
    return Promise.resolve();
  };
  const clock = () => now;
  const server = fakeScreenScraper(routes);
  const cache = new ScraperCache(':memory:', clock);
  const quota = new QuotaGate({ clock, sleep, minIntervalMs: 0 });
  const client = new ScreenScraperClient({
    fetch: fetchOverride ?? server.fetch,
    credentials: () => Promise.resolve(credentials),
    baseUrl: BASE,
    cache,
    quota,
    sleep,
  });
  return {
    client,
    server,
    quota,
    sleeps,
    advance: (ms: number) => {
      now += ms;
    },
  };
}

async function codeOf(promise: Promise<unknown>): Promise<string> {
  try {
    await promise;
  } catch (error) {
    if (error instanceof AppErrorException) return error.error.code;
    throw error;
  }
  return 'resolved';
}

describe('ScreenScraperClient (FR-SCR-1)', () => {
  it('sends the credentials, softname and json output with each request', async () => {
    const { client, server } = setup({
      'jeuInfos.php': () => ({ body: apiBody({ jeu: ssGame(7, 'Orbit Racer') }) }),
    });
    await client.game(7, 1);
    const params = server.calls[0]?.searchParams;
    expect(Object.fromEntries(params ?? [])).toMatchObject({
      devid: 'dev-id',
      devpassword: 'dev-pw',
      ssid: 'player',
      sspassword: 'player-pw',
      softname: 'NextLevel',
      output: 'json',
      gameid: '7',
      systemeid: '1',
    });
  });

  it('leaves the account out when only the developer pair is set', async () => {
    const { client, server } = setup(
      { 'jeuInfos.php': () => ({ body: apiBody({ jeu: ssGame(7, 'Orbit Racer') }) }) },
      { ...TEST_CREDENTIALS, user: null, password: null },
    );
    await client.game(7, 1);
    expect(server.calls[0]?.searchParams.has('ssid')).toBe(false);
  });

  it('without the developer pair: NO_CREDENTIALS and no request', async () => {
    const { client, server } = setup({}, null);
    expect(await codeOf(client.game(7, 1))).toBe('NO_CREDENTIALS');
    expect(server.calls).toHaveLength(0);
  });

  it.each([
    [401, 'SCRAPER_CREDENTIALS'],
    [403, 'SCRAPER_CREDENTIALS'],
    [423, 'SCRAPER_UNAVAILABLE'],
    [426, 'SCRAPER_UNAVAILABLE'],
    [500, 'SCRAPER_UNAVAILABLE'],
    [431, 'SCRAPER_QUOTA'],
  ])('HTTP %i → %s', async (status, code) => {
    const { client } = setup({ 'jeuInfos.php': () => ({ status }) });
    expect(await codeOf(client.game(7, 1))).toBe(code);
  });

  it('430 → SCRAPER_QUOTA and the gate knows until when', async () => {
    const { client, quota } = setup({ 'jeuInfos.php': () => ({ status: 430 }) });
    expect(await codeOf(client.game(7, 1))).toBe('SCRAPER_QUOTA');
    expect(quota.state().exhaustedUntil).toBe('2026-10-24T22:00:00.000Z');
  });

  it('429 is retried after 2, 4 and 8 s, then SCRAPER_QUOTA', async () => {
    const { client, server, sleeps } = setup({ 'jeuInfos.php': () => ({ status: 429 }) });
    expect(await codeOf(client.game(7, 1))).toBe('SCRAPER_QUOTA');
    expect(server.calls).toHaveLength(4);
    expect(sleeps.filter((ms) => ms >= 2000)).toEqual([2000, 4000, 8000]);
  });

  it('a 429 followed by success returns the game', async () => {
    let n = 0;
    const { client } = setup({
      'jeuInfos.php': () =>
        ++n === 1 ? { status: 429 } : { body: apiBody({ jeu: ssGame(7, 'Orbit Racer') }) },
    });
    expect((await client.game(7, 1)).id).toBe('7');
  });

  it('a network failure → SCRAPER_NETWORK with the URL redacted', async () => {
    const failing = vi.fn(() =>
      Promise.reject(new TypeError('fetch failed https://x/?devpassword=dev-pw&ssid=player')),
    );
    const { client } = setup({}, TEST_CREDENTIALS, failing);
    try {
      await client.game(7, 1);
      expect.unreachable();
    } catch (error) {
      expect(error).toBeInstanceOf(AppErrorException);
      const appError = (error as AppErrorException).error;
      expect(appError.code).toBe('SCRAPER_NETWORK');
      expect(JSON.stringify(appError)).not.toContain('dev-pw');
      expect(JSON.stringify(appError)).not.toContain('player');
    }
  });

  it('an API error field → SCRAPER_UNAVAILABLE; a body that is not JSON too', async () => {
    const { client } = setup({
      'jeuInfos.php': () => ({ body: { response: { error: 'Erreur de login' } } }),
      'jeuRecherche.php': () => ({ body: Buffer.from('<html>'), contentType: 'text/html' }),
    });
    expect(await codeOf(client.game(7, 1))).toBe('SCRAPER_UNAVAILABLE');
    expect(await codeOf(client.search('orbit racer', 1))).toBe('SCRAPER_UNAVAILABLE');
  });

  it('identify: a 404 or an empty jeu is "not found" (null), not an error', async () => {
    const { client } = setup({ 'jeuInfos.php': () => ({ status: 404 }) });
    expect(await client.identify(HASHES, 'orbit.zip', 1)).toBeNull();
    const empty = setup({ 'jeuInfos.php': () => ({ body: apiBody({ jeu: {} }) }) });
    expect(await empty.client.identify(HASHES, 'orbit.zip', 1)).toBeNull();
  });

  it('identify sends the hashes, size and file name', async () => {
    const { client, server } = setup({
      'jeuInfos.php': () => ({ body: apiBody({ jeu: ssGame(7, 'Orbit Racer') }) }),
    });
    expect((await client.identify(HASHES, 'orbit.zip', 1))?.id).toBe('7');
    expect(Object.fromEntries(server.calls[0]?.searchParams ?? [])).toMatchObject({
      crc: '352441c2',
      md5: 'a',
      sha1: 'b',
      romtaille: '3',
      romnom: 'orbit.zip',
      romtype: 'rom',
      systemeid: '1',
    });
  });

  it('game: a 404 → NOT_FOUND', async () => {
    const { client } = setup({ 'jeuInfos.php': () => ({ status: 404 }) });
    expect(await codeOf(client.game(7, 1))).toBe('NOT_FOUND');
  });

  it('search falls back to an unfiltered search kept to the system or its parent', async () => {
    const { client, server } = setup({
      'jeuRecherche.php': (params) =>
        params.has('systemeid')
          ? { body: apiBody({ jeux: [{}] }) }
          : {
              body: apiBody({
                jeux: [
                  ssGame(1, 'Orbit', { systeme: { id: '1' } }),
                  ssGame(2, 'Orbit', { systeme: { id: '9', parentid: '1' } }),
                  ssGame(3, 'Orbit', { systeme: { id: '9' } }),
                ],
              }),
            },
    });
    const games = await client.search('orbit', 1);
    expect(games.map((game) => game.id)).toEqual(['1', '2']);
    expect(server.callsTo('jeuRecherche.php')).toHaveLength(2);
  });

  it('caches game details; refresh and expiry fetch again', async () => {
    const { client, server, advance } = setup({
      'jeuInfos.php': () => ({ body: apiBody({ jeu: ssGame(7, 'Orbit Racer') }) }),
    });
    await client.game(7, 1);
    await client.game(7, 1);
    expect(server.calls).toHaveLength(1);
    await client.game(7, 1, { refresh: true });
    expect(server.calls).toHaveLength(2);
    advance(31 * 24 * 3600 * 1000);
    await client.game(7, 1);
    expect(server.calls).toHaveLength(3);
  });

  it('systems: names sorted, cached', async () => {
    const { client, server } = setup({
      'systemesListe.php': () => ({
        body: apiBody({
          systemes: [
            { id: '2', noms: { nom_eu: 'Zeta Box' } },
            { id: '1', noms: { nom_us: 'Alpha Console' } },
            { id: 'x', noms: {} },
          ],
        }),
      }),
    });
    expect(await client.systems()).toEqual([
      { id: 1, name: 'Alpha Console' },
      { id: 2, name: 'Zeta Box' },
    ]);
    await client.systems();
    expect(server.calls).toHaveLength(1);
  });

  it('every response updates the quota from ssuser', async () => {
    const { client, quota } = setup({
      'ssuserInfos.php': () => ({
        body: apiBody({}, { requeststoday: '12', maxrequestsperday: '20000' }),
      }),
    });
    expect(await client.user()).toMatchObject({ id: 'player' });
    expect(quota.state()).toMatchObject({ requestsToday: 12, maxPerDay: 20000 });
  });

  it('download returns the bytes and content type; a failure is SCRAPER_NETWORK', async () => {
    const { client } = setup({
      'mediaJeu.php': (params) =>
        params.get('media') === 'missing'
          ? { status: 404 }
          : { body: Buffer.from([1, 2, 3]), contentType: 'image/png' },
    });
    const file = await client.download('https://media.invalid/mediaJeu.php?media=box');
    expect([...file.bytes]).toEqual([1, 2, 3]);
    expect(file.contentType).toBe('image/png');
    expect(await codeOf(client.download('https://media.invalid/mediaJeu.php?media=missing'))).toBe(
      'SCRAPER_NETWORK',
    );
  });
});
