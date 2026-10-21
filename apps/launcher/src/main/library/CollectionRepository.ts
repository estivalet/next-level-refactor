import {
  AppErrorException,
  ERROR_CODES,
  type CollectionSort,
  type CollectionSummary,
} from '@nextlevel/shared';
import Database from 'better-sqlite3';
import { notFound } from './GameRepository.ts';
import type { LibraryDb } from './openLibrary.ts';

const SUMMARY = `select c.id as id, c.name as name, c.sort as sort,
  (select count(*) from collection_games cg where cg.collection_id = c.id) as games
  from collections c`;

function nameTaken(error: unknown, name: string): unknown {
  if (error instanceof Database.SqliteError && error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
    return new AppErrorException({
      code: 'NAME_TAKEN',
      message: ERROR_CODES.NAME_TAKEN,
      details: { name },
    });
  }
  return error;
}

/**
 * User collections (FR-LIB-8): games from any system, ordered by hand or by a field. Positions
 * are kept dense (0..n-1); every multi-row change is one transaction (NFR-REL-1).
 */
export class CollectionRepository {
  constructor(
    private readonly db: LibraryDb,
    private readonly clock: () => Date,
  ) {}

  private get client() {
    return this.db.$client;
  }

  list(): CollectionSummary[] {
    return this.client
      .prepare(`${SUMMARY} order by c.name collate nocase, c.id`)
      .all() as CollectionSummary[];
  }

  private summary(id: number): CollectionSummary {
    const found = this.client.prepare(`${SUMMARY} where c.id = ?`).get(id) as
      CollectionSummary | undefined;
    if (!found) throw notFound({ collectionId: id });
    return found;
  }

  create(name: string): CollectionSummary {
    try {
      const { lastInsertRowid } = this.client
        .prepare('insert into collections (name, created_at) values (?, ?)')
        .run(name, this.clock().toISOString());
      return this.summary(Number(lastInsertRowid));
    } catch (error) {
      throw nameTaken(error, name);
    }
  }

  update(id: number, changes: { name?: string; sort?: CollectionSort }): CollectionSummary {
    this.summary(id);
    try {
      this.client
        .prepare(
          'update collections set name = coalesce(@name, name), sort = coalesce(@sort, sort) where id = @id',
        )
        .run({ id, name: changes.name ?? null, sort: changes.sort ?? null });
    } catch (error) {
      throw nameTaken(error, changes.name ?? '');
    }
    return this.summary(id);
  }

  delete(id: number): void {
    const { changes } = this.client.prepare('delete from collections where id = ?').run(id);
    if (changes === 0) throw notFound({ collectionId: id });
  }

  /** Appends games after the last one; games already in the collection keep their place. */
  addGames(id: number, gameIds: readonly number[]): CollectionSummary {
    const ids = [...new Set(gameIds)];
    this.client.transaction(() => {
      this.summary(id);
      const known = this.client
        .prepare('select count(*) from games where id in (select value from json_each(?))')
        .pluck()
        .get(JSON.stringify(ids)) as number;
      if (known !== ids.length) throw notFound({ gameIds: ids });
      let next = this.client
        .prepare(
          'select coalesce(max(position) + 1, 0) from collection_games where collection_id = ?',
        )
        .pluck()
        .get(id) as number;
      const insert = this.client.prepare(
        `insert into collection_games (collection_id, game_id, position) values (?, ?, ?)
         on conflict do nothing`,
      );
      for (const gameId of ids) {
        if (insert.run(id, gameId, next).changes > 0) next += 1;
      }
    })();
    return this.summary(id);
  }

  removeGames(id: number, gameIds: readonly number[]): CollectionSummary {
    this.client.transaction(() => {
      this.summary(id);
      this.client
        .prepare(
          'delete from collection_games where collection_id = ? and game_id in (select value from json_each(?))',
        )
        .run(id, JSON.stringify(gameIds));
      this.renumber(id, this.members(id));
    })();
    return this.summary(id);
  }

  /**
   * Swaps the places of two members (Move up / Move down with the neighbour shown). Hidden or
   * filtered-out members between them keep theirs.
   */
  reorder(id: number, gameId: number, swapWithGameId: number): void {
    this.client.transaction(() => {
      this.summary(id);
      const members = this.members(id);
      const from = members.indexOf(gameId);
      const to = members.indexOf(swapWithGameId);
      if (from === -1 || to === -1) throw notFound({ collectionId: id, gameId, swapWithGameId });
      members[from] = swapWithGameId;
      members[to] = gameId;
      this.renumber(id, members);
    })();
  }

  /** The collections a game belongs to. */
  membership(gameId: number): number[] {
    return this.client
      .prepare(
        'select collection_id from collection_games where game_id = ? order by collection_id',
      )
      .pluck()
      .all(gameId) as number[];
  }

  private members(id: number): number[] {
    return this.client
      .prepare(
        'select game_id from collection_games where collection_id = ? order by position, game_id',
      )
      .pluck()
      .all(id) as number[];
  }

  private renumber(id: number, members: readonly number[]): void {
    const update = this.client.prepare(
      'update collection_games set position = ? where collection_id = ? and game_id = ?',
    );
    members.forEach((gameId, index) => update.run(index, id, gameId));
  }
}
