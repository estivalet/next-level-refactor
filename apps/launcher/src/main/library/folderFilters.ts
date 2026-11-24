import {
  folderFilterRules,
  folderFiltersFingerprint,
  folderFiltersOf,
  type FolderFilters,
} from '@nextlevel/shared';
import type Database from 'better-sqlite3';

// Folder filters (FR-LIB-18): `game_filters` rows with source `folder`, worked out from each
// game's rel_path, never from the disk. The game's own rows (source `own`) are never touched.

const FINGERPRINT_KEY = 'folder_filters';

const rowKey = (gameId: number, filter: string) => `${String(gameId)}\u001f${filter}`;

/**
 * Brings the folder filters of every game (or one system's games) in line with their paths, in
 * one transaction, writing only what changed: an unchanged rescan writes nothing (FR-LIB-3).
 * Collection-only games get none: they are not in a system folder's list.
 */
export function refreshFolderFilters(
  client: Database.Database,
  settings: FolderFilters,
  systemId?: string,
): void {
  const rules = folderFilterRules(settings);
  const bySystem = systemId === undefined ? '' : 'and g.system_id = @systemId';
  const params = systemId === undefined ? {} : { systemId };
  const games = client.prepare(
    `select g.id, g.rel_path as relPath, g.collection_only as collectionOnly from games g
     where 1 = 1 ${bySystem}`,
  );
  const stored = client.prepare(
    `select f.game_id as gameId, f.filter from game_filters f join games g on g.id = f.game_id
     where f.source = 'folder' ${bySystem}`,
  );
  const insert = client.prepare(
    "insert into game_filters (game_id, filter, source) values (?, ?, 'folder')",
  );
  const remove = client.prepare(
    "delete from game_filters where game_id = ? and filter = ? and source = 'folder'",
  );
  client.transaction(() => {
    const stale = new Map<string, { gameId: number; filter: string }>();
    for (const row of stored.all(params) as Array<{ gameId: number; filter: string }>) {
      stale.set(rowKey(row.gameId, row.filter), row);
    }
    const rows = games.all(params) as Array<{
      id: number;
      relPath: string;
      collectionOnly: number;
    }>;
    for (const game of rows) {
      if (game.collectionOnly) continue;
      for (const filter of folderFiltersOf(game.relPath, rules)) {
        if (!stale.delete(rowKey(game.id, filter))) insert.run(game.id, filter);
      }
    }
    for (const { gameId, filter } of stale.values()) remove.run(gameId, filter);
  })();
}

/**
 * Applies the settings when they differ from the ones the library last applied (at start, after a
 * settings change); true when folder filters were recomputed.
 */
export function syncFolderFilters(client: Database.Database, settings: FolderFilters): boolean {
  const fingerprint = folderFiltersFingerprint(settings);
  const applied = client
    .prepare('select value from meta where key = ?')
    .pluck()
    .get(FINGERPRINT_KEY) as string | undefined;
  if (applied === fingerprint) return false;
  client.transaction(() => {
    refreshFolderFilters(client, settings);
    client
      .prepare('insert or replace into meta (key, value) values (?, ?)')
      .run(FINGERPRINT_KEY, fingerprint);
  })();
  return true;
}
