// Test helpers for the scraper: a fake ScreenScraper behind an injected `fetch`, and invented
// game builders. No real ScreenScraper data, titles or credentials.
import type { ScreenScraperCredentials } from './screenscraper/client.ts';
import type { SsGame } from './screenscraper/types.ts';

export interface FakeReply {
  status?: number;
  /** JSON body for API endpoints; a Buffer for media downloads. */
  body?: unknown;
  contentType?: string;
}

export type FakeRoute = (params: URLSearchParams) => FakeReply;

export interface FakeScreenScraper {
  fetch: typeof fetch;
  /** Every requested URL, in order. */
  calls: URL[];
  /** Calls to one endpoint (e.g. `jeuInfos.php`). */
  callsTo(endpoint: string): URL[];
}

/** Routes by the last path segment (`jeuInfos.php`, `mediaJeu.php`, …); unknown → 404. */
export function fakeScreenScraper(routes: Record<string, FakeRoute>): FakeScreenScraper {
  const calls: URL[] = [];
  const fetchFake = (input: string | URL | Request): Promise<Response> => {
    const url = new URL(input instanceof Request ? input.url : String(input));
    calls.push(url);
    const endpoint = url.pathname.split('/').pop() ?? '';
    const route = routes[endpoint];
    const reply: FakeReply = route ? route(url.searchParams) : { status: 404 };
    const body =
      reply.body instanceof Buffer
        ? new Uint8Array(reply.body)
        : reply.body === undefined
          ? null
          : JSON.stringify(reply.body);
    return Promise.resolve(
      new Response(body, {
        status: reply.status ?? 200,
        headers: { 'content-type': reply.contentType ?? 'application/json' },
      }),
    );
  };
  return {
    fetch: fetchFake,
    calls,
    callsTo: (endpoint) => calls.filter((url) => url.pathname.endsWith(`/${endpoint}`)),
  };
}

export const TEST_CREDENTIALS: ScreenScraperCredentials = {
  devId: 'dev-id',
  devPassword: 'dev-pw',
  user: 'player',
  password: 'player-pw',
};

/** An invented `jeu` with a US name, region and one box image. */
export function ssGame(id: number, name: string, extra: SsGame = {}): SsGame {
  return {
    id: String(id),
    noms: [{ region: 'us', text: name }],
    regions: [{ nom: 'usa' }],
    systeme: { id: '1' },
    medias: [
      {
        type: 'box-2D',
        region: 'us',
        url: `https://media.invalid/mediaJeu.php?devid=dev-id&gameid=${String(id)}&media=box-2D(us)`,
        format: 'png',
      },
    ],
    ...extra,
  };
}

/** `{ response: { …payload, ssuser } }` as every API endpoint answers. */
export const apiBody = (
  payload: Record<string, unknown>,
  ssuser: Record<string, unknown> = {},
) => ({
  response: { ...payload, ssuser: { id: 'player', maxthreads: '1', ...ssuser } },
});
