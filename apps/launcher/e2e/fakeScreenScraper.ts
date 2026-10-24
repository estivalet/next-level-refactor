import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';

// A local stand-in for the ScreenScraper API (e2e only; NEXTLEVEL_SCREENSCRAPER_URL points the
// launcher at it). Invented data only; it never proxies to the real service.

export const FAKE_DEV = { id: 'e2e-dev', password: 'e2e-dev-pw' };
export const FAKE_USER = { id: 'e2e-player', password: 'e2e-player-pw' };

export type FakeRoute = (params: URLSearchParams) => { status?: number; body?: unknown };

export interface FakeServer {
  /** `http://127.0.0.1:<port>/api2` */
  url: string;
  /** Paths requested so far (`ssuserInfos.php`, …). */
  requests: string[];
  close: () => Promise<void>;
}

const ssuser = (params: URLSearchParams) => ({
  id: params.get('ssid') ?? 'anonymous',
  maxthreads: '1',
  requeststoday: '5',
  maxrequestsperday: '20000',
});

/** Starts the fake server; extra routes are added to (or replace) the built-in ones. */
export async function startFakeScreenScraper(
  routes: Record<string, FakeRoute> = {},
): Promise<FakeServer> {
  const all: Record<string, FakeRoute> = {
    'ssuserInfos.php': (params) => ({ body: { response: { ssuser: ssuser(params) } } }),
    ...routes,
  };
  const requests: string[] = [];
  const server = createServer((req: IncomingMessage, res: ServerResponse) => {
    const url = new URL(req.url ?? '/', 'http://127.0.0.1');
    const endpoint = url.pathname.split('/').pop() ?? '';
    requests.push(endpoint);
    const params = url.searchParams;
    const devOk =
      params.get('devid') === FAKE_DEV.id && params.get('devpassword') === FAKE_DEV.password;
    const route = all[endpoint];
    const reply = !devOk ? { status: 403 } : route ? route(params) : { status: 404 };
    res.writeHead(reply.status ?? 200, { 'content-type': 'application/json' });
    res.end(reply.body === undefined ? '' : JSON.stringify(reply.body));
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address() as AddressInfo;
  return {
    url: `http://127.0.0.1:${String(port)}/api2`,
    requests,
    close: () =>
      new Promise((resolve) =>
        server.close(() => {
          resolve();
        }),
      ),
  };
}
