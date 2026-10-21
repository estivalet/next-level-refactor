import type { GameListPage, GameListQuery, GameRow } from '@nextlevel/shared';
import { useQueries } from '@tanstack/react-query';
import { getBridge } from '../../bridge.ts';
import { unwrap } from '../settings/settingsApi.ts';
import { PAGE_SIZE, pagesForRange } from './pages.ts';

export type PagedGames = ReturnType<typeof usePagedGames>;

/** A game list query without paging; the hook pages it. */
export type GameListParams = Omit<GameListQuery, 'offset' | 'limit'>;

export const GAMES_KEY = 'library.games';

/**
 * A virtualized game list's data (NFR-PERF-2): page 0 (for the total) plus the pages covering the
 * visible rows, each its own query, so a 10k-game system never loads all at once.
 */
export function usePagedGames(
  params: GameListParams | null,
  range: { first: number; last: number },
) {
  const pages = params ? [...new Set([0, ...pagesForRange(range.first, range.last)])] : [];
  const results = useQueries({
    queries: pages.map((page) => ({
      enabled: params !== null,
      queryKey: [GAMES_KEY, params, page] as const,
      queryFn: async (): Promise<GameListPage> =>
        unwrap(
          await getBridge().invoke('library.games.list', {
            ...(params as GameListParams),
            offset: page * PAGE_SIZE,
            limit: PAGE_SIZE,
          }),
        ),
    })),
  });
  const loaded = new Map<number, GameListPage>();
  results.forEach((result, index) => {
    const page = pages[index];
    if (page !== undefined && result.data) loaded.set(page, result.data);
  });
  const first = results[0];
  const failed = results.find((result) => result.isError);
  const loadedPages = [...loaded.keys()];
  return {
    total: loaded.get(0)?.total ?? null,
    /** First row index of the loaded pages, and one past the last. */
    firstLoaded: Math.min(...loadedPages) * PAGE_SIZE,
    lastLoaded: (Math.max(...loadedPages) + 1) * PAGE_SIZE,
    rowAt(index: number): GameRow | undefined {
      return loaded.get(Math.floor(index / PAGE_SIZE))?.games[index % PAGE_SIZE];
    },
    isLoading: first?.isPending ?? false,
    isError: failed !== undefined,
    error: failed?.error ?? null,
  };
}
