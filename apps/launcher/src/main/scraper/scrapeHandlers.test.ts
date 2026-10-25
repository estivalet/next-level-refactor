import { defaultSettings, ipcContract, type Settings } from '@nextlevel/shared';
import { describe, expect, it } from 'vitest';
import { createScrapeHandlers } from './scrapeHandlers.ts';

function setup() {
  let settings: Settings = defaultSettings();
  const calls: unknown[] = [];
  const service = {
    search: (input: unknown) => {
      calls.push(['search', input]);
      return Promise.resolve({ method: 'title' as const, candidates: [] });
    },
    preview: () => Promise.reject(new Error('not used')),
    apply: () => Promise.reject(new Error('not used')),
  };
  const handlers = createScrapeHandlers({
    service: () => service,
    systems: (opts) => {
      calls.push(['systems', opts]);
      return Promise.resolve([{ id: 4, name: 'Alpha Console' }]);
    },
    updateSettings: (change) => {
      settings = change(settings);
      return Promise.resolve();
    },
  });
  return { handlers, calls, settings: () => settings };
}

describe('scraper channels (FR-SCR-1, US-C5)', () => {
  it('search passes through to the service', async () => {
    const { handlers, calls } = setup();
    await handlers['scraper.search']({ gameId: 3, refresh: true });
    expect(calls).toEqual([['search', { gameId: 3, refresh: true }]]);
  });

  it('systems lists the ScreenScraper systems; refresh asks again', async () => {
    const { handlers, calls } = setup();
    expect(await handlers['scraper.systems']({ refresh: true })).toEqual([
      { id: 4, name: 'Alpha Console' },
    ]);
    expect(calls).toEqual([['systems', { refresh: true }]]);
  });

  it('setSystemId saves the id on the system and keeps its other settings', async () => {
    const { handlers, settings } = setup();
    await handlers['scraper.setSystemId']({ systemId: 'snes', screenscraperId: 4 });
    expect(settings().systems['snes']).toMatchObject({ screenscraperId: 4, enabled: false });
    await handlers['scraper.setSystemId']({ systemId: 'snes', screenscraperId: 5 });
    expect(settings().systems['snes']?.screenscraperId).toBe(5);
  });

  it('the contract validates the inputs', () => {
    expect(ipcContract['scraper.search'].input.safeParse({ gameId: 0 }).success).toBe(false);
    expect(ipcContract['scraper.search'].input.safeParse({ gameId: 1, title: ' ' }).success).toBe(
      false,
    );
    expect(
      ipcContract['scraper.apply'].input.safeParse({
        gameId: 1,
        providerGameId: 2,
        kinds: ['screenshot-select'],
        fields: [],
      }).success,
    ).toBe(false);
    expect(
      ipcContract['scraper.setSystemId'].input.safeParse({ systemId: 'snes', screenscraperId: 0 })
        .success,
    ).toBe(false);
  });
});
