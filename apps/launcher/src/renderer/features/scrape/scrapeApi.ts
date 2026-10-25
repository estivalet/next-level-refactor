import type { ScrapeApplyInput, ScrapeSearchInput } from '@nextlevel/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { getBridge } from '../../bridge.ts';
import { invalidateGames } from '../library/libraryApi.ts';
import { unwrap } from '../settings/settingsApi.ts';

// Plain calls for the dialog's own request sequencing (late answers are dropped by useScrape).

export async function searchScrape(input: ScrapeSearchInput) {
  return unwrap(await getBridge().invoke('scraper.search', input));
}

export async function previewScrape(gameId: number, providerGameId: number) {
  return unwrap(await getBridge().invoke('scraper.preview', { gameId, providerGameId }));
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
