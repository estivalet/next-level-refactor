import { walkMenuNodes } from '@nextlevel/shared';
import type { FrontendDeps } from './FrontendService.ts';

/**
 * What decides which entries the themes' menu can show, as one comparable string: enabled systems
 * with present games, systems with a present favorite, and for a stored menu which of its
 * collections and smart filters have present games (for the generated one, the collection list).
 * Main compares it after game and settings changes and announces `menus.changed` when it moves
 * (FR-MENU-2/3), so a Favorites entry appears with the first favorite. It stays cheap: one EXISTS
 * per enabled system and per referenced smart filter, plus one pass over the favorites.
 */
export function menuFingerprint(deps: FrontendDeps): string {
  const client = deps.db.$client;
  const own = deps.settings().systems;
  // One indexed EXISTS per enabled system: stops at its first present game.
  const hasGames = client
    .prepare(
      `select exists (select 1 from games
       where system_id = ? and missing = 0 and collection_only = 0)`,
    )
    .pluck();
  const systems = deps
    .catalog()
    .filter((system) => own[system.id]?.enabled === true && hasGames.get(system.id) === 1)
    .map((system) => system.id);
  // Systems with a present favorite: their Favorite filter entry comes and goes with it.
  const favorites = client
    .prepare(
      `select distinct g.system_id from game_user_state u join games g on g.id = u.game_id
       where u.favorite = 1 and g.missing = 0 and g.collection_only = 0 order by g.system_id`,
    )
    .pluck()
    .all() as string[];
  const active = deps.menus.active();
  if (!active) {
    const collections = deps.collections.list().map((c) => `${String(c.id)}:${c.name}`);
    return JSON.stringify({ systems, favorites, collections });
  }
  const collectionIds = new Set<number>();
  const smartFilterIds = new Set<number>();
  for (const node of walkMenuNodes(active.nodes)) {
    if (node.type === 'collection') collectionIds.add(Number(node.refId));
    if (node.type === 'smartFilter') smartFilterIds.add(Number(node.refId));
  }
  const collections = client
    .prepare(
      `select distinct cg.collection_id from collection_games cg join games g on g.id = cg.game_id
       where g.missing = 0 and cg.collection_id in (select value from json_each(?))
       order by cg.collection_id`,
    )
    .pluck()
    .all(JSON.stringify([...collectionIds])) as number[];
  const names = deps.smartFilters.names();
  const smartFilters = [...smartFilterIds].filter((id) => {
    if (!names.has(id)) return false;
    try {
      return deps.smartFilters.hasGames(id);
    } catch {
      return false;
    }
  });
  return JSON.stringify({ menu: active.id, systems, favorites, collections, smartFilters });
}
