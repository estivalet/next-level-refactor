import { AppErrorException, type HomeTotalsGroup } from '@nextlevel/shared';
import type { LibraryDb } from './openLibrary.ts';
import type { SmartFilterRepository } from './SmartFilterRepository.ts';

/**
 * The distinct games each group reaches (FR-LIB-17): its systems' games (missing ones included,
 * collection-only ones not, like a system card), every member of its collections and the games
 * its smart filters list. A game reached more than once counts once; a collection or smart filter
 * that is gone adds nothing.
 */
const DISTINCT_SQL = `select count(*) from (
  select g.id from games g
    where g.collection_only = 0 and g.system_id in (select value from json_each(@systems))
  union select cg.game_id from collection_games cg
    where cg.collection_id in (select value from json_each(@collections))
  union select value from json_each(@smart)
)`;

export function homeTotals(
  client: LibraryDb['$client'],
  smartFilters: Pick<SmartFilterRepository, 'gameIds'>,
  groups: readonly HomeTotalsGroup[],
): number[] {
  // A smart filter under several categories runs its query once per request.
  const smartIds = new Map<number, number[]>();
  const idsOf = (id: number) => {
    let ids = smartIds.get(id);
    if (!ids) {
      try {
        ids = smartFilters.gameIds(id);
      } catch (error) {
        // Deleted since the menu was read.
        if (!(error instanceof AppErrorException && error.error.code === 'NOT_FOUND')) throw error;
        ids = [];
      }
      smartIds.set(id, ids);
    }
    return ids;
  };
  const statement = client.prepare(DISTINCT_SQL).pluck();
  return groups.map(
    (group) =>
      statement.get({
        systems: JSON.stringify(group.systemIds),
        collections: JSON.stringify(group.collectionIds),
        smart: JSON.stringify(group.smartFilterIds.flatMap(idsOf)),
      }) as number,
  );
}
