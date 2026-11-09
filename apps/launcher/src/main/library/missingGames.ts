import type Database from 'better-sqlite3';

export interface RemovedGames {
  /** The ids actually removed: missing games only, in the order asked. */
  removed: number[];
  /** Their systems, for `library.changed`. */
  systems: string[];
}

/**
 * Removes missing games from the library (FR-LIB-14). Present games and unknown ids are skipped:
 * main decides what may go, never the renderer. Every table that points at `games` cascades (the
 * FTS triggers fire on the cascaded `game_metadata` delete) and `launch_log` keeps its rows with a
 * null game. No file on disk is touched.
 */
export function removeMissingGames(
  client: Database.Database,
  gameIds: readonly number[],
): RemovedGames {
  return client.transaction(() => {
    const ids = JSON.stringify(gameIds);
    const missing = client
      .prepare(
        'select id, system_id as systemId from games where missing = 1 and id in (select value from json_each(?))',
      )
      .all(ids) as Array<{ id: number; systemId: string }>;
    const found = new Map(missing.map((row) => [row.id, row.systemId]));
    const removed = [...new Set(gameIds)].filter((id) => found.has(id));
    client
      .prepare('delete from games where missing = 1 and id in (select value from json_each(?))')
      .run(JSON.stringify(removed));
    const systems = [...new Set(removed.map((id) => found.get(id) ?? ''))].sort();
    return { removed, systems };
  })();
}
