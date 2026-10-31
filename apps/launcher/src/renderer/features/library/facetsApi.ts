import type { GameScope, GameTab } from '@nextlevel/shared';
import { useQuery } from '@tanstack/react-query';
import { getBridge } from '../../bridge.ts';
import { unwrap } from '../settings/settingsApi.ts';

export const FACETS_KEY = 'library.facets';

/** A scope's filter tags and genres with counts in a tab (D62); refreshed with the games. */
export function useGameFacets(scope: GameScope | null, tab: GameTab) {
  return useQuery({
    queryKey: [FACETS_KEY, scope, tab] as const,
    queryFn: async () =>
      unwrap(await getBridge().invoke('library.games.facets', { scope: scope as GameScope, tab })),
    enabled: scope !== null,
    // A new tab keeps the scope's last counts on screen until its own arrive (no flicker); another
    // scope's counts never show.
    placeholderData: (previous, previousQuery) =>
      JSON.stringify(previousQuery?.queryKey[1]) === JSON.stringify(scope) ? previous : undefined,
  });
}
