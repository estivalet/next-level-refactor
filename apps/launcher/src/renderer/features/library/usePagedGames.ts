import type { GameListPage, GameListQuery, GameRow } from '@nextlevel/shared';
import { useQueries, useQueryClient } from '@tanstack/react-query';
import { getBridge } from '../../bridge.ts';
import { unwrap } from '../settings/settingsApi.ts';
import { PAGE_SIZE, pagesForRange } from './pages.ts';

export type PagedGames = ReturnType<typeof usePagedGames>;

/** A game list query without paging; the hook pages it. */
export type GameListParams = Omit<GameListQuery, 'offset' | 'limit'>;

export const GAMES_KEY = 'library.games';

function fetchPage(params: GameListParams, page: number) {
  return async (): Promise<GameListPage> =>
    unwrap(
      await getBridge().invoke('library.games.list', {
        ...params,
        offset: page * PAGE_SIZE,
        limit: PAGE_SIZE,
      }),
    );
}

/**
 * A virtualized game list's data (NFR-PERF-2): page 0 (for the total) plus the pages covering the
 * visible rows, each its own query, so a 10k-game system never loads all at once.
 */
export function usePagedGames(
  params: GameListParams | null,
  range: { first: number; last: number },
) {
  const client = useQueryClient();
  const pages = params ? [...new Set([0, ...pagesForRange(range.first, range.last)])] : [];
  const results = useQueries({
    queries: pages.map((page) => ({
      enabled: params !== null,
      queryKey: [GAMES_KEY, params, page] as const,
      queryFn: fetchPage(params as GameListParams, page),
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
    /**
     * The game ids of rows `first..last`, fetching the pages not loaded yet (a Shift-range over
     * rows never shown, FR-LIB-7 bulk actions).
     */
    async idsInRange(first: number, last: number): Promise<number[]> {
      if (!params) return [];
      const fetched = await Promise.all(
        pagesForRange(first, last).map(async (page) => ({
          page,
          data: await client.query({
            queryKey: [GAMES_KEY, params, page],
            queryFn: fetchPage(params, page),
          }),
        })),
      );
      const ids: number[] = [];
      for (const { page, data } of fetched) {
        data.games.forEach((game, at) => {
          const index = page * PAGE_SIZE + at;
          if (index >= first && index <= last) ids.push(game.id);
        });
      }
      return ids;
    },
    /** The row index of a game in the loaded pages, or -1. */
    indexOf(gameId: number): number {
      for (const [page, data] of loaded) {
        const at = data.games.findIndex((game) => game.id === gameId);
        if (at >= 0) return page * PAGE_SIZE + at;
      }
      return -1;
    },
    rowAt(index: number): GameRow | undefined {
      return loaded.get(Math.floor(index / PAGE_SIZE))?.games[index % PAGE_SIZE];
    },
    isLoading: first?.isPending ?? false,
    isError: failed !== undefined,
    error: failed?.error ?? null,
  };
}
