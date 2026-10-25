import type { ScrapeStatus } from '@nextlevel/shared';
import type { LibraryDb } from './openLibrary.ts';

/** The only provider so far (FR-SCR-1). */
export const SCREENSCRAPER = 'screenscraper';

interface RawStatus {
  status: ScrapeStatus['status'];
  providerGameId: number | null;
  candidates: number;
  error: string | null;
  scrapedAt: string;
}

export const SCRAPE_STATUS_COLUMNS = `s.status as status, s.provider_game_id as providerGameId,
  s.candidates as candidates, s.error as error, s.scraped_at as scrapedAt`;

/** A `scrape_status` row read with SCRAPE_STATUS_COLUMNS, or null when there is none. */
export function toScrapeStatus(raw: RawStatus | undefined): ScrapeStatus | null {
  if (!raw?.status) return null;
  return {
    status: raw.status,
    providerGameId: raw.providerGameId,
    candidates: raw.candidates,
    error: raw.error,
    scrapedAt: raw.scrapedAt,
  };
}

/** The last scrape result per game (`scrape_status`, FR-SCR-2, FR-SCR-5). */
export class ScrapeRepository {
  constructor(private readonly db: LibraryDb) {}

  set(gameId: number, status: ScrapeStatus): void {
    this.db.$client
      .prepare(
        `insert into scrape_status
           (game_id, provider, provider_game_id, status, candidates, error, scraped_at)
         values (@gameId, @provider, @providerGameId, @status, @candidates, @error, @scrapedAt)
         on conflict (game_id) do update set provider = excluded.provider,
           provider_game_id = excluded.provider_game_id, status = excluded.status,
           candidates = excluded.candidates, error = excluded.error,
           scraped_at = excluded.scraped_at`,
      )
      .run({ gameId, provider: SCREENSCRAPER, ...status });
  }

  get(gameId: number): ScrapeStatus | null {
    const raw = this.db.$client
      .prepare(`select ${SCRAPE_STATUS_COLUMNS} from scrape_status s where s.game_id = ?`)
      .get(gameId) as RawStatus | undefined;
    return toScrapeStatus(raw);
  }
}
