import type { ExportView, GameScope } from '@nextlevel/shared';
import type { ExportGame } from '../export/formats.ts';
import type { ResolvePath } from './GameRepository.ts';
import { ROW_COLUMNS, listShape, type RawRow } from './gameSql.ts';
import type { LibraryDb } from './openLibrary.ts';
import { resolveScope } from './scopeQuery.ts';

interface RawExportRow extends RawRow {
  developer: string | null;
  publisher: string | null;
  description: string | null;
  region: string | null;
  rating: number | null;
  playCount: number | null;
  lastPlayedAt: string | null;
  addedAt: string;
  filters: string;
}

const EXPORT_COLUMNS = `${ROW_COLUMNS}, m.developer as developer, m.publisher as publisher,
  m.description as description, m.region as region, m.rating as rating,
  u.play_count as playCount, u.last_played_at as lastPlayedAt, g.added_at as addedAt,
  (select json_group_array(filter) from (select f.filter from game_filters f
    where f.game_id = g.id order by f.filter)) as filters`;

/**
 * Reads a scope's games for an export (FR-LIB-11): every game (hidden and missing too), or the
 * list as shown (tab, sort, filter, genre), in the Library's order. One query; an export is rare,
 * so nothing is cached.
 */
export class GameExportReader {
  constructor(
    private readonly db: LibraryDb,
    private readonly resolvePath: ResolvePath,
    private readonly systemName: (systemId: string) => string,
    private readonly clock: () => Date = () => new Date(),
  ) {}

  read(scope: GameScope, view: ExportView | null): ExportGame[] {
    const client = this.db.$client;
    const { collectionSort, smart, params } = resolveScope(
      (sql) => client.prepare(sql),
      scope,
      this.clock(),
    );
    const shape = listShape(
      { scope, tab: view?.tab ?? null, ...(view?.sort ? { sort: view.sort } : {}) },
      collectionSort,
      false,
      smart?.sql ?? null,
      { filter: view?.filter !== undefined, genre: view?.genre !== undefined },
    );
    const rows = client
      .prepare(`select ${EXPORT_COLUMNS} ${shape.from} order by ${shape.order}`)
      .all({
        ...params,
        ...(view?.filter === undefined ? {} : { filter: view.filter }),
        ...(view?.genre === undefined ? {} : { genre: view.genre }),
      }) as RawExportRow[];
    return rows.map((row) => this.toGame(row));
  }

  private toGame(row: RawExportRow): ExportGame {
    return {
      title: row.title,
      system: this.systemName(row.systemId),
      year: row.year,
      genre: row.genre,
      players: row.players,
      developer: row.developer,
      publisher: row.publisher,
      region: row.region,
      description: row.description,
      rating: row.rating,
      userRating: row.userRating,
      favorite: row.favorite === 1,
      completed: row.completed === 1,
      hidden: row.hidden === 1,
      missing: row.missing === 1,
      path: this.resolvePath(row),
      relPath: row.relPath,
      playCount: row.playCount ?? 0,
      lastPlayed: row.lastPlayedAt,
      added: row.addedAt,
      filters: JSON.parse(row.filters) as string[],
    };
  }
}
