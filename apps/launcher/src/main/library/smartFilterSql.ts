import type { SmartFilterQuery, SmartFilterSort } from '@nextlevel/shared';
import type Database from 'better-sqlite3';

const DAY_MS = 24 * 60 * 60 * 1000;

const ORDERS: Record<SmartFilterSort, string> = {
  title: 'm.sort_title, g.id',
  year: 'm.year is null, m.year, m.sort_title, g.id',
  lastPlayed: 'u.last_played_at is null, u.last_played_at desc, g.id',
  playCount: 'coalesce(u.play_count, 0) desc, m.sort_title, g.id',
  added: 'g.added_at desc, g.id desc',
};

const PLAYED = '(coalesce(u.play_count, 0) > 0 or u.last_played_at is not null)';

/** `%`, `_` and the escape character itself match literally inside a LIKE pattern. */
const likeContains = (text: string) => `%${text.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;

/**
 * The WHERE/ORDER of a smart filter over `games g`, `game_metadata m` and `game_user_state u`
 * (FR-LIB-9). Built from fixed fragments; every value is a parameter prefixed `sf_`, so the result
 * can be embedded in another query. Missing games never match.
 */
export function smartFilterSql(query: SmartFilterQuery, now: Date) {
  const where = ['g.missing = 0', 'g.collection_only = 0'];
  const params: Record<string, unknown> = {};
  if (query.systems.length > 0) {
    where.push('g.system_id in (select value from json_each(@sf_systems))');
    params['sf_systems'] = JSON.stringify(query.systems);
  }
  if (query.favorite) where.push('coalesce(u.favorite, 0) = 1');
  if (query.filters) {
    where.push(`exists (select 1 from game_filters f where f.game_id = g.id
      and f.filter in (select value from json_each(@sf_filters)))`);
    params['sf_filters'] = JSON.stringify(query.filters);
  }
  if (query.genre !== undefined) {
    where.push("m.genre like @sf_genre escape '\\'");
    params['sf_genre'] = likeContains(query.genre);
  }
  if (query.yearFrom !== undefined) {
    where.push('m.year >= @sf_yearFrom');
    params['sf_yearFrom'] = query.yearFrom;
  }
  if (query.yearTo !== undefined) {
    where.push('m.year <= @sf_yearTo');
    params['sf_yearTo'] = query.yearTo;
  }
  if (query.minPlayers !== undefined) {
    where.push('max_players(m.players) >= @sf_minPlayers');
    params['sf_minPlayers'] = query.minPlayers;
  }
  if (query.played === 'played') where.push(PLAYED);
  if (query.played === 'never') where.push(`not ${PLAYED}`);
  if (query.playedWithinDays !== undefined) {
    where.push('u.last_played_at >= @sf_since');
    params['sf_since'] = new Date(now.getTime() - query.playedWithinDays * DAY_MS).toISOString();
  }
  return {
    where: where.join(' and '),
    order: ORDERS[query.sort],
    params,
    limit: query.limit ?? null,
  };
}

/** `select id, rn` of a smart filter's games in its order (rn = 1..n), limit applied. */
export function smartFilterIdsSql(query: SmartFilterQuery, now: Date) {
  const { where, order, params, limit } = smartFilterSql(query, now);
  return {
    sql: `select g.id as id, row_number() over (order by ${order}) as rn
      from games g join game_metadata m on m.game_id = g.id
      left join game_user_state u on u.game_id = g.id
      where ${where} order by ${order} limit ${limit === null ? '-1' : String(limit)}`,
    params,
  };
}

/** The largest whole number in a players text (`'1-4'` → 4); none → 1. */
export function maxPlayers(text: unknown): number {
  if (typeof text !== 'string') return 1;
  const numbers = text.match(/\d+/g)?.map(Number) ?? [];
  return numbers.length > 0 ? Math.max(...numbers) : 1;
}

/** Registers the SQL functions smart filters use on a connection (idempotent). */
export function registerSmartFilterFunctions(client: Database.Database): void {
  client.function('max_players', { deterministic: true }, maxPlayers);
}
