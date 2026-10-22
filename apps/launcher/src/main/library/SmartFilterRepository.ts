import {
  SmartFilterQuerySchema,
  type SmartFilterQuery,
  type SmartFilterSummary,
} from '@nextlevel/shared';
import { nameTaken } from './CollectionRepository.ts';
import { notFound } from './GameRepository.ts';
import type { LibraryDb } from './openLibrary.ts';
import { smartFilterIdsSql, smartFilterSql } from './smartFilterSql.ts';

const SEEDED_KEY = 'smart_filters_seeded';

interface RawFilter {
  id: number;
  name: string;
  query: string;
}

/** The names of the built-in smart filters, in the UI language (D10). */
export interface BuiltInNames {
  favorites: string;
  recent: string;
  mostPlayed: string;
}

/** Saved game queries usable as menu nodes and Library scopes (FR-LIB-9). */
export class SmartFilterRepository {
  constructor(
    private readonly db: LibraryDb,
    private readonly clock: () => Date,
  ) {}

  private get client() {
    return this.db.$client;
  }

  list(): SmartFilterSummary[] {
    const rows = this.client
      .prepare('select id, name, query from smart_filters order by name collate nocase, id')
      .all() as RawFilter[];
    return rows.map((row) => this.summarize(row));
  }

  create(name: string, query: SmartFilterQuery): SmartFilterSummary {
    try {
      const { lastInsertRowid } = this.client
        .prepare('insert into smart_filters (name, query, created_at) values (?, ?, ?)')
        .run(name, JSON.stringify(query), this.clock().toISOString());
      return this.summary(Number(lastInsertRowid));
    } catch (error) {
      throw nameTaken(error, name);
    }
  }

  update(id: number, changes: { name?: string; query?: SmartFilterQuery }): SmartFilterSummary {
    this.raw(id);
    try {
      this.client
        .prepare(
          'update smart_filters set name = coalesce(@name, name), query = coalesce(@query, query) where id = @id',
        )
        .run({
          id,
          name: changes.name ?? null,
          query: changes.query ? JSON.stringify(changes.query) : null,
        });
    } catch (error) {
      throw nameTaken(error, changes.name ?? '');
    }
    return this.summary(id);
  }

  delete(id: number): void {
    const { changes } = this.client.prepare('delete from smart_filters where id = ?').run(id);
    if (changes === 0) throw notFound({ smartFilterId: id });
  }

  /** Every smart filter's name by id, without counting games. */
  names(): Map<number, string> {
    const rows = this.client.prepare('select id, name from smart_filters').all() as Array<{
      id: number;
      name: string;
    }>;
    return new Map(rows.map((row) => [row.id, row.name]));
  }

  /** Whether it matches a present game now; a limit (≥ 1) never makes a match empty. */
  hasGames(id: number): boolean {
    const { where, params } = smartFilterSql(this.query(id), this.clock());
    return (
      this.client
        .prepare(
          `select exists (select 1 from games g join game_metadata m on m.game_id = g.id
             left join game_user_state u on u.game_id = g.id where ${where})`,
        )
        .pluck()
        .get(params) === 1
    );
  }

  /** The query of a smart filter. */
  query(id: number): SmartFilterQuery {
    return SmartFilterQuerySchema.parse(JSON.parse(this.raw(id).query));
  }

  /** Its present games' ids in its order, limit applied. */
  gameIds(id: number): number[] {
    const { sql, params } = smartFilterIdsSql(this.query(id), this.clock());
    return this.client
      .prepare(`select id from (${sql}) order by rn`)
      .pluck()
      .all(params) as number[];
  }

  /** Creates Favorites, Recently played and Most played once per library (D10). */
  seedBuiltIns(names: BuiltInNames): void {
    this.client.transaction(() => {
      const seeded = this.client.prepare('select 1 from meta where key = ?').get(SEEDED_KEY);
      if (seeded) return;
      const insert = this.client.prepare(
        `insert into smart_filters (name, query, created_at) values (?, ?, ?)
         on conflict do nothing`,
      );
      const now = this.clock().toISOString();
      const builtIns: Array<[string, unknown]> = [
        [names.favorites, { favorite: true }],
        [names.recent, { played: 'played', sort: 'lastPlayed', limit: 50 }],
        [names.mostPlayed, { played: 'played', sort: 'playCount', limit: 50 }],
      ];
      for (const [name, query] of builtIns) {
        insert.run(name, JSON.stringify(SmartFilterQuerySchema.parse(query)), now);
      }
      this.client.prepare("insert into meta (key, value) values (?, '1')").run(SEEDED_KEY);
    })();
  }

  private raw(id: number): RawFilter {
    const row = this.client
      .prepare('select id, name, query from smart_filters where id = ?')
      .get(id) as RawFilter | undefined;
    if (!row) throw notFound({ smartFilterId: id });
    return row;
  }

  private summary(id: number): SmartFilterSummary {
    return this.summarize(this.raw(id));
  }

  private summarize(row: RawFilter): SmartFilterSummary {
    const query = SmartFilterQuerySchema.parse(JSON.parse(row.query));
    const { sql, params } = smartFilterIdsSql(query, this.clock());
    const games = this.client
      .prepare(`select count(*) from (${sql})`)
      .pluck()
      .get(params) as number;
    return { id: row.id, name: row.name, query, games };
  }
}
