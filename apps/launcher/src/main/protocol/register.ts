import { parseNextlevelUrl } from '@nextlevel/shared';
import { serveFile } from './mediaRange.ts';
import { resolveNextlevelPath } from './resolveUrl.ts';

/**
 * The `nextlevel://` scheme (FR-THM-6) serves indexed game media and menu art to `<img>`,
 * `<video>`, `<audio>` and `fetch`. Registered as privileged before the app is ready; `stream`
 * enables ranged video requests, `corsEnabled` lets the `file://` page fetch JSON and sounds. It
 * does not bypass the renderer CSP.
 */
export const NEXTLEVEL_SCHEME = {
  scheme: 'nextlevel',
  privileges: {
    standard: true,
    secure: true,
    supportFetchAPI: true,
    stream: true,
    corsEnabled: true,
  },
};

/** Responses are readable from any origin: they only ever hold art the user put in their folders. */
function readable(response: Response): Response {
  response.headers.set('Access-Control-Allow-Origin', '*');
  return response;
}

export interface NextlevelHandlerDeps {
  mediaPath: (gameId: number, kind: string) => string | null;
  /** Read per request, so a Settings change applies at once. */
  paths: () => { assetsPath: string | null; themesPath: string | null };
}

/** The `protocol.handle('nextlevel', …)` handler; 404 for anything it can't resolve. */
export function createNextlevelHandler(deps: NextlevelHandlerDeps) {
  const respond = async (request: Request): Promise<Response> => {
    if (request.method !== 'GET') {
      return new Response(null, { status: 405 });
    }
    const parsed = parseNextlevelUrl(request.url);
    if (!parsed) return new Response(null, { status: 404 });
    const path = await resolveNextlevelPath(parsed, { mediaPath: deps.mediaPath, ...deps.paths() });
    if (!path) return new Response(null, { status: 404 });
    return serveFile(path, request.headers.get('range'));
  };
  return async (request: Request) => readable(await respond(request));
}
