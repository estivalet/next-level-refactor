import { asc, count, eq, sql } from 'drizzle-orm';
import { titleFromRelPath } from '../scan/discs.ts';
import type { LibraryDb } from './openLibrary.ts';
import { games } from './schema.ts';

const baseName = (relPath: string) => (relPath.split('/').pop() ?? relPath).toLowerCase();

/** A library row as the scan diff sees it. */
export interface ExistingGame {
  id: number;
  relPath: string;
  size: number;
  missing: boolean;
  locationId: string | null;
  mtime: number;
  discGroup: string | null;
}

/** A game file found by a scan; rel_path is relative to the system folder, with `/`. */
export interface FoundGame {
  relPath: string;
  locationId: string;
  size: number;
  mtime: number;
  discGroup: string | null;
}

/**
 * What a scan changes in one system. `present` holds found games whose row needs an update;
 * `unchanged` counts found games stored exactly as found. Every restored id is also in
 * `present` or `moved`.
 */
export interface SystemDiff {
  added: FoundGame[];
  present: Array<{ id: number; game: FoundGame }>;
  moved: Array<{ id: number; game: FoundGame }>;
  restored: number[];
  missing: number[];
  unchanged: number;
}

/** Games and their scan state in `library.db`. Rows are never deleted by a scan (FR-LIB-4). */
export class LibraryRepository {
  constructor(private readonly db: LibraryDb) {}

  listSystemGames(systemId: string): ExistingGame[] {
    return this.db
      .select({
        id: games.id,
        relPath: games.relPath,
        size: games.size,
        missing: games.missing,
        locationId: games.locationId,
        mtime: games.mtime,
        discGroup: games.discGroup,
      })
      .from(games)
      .where(eq(games.systemId, systemId))
      .orderBy(asc(games.id))
      .all();
  }

  /**
   * Applies one system's scan result in a single transaction (NFR-REL-1). Uses statements
   * prepared once on the client: building a Drizzle query per row cost ~1.6 s per 20k games on
   * the main thread.
   */
  applySystemDiff(systemId: string, diff: SystemDiff, now: Date): void {
    const at = now.toISOString();
    const statements = this.statements();
    this.db.$client.transaction(() => {
      for (const game of diff.added) {
        const title = titleFromRelPath(game.relPath);
        const { lastInsertRowid } = statements.insertGame.run({ systemId, ...game, addedAt: at });
        statements.insertMetadata.run({
          gameId: lastInsertRowid,
          title,
          sortTitle: title.toLowerCase(),
          updatedAt: at,
        });
      }
      for (const { id, game } of diff.moved) this.retitleRenamed(id, game.relPath);
      for (const { id, game } of [...diff.present, ...diff.moved]) {
        statements.updateFound.run({ id, ...game });
      }
      for (const id of diff.restored) statements.restore.run(id);
      for (const id of diff.missing) statements.markMissing.run({ id, at });
    })();
  }

  /**
   * A renamed file (a move that changed the file name) shows its new name, unless the user edited
   * the title (owner decision 2026-10-21). Runs before the row takes the new rel_path.
   */
  private retitleRenamed(id: number, relPath: string): void {
    const statements = this.statements();
    const row = statements.renameFacts.get(id) as
      { relPath: string; lockedFields: string } | undefined;
    if (!row || baseName(row.relPath) === baseName(relPath)) return;
    if ((JSON.parse(row.lockedFields) as string[]).includes('title')) return;
    const title = titleFromRelPath(relPath);
    statements.retitle.run({ id, title, sortTitle: title.toLowerCase() });
  }

  private prepared: ReturnType<LibraryRepository['prepare']> | null = null;

  private statements() {
    this.prepared ??= this.prepare();
    return this.prepared;
  }

  private prepare() {
    const client = this.db.$client;
    return {
      insertGame: client.prepare<{
        systemId: string;
        relPath: string;
        locationId: string;
        size: number;
        mtime: number;
        discGroup: string | null;
        addedAt: string;
      }>(
        `insert into games (system_id, rel_path, location_id, size, mtime, disc_group, added_at)
         values (@systemId, @relPath, @locationId, @size, @mtime, @discGroup, @addedAt)`,
      ),
      insertMetadata: client.prepare<{
        gameId: number | bigint;
        title: string;
        sortTitle: string;
        updatedAt: string;
      }>(
        `insert into game_metadata (game_id, title, sort_title, updated_at)
         values (@gameId, @title, @sortTitle, @updatedAt)`,
      ),
      // Takes the found rel_path too: a move, or a case-only rename (game.zip to Game.zip).
      updateFound: client.prepare<FoundGame & { id: number }>(
        `update games set rel_path = @relPath, location_id = @locationId, size = @size,
         mtime = @mtime, disc_group = @discGroup where id = @id`,
      ),
      renameFacts: client.prepare<[number]>(
        `select g.rel_path as relPath, m.locked_fields as lockedFields
         from games g join game_metadata m on m.game_id = g.id where g.id = ?`,
      ),
      retitle: client.prepare<{ id: number; title: string; sortTitle: string }>(
        'update game_metadata set title = @title, sort_title = @sortTitle where game_id = @id',
      ),
      restore: client.prepare<[number]>(
        'update games set missing = 0, missing_since = null where id = ?',
      ),
      markMissing: client.prepare<{ id: number; at: string }>(
        'update games set missing = 1, missing_since = @at where id = @id',
      ),
    };
  }

  /** Games per system (missing ones included), how many are missing and need review. */
  systemCounts(): Array<{ systemId: string; games: number; missing: number; review: number }> {
    return this.db
      .select({
        systemId: games.systemId,
        games: count(),
        missing: sql<number>`coalesce(sum(${games.missing}), 0)`,
        review: sql<number>`coalesce(sum(exists (select 1 from scrape_status s
          where s.game_id = ${games.id} and s.status = 'review')), 0)`,
      })
      .from(games)
      .groupBy(games.systemId)
      .orderBy(asc(games.systemId))
      .all();
  }
}
