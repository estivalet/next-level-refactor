import type { ScraperAccount } from '@nextlevel/shared';
import type { SecretsLike } from '../secrets/SecretStore.ts';
import { ScraperCache } from './screenscraper/cache.ts';
import { ScreenScraperClient, type ScreenScraperCredentials } from './screenscraper/client.ts';
import { QuotaGate } from './screenscraper/quota.ts';
import { text } from './screenscraper/types.ts';

/** The stored credentials, or null while the developer pair (D15) is missing. */
export function credentialsFrom(
  secrets: Pick<SecretsLike, 'get'>,
): () => Promise<ScreenScraperCredentials | null> {
  return async () => {
    const devId = await secrets.get('screenscraper.devId');
    const devPassword = await secrets.get('screenscraper.devPassword');
    if (!devId || !devPassword) return null;
    return {
      devId,
      devPassword,
      user: await secrets.get('screenscraper.user'),
      password: await secrets.get('screenscraper.password'),
    };
  };
}

const sleep = (ms: number) =>
  new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });

/** One client per app: one cache file and one quota gate for every scrape. */
export function createScraperClient(deps: {
  fetch: typeof fetch;
  secrets: Pick<SecretsLike, 'get'>;
  cacheFile: string;
  baseUrl: string;
  log: { warn(context: object, msg: string): void };
}): { client: ScreenScraperClient; quota: QuotaGate; cache: ScraperCache } {
  const clock = () => Date.now();
  const cache = new ScraperCache(deps.cacheFile, clock, deps.log);
  const quota = new QuotaGate({ clock, sleep });
  const client = new ScreenScraperClient({
    fetch: deps.fetch,
    credentials: credentialsFrom(deps.secrets),
    baseUrl: deps.baseUrl,
    cache,
    quota,
    sleep,
  });
  return { client, quota, cache };
}

/** Settings → Scraper → Test (US-D6): who ScreenScraper says we are and today's quota. */
export async function accountOf(
  client: Pick<ScreenScraperClient, 'user'>,
  quota: Pick<QuotaGate, 'state'>,
): Promise<ScraperAccount> {
  const user = await client.user();
  const state = quota.state();
  return {
    user: text(user.id),
    requestsToday: state.requestsToday,
    maxRequestsPerDay: state.maxPerDay,
  };
}
