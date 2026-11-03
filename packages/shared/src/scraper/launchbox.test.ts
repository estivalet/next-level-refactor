import { describe, expect, it } from 'vitest';
import { ipcContract } from '../ipc/contract.ts';
import { ipcEvents } from '../ipc/events.ts';
import { SettingsSchema } from '../settings/schema.ts';
import { ScrapeApplyInputSchema, ScrapeSearchInputSchema } from './apply.ts';
import { LaunchBoxStatusSchema } from './launchbox.ts';
import { ScrapeStatusSchema } from './schema.ts';

describe('LaunchBox contracts (FR-SCR-6)', () => {
  it('FR-SCR-6: scrape inputs name their provider; absent means ScreenScraper', () => {
    expect(ScrapeSearchInputSchema.parse({ gameId: 1 }).provider).toBeUndefined();
    expect(
      ScrapeApplyInputSchema.parse({
        gameId: 1,
        providerGameId: 2,
        kinds: [],
        fields: [],
        provider: 'launchbox',
      }).provider,
    ).toBe('launchbox');
    expect(ScrapeSearchInputSchema.safeParse({ gameId: 1, provider: 'igdb' }).success).toBe(false);
  });

  it('FR-SCR-6: a system may name its LaunchBox platform', () => {
    const parse = (launchboxPlatform: unknown) =>
      SettingsSchema.safeParse({ schemaVersion: 2, systems: { snes: { launchboxPlatform } } });
    expect(parse('Super Nintendo Entertainment System').success).toBe(true);
    expect(parse('').success).toBe(false);
  });

  it('FR-SCR-6: a scrape status names its provider', () => {
    const status = {
      status: 'scraped',
      providerGameId: 472523,
      candidates: 1,
      error: null,
      scrapedAt: '2026-11-02T12:00:00.000Z',
    };
    expect(ScrapeStatusSchema.safeParse({ ...status, provider: 'launchbox' }).success).toBe(true);
    expect(ScrapeStatusSchema.safeParse(status).success).toBe(false);
  });

  it('FR-SCR-6: launchbox channels and status event', () => {
    const ready = {
      state: 'ready',
      builtAt: '2026-11-02T08:00:00.000Z',
      games: 3,
      progress: null,
      error: null,
    };
    expect(LaunchBoxStatusSchema.safeParse(ready).success).toBe(true);
    expect(ipcContract['launchbox.status'].output.safeParse(ready).success).toBe(true);
    expect(
      ipcContract['launchbox.setPlatform'].input.safeParse({ systemId: 'snes', platform: '' })
        .success,
    ).toBe(false);
    expect(
      ipcEvents['launchbox.changed'].safeParse({ ...ready, state: 'building', progress: 0.5 })
        .success,
    ).toBe(true);
  });
});
