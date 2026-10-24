import { describe, expect, it } from 'vitest';
import { memorySecrets } from '../secrets/testing.ts';
import { accountOf, credentialsFrom, createScraperClient } from './runtime.ts';
import { apiBody, fakeScreenScraper } from './testing.ts';

describe('scraper runtime (FR-SCR-3)', () => {
  it('credentials need the developer pair; the account is optional', async () => {
    expect(await credentialsFrom(memorySecrets({ 'screenscraper.devId': 'd' }))()).toBeNull();
    expect(
      await credentialsFrom(
        memorySecrets({ 'screenscraper.devId': 'd', 'screenscraper.devPassword': 'p' }),
      )(),
    ).toEqual({ devId: 'd', devPassword: 'p', user: null, password: null });
  });

  it('US-D6: the account summary has the user and the quota counts', async () => {
    const server = fakeScreenScraper({
      'ssuserInfos.php': () => ({
        body: apiBody({}, { id: 'player1', requeststoday: '3', maxrequestsperday: '20000' }),
      }),
    });
    const { client, quota } = createScraperClient({
      fetch: server.fetch,
      secrets: memorySecrets({
        'screenscraper.devId': 'd',
        'screenscraper.devPassword': 'p',
      }),
      cacheFile: ':memory:',
      log: { warn: () => undefined },
      baseUrl: 'https://api.invalid/api2',
    });
    expect(await accountOf(client, quota)).toEqual({
      user: 'player1',
      requestsToday: 3,
      maxRequestsPerDay: 20000,
    });
  });
});
