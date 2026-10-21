import {
  AppErrorException,
  ERROR_CODES,
  type CollectionSort,
  type GameDetails,
  type GameListPage,
  type GameListQuery,
  type SearchResult,
} from '@nextlevel/shared';
import type Database from 'better-sqlite3';
import { ftsQuery, titlePrefixPattern } from './ftsQuery.ts';
import { ROW_COLUMNS, ROW_JOINS, listShape, toRow, type RawRow } from './gameSql.ts';
import type { LibraryDb } from './openLibrary.ts';

/** Where a game's file is expected; used only for missing games (FR-LIB-4). */
export type ResolvePath = (row: {
  systemId: string;
  locationId: string | null;
  relPath: string;
}) => string;

interface RawDetails extends RawRow {
  discGroup: string | null;
  missingSince: string | null;
  addedAt: string;
  developer: string | null;
  publisher: string | null;
  description: string | null;
  region: string | null;
  rating: number | null;
  lockedFields: string;
  playCount: number | null;
  lastPlayedAt: string | null;
}

export function notFound(details?: unknown): AppErrorException {
  return new AppErrorException({ code: 'NOT_FOUND', message: ERROR_CODES.NOT_FOUND, details });
}

/**
 * Reads games for the Library (FR-LIB-6, FR-LIB-10): pages of a system or collection, one game's
 * details, and global search over the FTS5 index. Statements are prepared once per query shape.
 */
export class GameRepository {
  private readonly statements = new Map<string, Database.Statement>();

  constructor(
    protected readonly db: LibraryDb,
    private readonly resolvePath: ResolvePath,
  ) {}

  protected statement(sql: string): Database.Statement {
    let prepared = this.statements.get(sql);
    if (!prepared) {
      prepared = this.db.$client.prepare(sql);
      this.statements.set(sql, prepared);
    }
    return prepared;
  }

  list(query: GameListQuery): GameListPage {
    const match = query.text === undefined ? null : ftsQuery(query.text);
    const collectionSort =
      query.scope.kind === 'collection' ? this.collectionSort(query.scope.collectionId) : null;
    const shape = listShape(query, collectionSort, match !== null);
    const params = {
      ...(query.scope.kind === 'system'
        ? { systemId: query.scope.systemId }
        : { collectionId: query.scope.collectionId }),
      ...(match === null ? {} : { match }),
    };
    const total = this.statement(`select count(*) ${shape.from}`).pluck().get(params) as number;
    const rows = this.statement(
      `select ${ROW_COLUMNS} ${shape.from} order by ${shape.order} limit @limit offset @offset`,
    ).all({ ...params, limit: query.limit, offset: query.offset }) as RawRow[];
    return {
      total,
      offset: query.offset,
      games: rows.map((row) => toRow(row, this.resolvePath)),
    };
  }

  private collectionSort(id: number): CollectionSort {
    const sort = this.statement('select sort from collections where id = ?').pluck().get(id) as
      CollectionSort | undefined;
    if (sort === undefined) throw notFound({ collectionId: id });
    return sort;
  }

  get(gameId: number): GameDetails {
    const raw = this.statement(
      `select ${ROW_COLUMNS}, g.disc_group as discGroup, g.missing_since as missingSince,
         g.added_at as addedAt, m.developer as developer, m.publisher as publisher,
         m.description as description, m.region as region, m.rating as rating,
         m.locked_fields as lockedFields, u.play_count as playCount,
         u.last_played_at as lastPlayedAt
       from games g ${ROW_JOINS} where g.id = ?`,
    ).get(gameId) as RawDetails | undefined;
    if (!raw) throw notFound({ gameId });
    const filters = this.statement(
      'select filter from game_filters where game_id = ? order by filter',
    )
      .pluck()
      .all(gameId) as string[];
    const collectionIds = this.statement(
      'select collection_id from collection_games where game_id = ? order by collection_id',
    )
      .pluck()
      .all(gameId) as number[];
    return {
      ...toRow(raw, this.resolvePath),
      relPath: raw.relPath,
      discGroup: raw.discGroup,
      missingSince: raw.missingSince,
      addedAt: raw.addedAt,
      developer: raw.developer,
      publisher: raw.publisher,
      description: raw.description,
      region: raw.region,
      rating: raw.rating,
      filters,
      lockedFields: JSON.parse(raw.lockedFields) as string[],
      playCount: raw.playCount ?? 0,
      lastPlayedAt: raw.lastPlayedAt,
      collectionIds,
    };
  }

  /**
   * Global search (FR-LIB-10, US-C3): titles starting with the text first, then FTS rank. Hidden
   * games are left out (owner decision 2026-10-21).
   */
  search(text: string, limit = 50): SearchResult {
    const match = ftsQuery(text);
    if (match === null) return { games: [], more: false };
    const rows = this.statement(
      `select ${ROW_COLUMNS}
       from games_fts f join games g on g.id = f.rowid ${ROW_JOINS}
       where games_fts match @match and coalesce(u.hidden, 0) = 0
       order by (m.sort_title like @prefix escape '\\') desc, bm25(games_fts), m.sort_title, g.id
       limit @limit`,
    ).all({ match, prefix: titlePrefixPattern(text), limit: limit + 1 }) as RawRow[];
    return {
      games: rows.slice(0, limit).map((row) => toRow(row, this.resolvePath)),
      more: rows.length > limit,
    };
  }

  /** The distinct systems of some games, for `library.changed`. */
  systemOf(gameIds: readonly number[]): string[] {
    return this.statement(
      'select distinct system_id from games where id in (select value from json_each(?))',
    )
      .pluck()
      .all(JSON.stringify(gameIds)) as string[];
  }
}
