import type { GameFlags, MetadataChanges } from '@nextlevel/shared';
import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { getBridge } from '../../bridge.ts';
import { useIpcEvent } from '../../events.ts';
import { unwrap } from '../settings/settingsApi.ts';
import { GAMES_KEY } from './usePagedGames.ts';

export const GAME_KEY = 'library.game';
export const SEARCH_KEY = 'library.search';
export const SYSTEMS_KEY = ['systems.list'] as const;
const SEARCH_DELAY_MS = 120;

/** Everything a game change can make stale: lists, details, search and system counts. */
export function invalidateGames(client: QueryClient) {
  return Promise.all([
    client.invalidateQueries({ queryKey: [GAMES_KEY] }),
    client.invalidateQueries({ queryKey: [GAME_KEY] }),
    client.invalidateQueries({ queryKey: [SEARCH_KEY] }),
    client.invalidateQueries({ queryKey: SYSTEMS_KEY }),
  ]);
}

/** Refreshes library views when main reports a change (another window, a scan). */
export function useLibraryEvents() {
  const client = useQueryClient();
  useIpcEvent('library.changed', () => {
    void invalidateGames(client);
  });
  useIpcEvent('scan.finished', () => {
    void invalidateGames(client);
  });
}

/** Catalog systems with their game counts (`games` includes missing ones). */
export function useSystemSummaries() {
  return useQuery({
    queryKey: SYSTEMS_KEY,
    queryFn: async () => unwrap(await getBridge().invoke('systems.list')),
  });
}

export function useGameDetails(gameId: number | null) {
  return useQuery({
    queryKey: [GAME_KEY, gameId],
    queryFn: async () =>
      unwrap(await getBridge().invoke('library.games.get', { gameId: gameId ?? 0 })),
    enabled: gameId !== null,
  });
}

/** The text after the user paused typing for a moment. */
function useDebounced(text: string, delay: number): string {
  const [value, setValue] = useState(text);
  useEffect(() => {
    const timer = setTimeout(() => {
      setValue(text);
    }, delay);
    return () => {
      clearTimeout(timer);
    };
  }, [text, delay]);
  return value;
}

/** Global search across systems (FR-LIB-10); nothing is asked for under 2 characters. */
export function useGlobalSearch(text: string) {
  const debounced = useDebounced(text.trim(), SEARCH_DELAY_MS);
  const active = debounced.length >= 2;
  const query = useQuery({
    queryKey: [SEARCH_KEY, debounced],
    queryFn: async () =>
      unwrap(await getBridge().invoke('library.search', { text: debounced, limit: 200 })),
    enabled: active,
  });
  return { ...query, active, text: debounced };
}

function useGameMutation<Input, Output>(run: (input: Input) => Promise<Output>) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: run,
    onSuccess: () => invalidateGames(client),
  });
}

export function useUpdateMetadata() {
  return useGameMutation(async (input: { gameId: number; changes: MetadataChanges }) =>
    unwrap(await getBridge().invoke('library.games.updateMetadata', input)),
  );
}

export function useSetFlags() {
  return useGameMutation(async (input: { gameIds: number[]; flags: GameFlags }) => {
    unwrap(await getBridge().invoke('library.games.setFlags', input));
  });
}

export function useRelink() {
  return useGameMutation(async (input: { missingGameId: number; replacementGameId: number }) =>
    unwrap(await getBridge().invoke('library.games.relink', input)),
  );
}

export function useRevealGame() {
  return useMutation({
    mutationFn: async (gameId: number) => {
      unwrap(await getBridge().invoke('library.games.reveal', { gameId }));
    },
  });
}
