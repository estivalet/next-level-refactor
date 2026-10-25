// ScreenScraper API v2 client (FR-SCR-1, FR-SCR-2), ported from NextLevelOS
// scrappers/ScreenScraper.py (_request, identify_rom_exact, _search_games_api, get_game,
// get_systems) and scrape_cli.py (http_error_message) @ 3d530b7.
import { AppErrorException, ERROR_CODES, type ErrorCode } from '@nextlevel/shared';
import type { RomHashes } from '../hashRom.ts';
import type { ScraperCache } from './cache.ts';
import type { QuotaGate } from './quota.ts';
import { redact } from './redact.ts';
import { isRecord, positiveInt, text, type SsGame, type SsUser } from './types.ts';

export const SCREENSCRAPER_URL = 'https://api.screenscraper.fr/api2';
const SOFTNAME = 'NextLevel';
const TIMEOUT_MS = 30_000;
const RETRY_DELAYS = [2000, 4000, 8000];

export interface ScreenScraperCredentials {
  devId: string;
  devPassword: string;
  user: string | null;
  password: string | null;
}

export interface ClientDeps {
  fetch: typeof fetch;
  /** null when the developer pair isn't set (D15). */
  credentials: () => Promise<ScreenScraperCredentials | null>;
  baseUrl: string;
  cache: ScraperCache;
  quota: QuotaGate;
  sleep: (ms: number) => Promise<void>;
}

const fail = (code: ErrorCode, details?: string): never => {
  throw new AppErrorException({
    code,
    message: ERROR_CODES[code],
    ...(details === undefined ? {} : { details }),
  });
};

/** HTTP status → error code (plan Global Constraints); 404 is handled by the callers. */
function statusError(status: number): ErrorCode {
  if (status === 401 || status === 403) return 'SCRAPER_CREDENTIALS';
  if (status === 429 || status === 430 || status === 431) return 'SCRAPER_QUOTA';
  return 'SCRAPER_UNAVAILABLE';
}

/** Games from a search, without the `{}` placeholders ScreenScraper sends for "none". */
const usable = (value: unknown): SsGame[] =>
  Array.isArray(value)
    ? value.filter(
        (game: unknown): game is SsGame => isRecord(game) && positiveInt(game['id']) !== null,
      )
    : [];

function inSystem(game: SsGame, systemId: number): boolean {
  const system = game.systeme;
  return (
    isRecord(system) &&
    (String(system['id']) === String(systemId) || String(system['parentid']) === String(systemId))
  );
}

export class ScreenScraperClient {
  constructor(private readonly deps: ClientDeps) {}

  /** The ScreenScraper system list, sorted by name (for the system picker). */
  async systems(
    opts: { refresh?: boolean | undefined } = {},
  ): Promise<Array<{ id: number; name: string }>> {
    const cached = opts.refresh ? null : this.deps.cache.get('systems', 'all');
    if (Array.isArray(cached)) return cached as Array<{ id: number; name: string }>;
    const response = await this.request('systemesListe.php', {});
    const list = Array.isArray(response?.['systemes']) ? response['systemes'] : [];
    const systems = list
      .filter(isRecord)
      .map((system) => {
        const names = isRecord(system['noms']) ? system['noms'] : {};
        return {
          id: positiveInt(system['id']),
          name: text(names['nom_eu']) ?? text(names['nom_us']) ?? text(names['nom_jp']),
        };
      })
      .filter((s): s is { id: number; name: string } => s.id !== null && s.name !== null)
      .sort((a, b) => a.name.localeCompare(b.name));
    // An empty list is an API hiccup, not a fact worth keeping for 30 days.
    if (systems.length > 0) this.deps.cache.put('systems', 'all', systems);
    return systems;
  }

  /** The game whose file has these hashes, or null when ScreenScraper doesn't know it. */
  async identify(hashes: RomHashes, romName: string, systemId: number): Promise<SsGame | null> {
    const key = `${String(systemId)}:${hashes.crc}:${hashes.md5}:${hashes.sha1}:${String(hashes.size)}`;
    const cached = this.deps.cache.get('hash', key);
    if (isRecord(cached)) return cached;
    const response = await this.request('jeuInfos.php', {
      crc: hashes.crc,
      md5: hashes.md5,
      sha1: hashes.sha1,
      systemeid: String(systemId),
      romtype: 'rom',
      romnom: romName,
      romtaille: String(hashes.size),
    });
    const game = response?.['jeu'];
    if (!isRecord(game) || positiveInt(game['id']) === null) return null;
    this.deps.cache.put('hash', key, game);
    return game;
  }

  /**
   * Games matching a query: the system-filtered search first, then (ScreenScraper often returns
   * nothing filtered) an unfiltered one kept to the system or its children.
   */
  async search(
    query: string,
    systemId: number,
    opts: { refresh?: boolean } = {},
  ): Promise<SsGame[]> {
    const key = `${String(systemId)}:${query.trim().toLowerCase()}`;
    const cached = opts.refresh ? null : this.deps.cache.get('search', key);
    if (Array.isArray(cached)) return cached as SsGame[];
    let games = usable(
      (await this.request('jeuRecherche.php', { recherche: query, systemeid: String(systemId) }))?.[
        'jeux'
      ],
    );
    if (games.length === 0) {
      games = usable(
        (await this.request('jeuRecherche.php', { recherche: query }))?.['jeux'],
      ).filter((game) => inSystem(game, systemId));
    }
    this.deps.cache.put('search', key, games);
    return games;
  }

  /** Full details of one game; NOT_FOUND when ScreenScraper has no such game. */
  async game(
    providerGameId: number,
    systemId: number,
    opts: { refresh?: boolean } = {},
  ): Promise<SsGame> {
    const key = String(providerGameId);
    const cached = opts.refresh ? null : this.deps.cache.get('game', key);
    if (isRecord(cached)) return cached;
    const response = await this.request('jeuInfos.php', {
      gameid: key,
      systemeid: String(systemId),
    });
    const game = response?.['jeu'];
    if (!isRecord(game) || positiveInt(game['id']) === null) return fail('NOT_FOUND');
    this.deps.cache.put('game', key, game);
    return game;
  }

  /** The account (or anonymous user) and its quota; never cached. */
  async user(): Promise<SsUser> {
    const response = await this.request('ssuserInfos.php', {});
    return isRecord(response?.['ssuser']) ? response['ssuser'] : {};
  }

  /** A media file. Its URL already carries the credentials ScreenScraper put there. */
  async download(
    url: string,
    signal?: AbortSignal,
  ): Promise<{ bytes: Buffer; contentType: string | null }> {
    const response = await this.send(url, signal);
    if (!response.ok) {
      // Quota and credential refusals must reach a batch as such (it pauses on them); a file
      // ScreenScraper doesn't have is NOT_FOUND.
      const { status } = response;
      if (status === 430 || status === 431) this.deps.quota.exhausted();
      const code = status === 404 || status === 410 ? 'NOT_FOUND' : statusError(status);
      return fail(code, `HTTP ${String(status)}`);
    }
    return {
      bytes: Buffer.from(await this.body(response, (r) => r.arrayBuffer())),
      contentType: response.headers.get('content-type'),
    };
  }

  /** One API call; the `response` object, or null for a 404. */
  private async request(
    endpoint: string,
    params: Record<string, string>,
  ): Promise<Record<string, unknown> | null> {
    const credentials = await this.deps.credentials();
    if (!credentials) return fail('NO_CREDENTIALS');
    const url = new URL(`${this.deps.baseUrl}/${endpoint}`);
    const query: Record<string, string> = {
      devid: credentials.devId,
      devpassword: credentials.devPassword,
      softname: SOFTNAME,
      output: 'json',
      ...(credentials.user ? { ssid: credentials.user } : {}),
      ...(credentials.password ? { sspassword: credentials.password } : {}),
      ...params,
    };
    for (const [name, value] of Object.entries(query)) url.searchParams.set(name, value);

    for (let attempt = 0; ; attempt++) {
      const response = await this.send(url.href);
      if (response.status === 404) return null;
      if (response.status === 429 && attempt < RETRY_DELAYS.length) {
        await this.deps.sleep(RETRY_DELAYS[attempt] ?? 0);
        continue;
      }
      if (response.status === 430 || response.status === 431) this.deps.quota.exhausted();
      if (!response.ok)
        return fail(statusError(response.status), `HTTP ${String(response.status)}`);
      const raw = await this.body(response, (r) => r.text());
      let data: unknown;
      try {
        data = JSON.parse(raw);
      } catch {
        return fail('SCRAPER_UNAVAILABLE', 'not JSON');
      }
      const body = isRecord(data) && isRecord(data['response']) ? data['response'] : null;
      if (!body) return fail('SCRAPER_UNAVAILABLE', 'no response');
      if (isRecord(body['ssuser'])) this.deps.quota.update(body['ssuser']);
      const error = text(body['error']);
      if (error) return fail('SCRAPER_UNAVAILABLE', redact(error));
      return body;
    }
  }

  /** Reads a body; a connection lost or timed out mid-body is a network failure. */
  private async body<T>(response: Response, read: (response: Response) => Promise<T>): Promise<T> {
    try {
      return await read(response);
    } catch (error) {
      return fail('SCRAPER_NETWORK', redact(error));
    }
  }

  private async send(url: string, signal?: AbortSignal): Promise<Response> {
    const timeout = AbortSignal.timeout(TIMEOUT_MS);
    try {
      return await this.deps.quota.run(() =>
        this.deps.fetch(url, { signal: signal ? AbortSignal.any([signal, timeout]) : timeout }),
      );
    } catch (error) {
      return fail('SCRAPER_NETWORK', redact(error));
    }
  }
}
