import type { MenuTree } from '@nextlevel/shared';
import { useQuery } from '@tanstack/react-query';
import { getBridge } from '../../../bridge.ts';
import { unwrap } from '../../settings/settingsApi.ts';
import { categoryGroups } from './levels.ts';

/** Invalidated with every game change (invalidateGames). */
export const HOME_TOTALS_KEY = 'library.homeTotals';

/**
 * The distinct games each category card at `path` reaches, by node id (FR-LIB-17). Main counts
 * them, so a game in a system and in a collection under the same category counts once. Empty
 * while loading or when the level has no categories.
 */
export function useHomeTotals(tree: MenuTree | undefined, path: readonly string[]) {
  const groups = tree ? categoryGroups(tree, path) : [];
  const query = useQuery({
    queryKey: [HOME_TOTALS_KEY, groups],
    queryFn: async () =>
      unwrap(
        await getBridge().invoke('library.homeTotals', {
          groups: groups.map((entry) => entry.group),
        }),
      ),
    enabled: groups.length > 0,
  });
  const totals = new Map<string, number>();
  groups.forEach((entry, index) => {
    const games = query.data?.[index];
    if (games !== undefined) totals.set(entry.id, games);
  });
  return totals;
}
