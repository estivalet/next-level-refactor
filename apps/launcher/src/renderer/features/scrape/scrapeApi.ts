import type { ScrapeApplyInput, ScrapeProvider, ScrapeSearchInput } from '@nextlevel/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { getBridge } from '../../bridge.ts';
import { invalidateGames } from '../library/libraryApi.ts';
import { unwrap } from '../settings/settingsApi.ts';

// Plain calls for the dialog's own request sequencing (late answers are dropped by useScrape).

export async function searchScrape(input: ScrapeSearchInput) {
  return unwrap(await getBridge().invoke('scraper.search', input));
}

/** ScreenScraper calls carry no provider (the default); LaunchBox ones say so (FR-SCR-6). */
export const providerInput = (provider: ScrapeProvider) =>
  provider === 'launchbox' ? { provider } : {};

export async function previewScrape(
  gameId: number,
  providerGameId: number,
  provider: ScrapeProvider = 'screenscraper',
) {
  return unwrap(
    await getBridge().invoke('scraper.preview', {
      gameId,
      providerGameId,
      ...providerInput(provider),
    }),
  );
}

export async function launchboxPlatforms() {
  return unwrap(await getBridge().invoke('launchbox.platforms'));
}

export async function setLaunchBoxPlatform(systemId: string, platform: string) {
  unwrap(await getBridge().invoke('launchbox.setPlatform', { systemId, platform }));
}

export async function refreshLaunchBox() {
  return unwrap(await getBridge().invoke('launchbox.refresh'));
}

export async function scraperSystems(refresh: boolean) {
  return unwrap(await getBridge().invoke('scraper.systems', refresh ? { refresh } : {}));
}

export async function setScraperSystem(systemId: string, screenscraperId: number) {
  unwrap(await getBridge().invoke('scraper.setSystemId', { systemId, screenscraperId }));
}

/** Apply a scrape; the Library refreshes the game (main also announces `library.changed`). */
export function useApplyScrape() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (input: ScrapeApplyInput) =>
      unwrap(await getBridge().invoke('scraper.apply', input)),
    onSuccess: () => invalidateGames(client),
  });
}
