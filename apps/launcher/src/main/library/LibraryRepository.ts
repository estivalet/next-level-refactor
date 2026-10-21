import { asc, count, eq, sql } from 'drizzle-orm';
import { titleFromRelPath } from '../scan/discs.ts';
import type { LibraryDb } from './openLibrary.ts';
import { gameMetadata, games } from './schema.ts';

/** A library row as the scan diff sees it. */
export interface ExistingGame {
  id: number;
  relPath: string;
  size: number;
  missing: boolean;
}

/** A game file found by a scan; rel_path is relative to the system folder, with `/`. */
export interface FoundGame {
  relPath: string;
  locationId: string;
  size: number;
  mtime: number;
  discGroup: string | null;
}

/** What a scan changes in one system. Every restored id is also in `present` or `moved`. */
export interface SystemDiff {
  added: FoundGame[];
  present: Array<{ id: number; game: FoundGame }>;
  moved: Array<{ id: number; game: FoundGame }>;
  restored: number[];
  missing: number[];
}

/** Games and their scan state in `library.db`. Rows are never deleted by a scan (FR-LIB-4). */
export class LibraryRepository {
  constructor(private readonly db: LibraryDb) {}

  listSystemGames(systemId: string): ExistingGame[] {
    return this.db
      .select({ id: games.id, relPath: games.relPath, size: games.size, missing: games.missing })
      .from(games)
      .where(eq(games.systemId, systemId))
      .orderBy(asc(games.id))
      .all();
  }

  /** Applies one system's scan result in a single transaction (NFR-REL-1). */
  applySystemDiff(systemId: string, diff: SystemDiff, now: Date): void {
    const at = now.toISOString();
    this.db.transaction((tx) => {
      for (const game of diff.added) {
        const row = tx
          .insert(games)
          .values({
            systemId,
            relPath: game.relPath,
            locationId: game.locationId,
            size: game.size,
            mtime: game.mtime,
            discGroup: game.discGroup,
            addedAt: at,
          })
          .returning({ id: games.id })
          .get();
        const title = titleFromRelPath(game.relPath);
        tx.insert(gameMetadata)
          .values({ gameId: row.id, title, sortTitle: title.toLowerCase(), updatedAt: at })
          .run();
      }
      const seen = (id: number, game: FoundGame, relPath?: string) =>
        tx
          .update(games)
          .set({
            locationId: game.locationId,
            size: game.size,
            mtime: game.mtime,
            discGroup: game.discGroup,
            ...(relPath === undefined ? {} : { relPath }),
          })
          .where(eq(games.id, id))
          .run();
      for (const { id, game } of diff.present) seen(id, game);
      for (const { id, game } of diff.moved) seen(id, game, game.relPath);
      for (const id of diff.restored) {
        tx.update(games).set({ missing: false, missingSince: null }).where(eq(games.id, id)).run();
      }
      for (const id of diff.missing) {
        tx.update(games).set({ missing: true, missingSince: at }).where(eq(games.id, id)).run();
      }
    });
  }

  /** Games per system (missing ones included) and how many are missing. */
  systemCounts(): Array<{ systemId: string; games: number; missing: number }> {
    return this.db
      .select({
        systemId: games.systemId,
        games: count(),
        missing: sql<number>`coalesce(sum(${games.missing}), 0)`,
      })
      .from(games)
      .groupBy(games.systemId)
      .orderBy(asc(games.systemId))
      .all();
  }
}
