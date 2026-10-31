import type { CollectionSort, GameListQuery, GameRow, GameSort, GameTab } from '@nextlevel/shared';

/** The columns of a game list row, before mapping. */
export interface RawRow {
  id: number;
  systemId: string;
  relPath: string;
  locationId: string | null;
  missing: number;
  title: string;
  year: number | null;
  genre: string | null;
  players: string | null;
  favorite: number;
  hidden: number;
  completed: number;
  userRating: number | null;
}

export const ROW_COLUMNS = `g.id as id, g.system_id as systemId, g.rel_path as relPath,
  g.location_id as locationId, g.missing as missing, m.title as title, m.year as year,
  m.genre as genre, m.players as players, coalesce(u.favorite, 0) as favorite,
  coalesce(u.hidden, 0) as hidden, coalesce(u.completed, 0) as completed,
  u.user_rating as userRating`;

export const ROW_JOINS = `join game_metadata m on m.game_id = g.id
  left join game_user_state u on u.game_id = g.id`;

const TABS: Record<GameTab, string> = {
  all: 'coalesce(u.hidden, 0) = 0',
  favorites: 'coalesce(u.favorite, 0) = 1 and coalesce(u.hidden, 0) = 0',
  recent: 'u.last_played_at is not null and coalesce(u.hidden, 0) = 0',
  completed: 'coalesce(u.completed, 0) = 1 and coalesce(u.hidden, 0) = 0',
  hidden: 'coalesce(u.hidden, 0) = 1',
  missing: 'g.missing = 1 and coalesce(u.hidden, 0) = 0',
  needsReview: `coalesce(u.hidden, 0) = 0 and exists (select 1 from scrape_status s
    where s.game_id = g.id and s.status = 'review')`,
};

const ORDERS: Record<GameSort | CollectionSort, string> = {
  title: 'm.sort_title, g.id',
  year: 'm.year is null, m.year, m.sort_title, g.id',
  rating: 'u.user_rating is null, u.user_rating desc, m.sort_title, g.id',
  added: 'g.added_at desc, g.id desc',
  manual: 'cg.position, g.id',
};

const RECENT_ORDER = 'u.last_played_at desc, g.id desc';

/**
 * The FROM/WHERE/ORDER parts of a list query, built only from fixed fragments (never from input),
 * so each distinct shape can be prepared once. Parameters: @systemId or @collectionId, @match.
 */
export function listShape(
  query: Pick<GameListQuery, 'scope' | 'tab' | 'sort'>,
  collectionSort: CollectionSort | null,
  hasText: boolean,
  /** A smart filter scope: its `select id, rn` query (smartFilterIdsSql). */
  smartIds: string | null = null,
) {
  const scope =
    query.scope.kind === 'system'
      ? { join: '', where: 'g.system_id = @systemId' }
      : query.scope.kind === 'collection'
        ? {
            join: 'join collection_games cg on cg.game_id = g.id and cg.collection_id = @collectionId',
            where: '1 = 1',
          }
        : {
            join: `join (${smartIds ?? 'select 0 as id, 0 as rn'}) sf on sf.id = g.id`,
            where: '1 = 1',
          };
  const where = [scope.where, TABS[query.tab]];
  if (hasText) where.push('g.id in (select rowid from games_fts where games_fts match @match)');
  const sort =
    query.scope.kind === 'collection' ? (collectionSort ?? 'manual') : (query.sort ?? 'title');
  return {
    from: `from games g ${ROW_JOINS} ${scope.join} where ${where.join(' and ')}`,
    // Recently played is newest first whatever the sort; a smart filter keeps its own order.
    order:
      query.tab === 'recent'
        ? RECENT_ORDER
        : query.scope.kind === 'smartFilter'
          ? 'sf.rn'
          : ORDERS[sort],
  };
}

export function toRow(raw: RawRow, resolvePath: (raw: RawRow) => string): GameRow {
  const missing = raw.missing === 1;
  return {
    id: raw.id,
    systemId: raw.systemId,
    title: raw.title,
    year: raw.year,
    genre: raw.genre,
    players: raw.players,
    favorite: raw.favorite === 1,
    hidden: raw.hidden === 1,
    completed: raw.completed === 1,
    userRating: raw.userRating,
    missing,
    expectedPath: missing ? resolvePath(raw) : null,
  };
}
