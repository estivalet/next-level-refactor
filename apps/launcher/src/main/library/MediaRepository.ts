import { relocatedPath } from '@nextlevel/shared';
import type { GameMediaRow } from '../scan/media.ts';
import type { LibraryDb } from './openLibrary.ts';

const sameRows = (a: readonly GameMediaRow[], b: readonly GameMediaRow[]) => {
  const keyOf = (r: GameMediaRow) =>
    `${String(r.gameId)}\u0000${r.kind}\u0000${r.path}\u0000${String(r.size)}\u0000${String(r.version)}`;
  const left = new Set(a.map(keyOf));
  return a.length === b.length && b.every((row) => left.has(keyOf(row)));
};

/** The game media index (`game_media`, FR-THM-2): which media files exist per game and kind. */
export class MediaRepository {
  constructor(private readonly db: LibraryDb) {}

  /** Replaces a system's media rows in one transaction; true when anything changed. */
  replaceForSystem(systemId: string, rows: readonly GameMediaRow[]): boolean {
    const client = this.db.$client;
    const current = client
      .prepare(
        `select m.game_id as gameId, m.kind, m.path, m.size, m.version from game_media m
         join games g on g.id = m.game_id where g.system_id = ?`,
      )
      .all(systemId) as GameMediaRow[];
    if (sameRows(current, rows)) return false;
    const remove = client.prepare(
      'delete from game_media where game_id in (select id from games where system_id = ?)',
    );
    const insert = client.prepare(
      'insert into game_media (game_id, kind, path, size, version) values (?, ?, ?, ?, ?)',
    );
    client.transaction(() => {
      remove.run(systemId);
      for (const row of rows) insert.run(row.gameId, row.kind, row.path, row.size, row.version);
    })();
    return true;
  }

  /**
   * The NextLevel folder moved (D50): media files inside it are at the same place under the new
   * folder. One transaction; answers how many rows changed.
   */
  relocate(from: string, to: string): number {
    const client = this.db.$client;
    const rows = client.prepare('select rowid as id, path from game_media').all() as Array<{
      id: number;
      path: string;
    }>;
    const update = client.prepare('update game_media set path = ? where rowid = ?');
    let changed = 0;
    client.transaction(() => {
      for (const row of rows) {
        const next = relocatedPath(row.path, from, to);
        if (next === null) continue;
        update.run(next, row.id);
        changed += 1;
      }
    })();
    return changed;
  }

  /** Adds or replaces one game's file of a kind, e.g. after a scrape wrote it (FR-SCR-5). */
  upsert(row: GameMediaRow): void {
    this.db.$client
      .prepare(
        `insert into game_media (game_id, kind, path, size, version) values (?, ?, ?, ?, ?)
         on conflict (game_id, kind) do update set
           path = excluded.path, size = excluded.size, version = excluded.version`,
      )
      .run(row.gameId, row.kind, row.path, row.size, row.version);
  }

  /**
   * Points every row that named one of `paths` at the new file: games whose ROMs share a stem in
   * different subfolders share one art file (FR-SCR-5).
   */
  repoint(paths: readonly string[], file: { path: string; size: number; version: number }): void {
    this.db.$client
      .prepare(
        `update game_media set path = ?, size = ?, version = ?
         where path in (select value from json_each(?))`,
      )
      .run(file.path, file.size, file.version, JSON.stringify(paths));
  }

  /** File versions per kind for each game; games without media are absent. */
  versionsByGame(gameIds: readonly number[]): Map<number, Record<string, number>> {
    const result = new Map<number, Record<string, number>>();
    if (gameIds.length === 0) return result;
    const statement = this.db.$client.prepare(
      `select game_id as gameId, kind, version from game_media
       where game_id in (select value from json_each(?))`,
    );
    for (const row of statement.all(JSON.stringify(gameIds)) as Array<{
      gameId: number;
      kind: string;
      version: number;
    }>) {
      const versions = result.get(row.gameId) ?? {};
      versions[row.kind] = row.version;
      result.set(row.gameId, versions);
    }
    return result;
  }

  /** Indexed kinds per game, sorted; games without media are absent. */
  kindsByGame(gameIds: readonly number[]): Map<number, string[]> {
    const result = new Map<number, string[]>();
    if (gameIds.length === 0) return result;
    const statement = this.db.$client.prepare(
      `select game_id as gameId, kind from game_media
       where game_id in (select value from json_each(?)) order by game_id, kind`,
    );
    for (const row of statement.all(JSON.stringify(gameIds)) as Array<{
      gameId: number;
      kind: string;
    }>) {
      const kinds = result.get(row.gameId);
      if (kinds) kinds.push(row.kind);
      else result.set(row.gameId, [row.kind]);
    }
    return result;
  }

  path(gameId: number, kind: string): string | null {
    const row = this.db.$client
      .prepare('select path from game_media where game_id = ? and kind = ?')
      .get(gameId, kind) as { path: string } | undefined;
    return row?.path ?? null;
  }
}
