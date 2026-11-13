import type { SyncEntries } from '@nextlevel/shared';
import type { LibraryDb } from '../library/openLibrary.ts';
import type { LocalView } from './merge.ts';

/** What one kind's adapter read from this PC, for one sync of that kind. */
export interface KindRead {
  view: LocalView;
  /** Whether merged entries for `key` can be applied here (its game exists, …). */
  present: (key: string) => boolean;
  /** Whether this PC has the game `subject` (kept as `held` for the next sync). */
  hasSubject: (subject: string) => boolean;
}

/**
 * One sync document kind on this PC (D55). `read` runs right before the merge, `apply` right
 * after, with the keys whose value changed (merge.changedKeys); both see `remote` so a
 * collection made on two PCs with the same name can become one.
 */
export interface KindAdapter {
  read(base: SyncEntries, remote: SyncEntries): KindRead;
  apply(merged: SyncEntries, keys: readonly string[], read: KindRead): void | Promise<void>;
}

interface GameRow {
  id: number;
  systemId: string;
  relPath: string;
  source: 'local' | 'catalog';
  catalogItemId: string | null;
}

/** A game's sync key: the catalog item, else system + path inside its storage location. */
export function gameKey(game: Omit<GameRow, 'id'>): string {
  if (game.source === 'catalog' && game.catalogItemId) return `catalog:${game.catalogItemId}`;
  return `${game.systemId}/${game.relPath.replace(/\\/g, '/').toLowerCase()}`;
}

/** Every game of the library by sync key. */
export function gameIndex(db: LibraryDb): Map<string, number> {
  const rows = db.$client
    .prepare(
      `select id, system_id as systemId, rel_path as relPath, source,
         catalog_item_id as catalogItemId from games order by id`,
    )
    .all() as GameRow[];
  const index = new Map<string, number>();
  for (const row of rows) {
    const key = gameKey(row);
    // Two paths that differ only in case are one game to sync; the first keeps the state.
    if (!index.has(key)) index.set(key, row.id);
  }
  return index;
}

/** `prefix<a>|<b>` → [a, b]; the first `|` splits (sync ids and device keys have none). */
export function splitKey(key: string, prefix: string): [string, string] | null {
  if (!key.startsWith(prefix)) return null;
  const rest = key.slice(prefix.length);
  const bar = rest.indexOf('|');
  return bar < 0 ? null : [rest.slice(0, bar), rest.slice(bar + 1)];
}
