import {
  AppErrorException,
  ERROR_CODES,
  type GameDetails,
  type GameFacets,
  type GameFlags,
  type GameListPage,
  type GameListQuery,
  type GameScope,
  type GameTab,
  type MetadataChanges,
  type ScrapeField,
  type SearchResult,
} from '@nextlevel/shared';
import type Database from 'better-sqlite3';
import { ftsQuery, titlePrefixPattern } from './ftsQuery.ts';
import { ROW_COLUMNS, ROW_JOINS, listShape, tabCountsSql, toRow, type RawRow } from './gameSql.ts';
import { SCRAPE_STATUS_COLUMNS, toScrapeStatus } from './ScrapeRepository.ts';
import { resolveScope } from './scopeQuery.ts';
import type { LibraryDb } from './openLibrary.ts';

/** Where a game's file is (or, when missing, was expected: FR-LIB-4), from library and settings. */
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

/** Metadata columns an edit may set; keys come from the shared schema, never raw input. */
const METADATA_COLUMNS = {
  title: 'title',
  year: 'year',
  developer: 'developer',
  publisher: 'publisher',
  genre: 'genre',
  players: 'players',
  description: 'description',
  region: 'region',
} as const;

/** Columns a scrape may set (FR-SCR-1); `rating` is the community rating, 0..5. */
const SCRAPE_COLUMNS = { ...METADATA_COLUMNS, rating: 'rating' } as const satisfies Partial<
  Record<ScrapeField | 'region', string>
>;

const FLAG_COLUMNS = {
  favorite: 'favorite',
  hidden: 'hidden',
  completed: 'completed',
  userRating: 'user_rating',
} as const;

interface FileRow {
  id: number;
  systemId: string;
  missing: number;
  relPath: string;
  locationId: string | null;
  size: number;
  mtime: number;
  discGroup: string | null;
}

type RelinkRefusal = 'same' | 'notMissing' | 'replacementMissing' | 'otherSystem';

function refuseRelink(reason: RelinkRefusal): AppErrorException {
  return new AppErrorException({
    code: 'VALIDATION_FAILED',
    message: ERROR_CODES.VALIDATION_FAILED,
    details: { reason },
  });
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
    private readonly clock: () => Date = () => new Date(),
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
    const { collectionSort, smart, params: scopeParams } = this.scope(query.scope);
    const shape = listShape(query, collectionSort, match !== null, smart?.sql ?? null, {
      filter: query.filter !== undefined,
      genre: query.genre !== undefined,
    });
    const params = {
      ...scopeParams,
      ...(match === null ? {} : { match }),
      ...(query.filter === undefined ? {} : { filter: query.filter }),
      ...(query.genre === undefined ? {} : { genre: query.genre }),
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

  /**
   * A scope's filter tags and genres with their game counts in a tab, by name (D62), and how many
   * games each tab of the scope has.
   */
  facets(scope: GameScope, tab: GameTab): GameFacets {
    const { smart, params } = this.scope(scope);
    const { from } = listShape({ scope, tab }, null, false, smart?.sql ?? null);
    const filters = this.statement(
      `select f.filter as value, count(*) as count from game_filters f
       where f.game_id in (select g.id ${from}) group by f.filter
       order by f.filter collate nocase`,
    ).all(params) as GameFacets['filters'];
    const genres = this.statement(
      `select m.genre as value, count(*) as count ${from} and m.genre is not null
       group by m.genre order by m.genre collate nocase`,
    ).all(params) as GameFacets['genres'];
    const tabs = this.statement(tabCountsSql(scope, smart?.sql ?? null)).get(
      params,
    ) as GameFacets['tabs'];
    return { filters, genres, tabs };
  }

  private scope(scope: GameScope) {
    return resolveScope((sql) => this.statement(sql), scope, this.clock());
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
    const scrape = toScrapeStatus(
      this.statement(
        `select ${SCRAPE_STATUS_COLUMNS} from scrape_status s where s.game_id = ?`,
      ).get(gameId) as Parameters<typeof toScrapeStatus>[0],
    );
    const media = this.statement('select kind, version from game_media where game_id = ?').all(
      gameId,
    ) as Array<{ kind: string; version: number }>;
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
      scrape,
      media: Object.fromEntries(media.map((row) => [row.kind, row.version])),
    };
  }

  /**
   * Global search (FR-LIB-10, US-C3): titles starting with the text first, then FTS rank. Hidden
   * games are left out (owner decision 2026-10-21), and so are collection-only ones.
   */
  search(text: string, limit = 50): SearchResult {
    const match = ftsQuery(text);
    if (match === null) return { games: [], more: false };
    const rows = this.statement(
      `select ${ROW_COLUMNS}
       from games_fts f join games g on g.id = f.rowid ${ROW_JOINS}
       where games_fts match @match and coalesce(u.hidden, 0) = 0 and g.collection_only = 0
       order by (m.sort_title like @prefix escape '\\') desc, bm25(games_fts), m.sort_title, g.id
       limit @limit`,
    ).all({ match, prefix: titlePrefixPattern(text), limit: limit + 1 }) as RawRow[];
    return {
      games: rows.slice(0, limit).map((row) => toRow(row, this.resolvePath)),
      more: rows.length > limit,
    };
  }

  /**
   * Saves the user's edits (FR-LIB-6) in one transaction. Every edited field joins
   * `locked_fields`, so later scrapes leave it alone; the FTS index follows the title by trigger.
   */
  updateMetadata(gameId: number, changes: MetadataChanges, now: Date): GameDetails {
    this.db.$client.transaction(() => {
      const locked = this.statement('select locked_fields from game_metadata where game_id = ?')
        .pluck()
        .get(gameId) as string | undefined;
      if (locked === undefined) throw notFound({ gameId });
      const sets: string[] = [];
      const params: Record<string, unknown> = { gameId, updatedAt: now.toISOString() };
      for (const [field, column] of Object.entries(METADATA_COLUMNS)) {
        const value = changes[field as keyof typeof METADATA_COLUMNS];
        if (value === undefined) continue;
        sets.push(`${column} = @${field}`);
        params[field] = value;
      }
      if (changes.title !== undefined) {
        sets.push('sort_title = @sortTitle');
        params.sortTitle = changes.title.toLowerCase();
      }
      if (changes.filters !== undefined) {
        this.statement('delete from game_filters where game_id = ?').run(gameId);
        const insert = this.statement('insert into game_filters (game_id, filter) values (?, ?)');
        for (const filter of new Set(changes.filters)) insert.run(gameId, filter);
      }
      const fields = new Set([...(JSON.parse(locked) as string[]), ...Object.keys(changes)]);
      params.lockedFields = JSON.stringify([...fields].sort());
      sets.push('locked_fields = @lockedFields', 'updated_at = @updatedAt');
      this.statement(`update game_metadata set ${sets.join(', ')} where game_id = @gameId`).run(
        params,
      );
    })();
    return this.get(gameId);
  }

  /**
   * Writes scraped metadata (FR-SCR-1, D19) in one transaction: only unlocked fields, plus locked
   * ones the user ticked on purpose (`overrideLocked`). Scraped values never lock a field, and a
   * null value (nothing scraped) leaves the field as it is.
   */
  applyScraped(
    gameId: number,
    values: Partial<Record<ScrapeField, string | number | null>>,
    opts: { overrideLocked: readonly ScrapeField[] },
    now: Date,
  ): GameDetails {
    this.db.$client.transaction(() => {
      const locked = this.statement('select locked_fields from game_metadata where game_id = ?')
        .pluck()
        .get(gameId) as string | undefined;
      if (locked === undefined) throw notFound({ gameId });
      const lockedFields = new Set(JSON.parse(locked) as string[]);
      const sets: string[] = [];
      const params: Record<string, unknown> = { gameId, updatedAt: now.toISOString() };
      for (const [field, column] of Object.entries(SCRAPE_COLUMNS)) {
        const value = values[field as ScrapeField];
        if (value === undefined || value === null) continue;
        if (lockedFields.has(field) && !opts.overrideLocked.includes(field as ScrapeField))
          continue;
        sets.push(`${column} = @${field}`);
        params[field] = value;
        if (field === 'title') {
          sets.push('sort_title = @sortTitle');
          params.sortTitle = String(value).toLowerCase();
        }
      }
      if (sets.length === 0) return;
      sets.push('updated_at = @updatedAt');
      this.statement(`update game_metadata set ${sets.join(', ')} where game_id = @gameId`).run(
        params,
      );
    })();
    return this.get(gameId);
  }

  /** Favorite, hidden and the user's rating for several games at once (FR-LIB-7). */
  setFlags(gameIds: readonly number[], flags: GameFlags): void {
    const ids = [...new Set(gameIds)];
    const sets = Object.entries(FLAG_COLUMNS)
      .filter(([flag]) => flags[flag as keyof GameFlags] !== undefined)
      .map(([flag, column]) => `${column} = @${flag}`);
    const params = {
      favorite: flags.favorite === undefined ? undefined : Number(flags.favorite),
      hidden: flags.hidden === undefined ? undefined : Number(flags.hidden),
      completed: flags.completed === undefined ? undefined : Number(flags.completed),
      userRating: flags.userRating,
    };
    this.db.$client.transaction(() => {
      const known = this.statement(
        'select count(*) from games where id in (select value from json_each(?))',
      )
        .pluck()
        .get(JSON.stringify(ids)) as number;
      if (known !== ids.length) throw notFound({ gameIds: ids });
      const ensure = this.statement(
        'insert into game_user_state (game_id) values (?) on conflict do nothing',
      );
      const update = this.statement(
        `update game_user_state set ${sets.join(', ')} where game_id = @gameId`,
      );
      for (const gameId of ids) {
        ensure.run(gameId);
        update.run(
          Object.fromEntries(
            Object.entries({ ...params, gameId }).filter(([, value]) => value !== undefined),
          ),
        );
      }
    })();
  }

  /**
   * Moves a missing game onto another game's file (FR-LIB-3, owner decision 2026-10-21): the
   * missing row keeps its id, metadata, flags and collections; the other row is deleted.
   */
  relink(missingGameId: number, replacementGameId: number): GameDetails {
    this.db.$client.transaction(() => {
      const read = this.statement(
        `select id, system_id as systemId, missing, rel_path as relPath, location_id as locationId,
           size, mtime, disc_group as discGroup from games where id = ?`,
      );
      const missing = read.get(missingGameId) as FileRow | undefined;
      const replacement = read.get(replacementGameId) as FileRow | undefined;
      if (!missing || !replacement) throw notFound({ missingGameId, replacementGameId });
      if (missing.id === replacement.id) throw refuseRelink('same');
      if (missing.missing !== 1) throw refuseRelink('notMissing');
      if (replacement.missing === 1) throw refuseRelink('replacementMissing');
      if (missing.systemId !== replacement.systemId) throw refuseRelink('otherSystem');
      // Delete first: the rel_path is unique per system.
      this.statement('delete from games where id = ?').run(replacement.id);
      this.statement(
        `update games set rel_path = @relPath, location_id = @locationId, size = @size,
           mtime = @mtime, disc_group = @discGroup, missing = 0, missing_since = null
         where id = @id`,
      ).run({ ...replacement, id: missing.id });
    })();
    return this.get(missingGameId);
  }

  /** The file of a game, resolved from the library only (never from renderer input). */
  filePath(gameId: number): { path: string; missing: boolean } {
    const row = this.statement(
      `select system_id as systemId, location_id as locationId, rel_path as relPath, missing
       from games where id = ?`,
    ).get(gameId) as
      { systemId: string; locationId: string | null; relPath: string; missing: number } | undefined;
    if (!row) throw notFound({ gameId });
    return { path: this.resolvePath(row), missing: row.missing === 1 };
  }

  /** Where a game's file lives in library terms (for its media folder, FR-SCR-4). */
  location(gameId: number): { systemId: string; locationId: string | null; relPath: string } {
    const row = this.statement(
      'select system_id as systemId, location_id as locationId, rel_path as relPath from games where id = ?',
    ).get(gameId) as { systemId: string; locationId: string | null; relPath: string } | undefined;
    if (!row) throw notFound({ gameId });
    return row;
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
