import type Database from 'better-sqlite3';

/**
 * A file's name for spotting versions of one game (FR-LIB-19): no folder, extension or `(…)` /
 * `[…]` tags, lower-cased. `! Translated/Coca-Cola Kid (Japan) [T-En by A].gg` → `coca-cola kid`.
 * Null when nothing is left, so tag-only names never group together.
 */
export function nameKey(relPath: unknown): string | null {
  if (typeof relPath !== 'string') return null;
  const name = relPath.split('/').pop() ?? relPath;
  const dot = name.lastIndexOf('.');
  const key = (dot > 0 ? name.slice(0, dot) : name)
    .replace(/\([^)]*\)|\[[^\]]*\]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
  return key === '' ? null : key;
}

/** Registers `name_key(rel_path)` on a library connection (idempotent). */
export function registerDuplicateFunctions(client: Database.Database): void {
  client.function('name_key', { deterministic: true }, nameKey);
}

/**
 * Games of the open system with another version in it (FR-LIB-19), matched by title or by
 * `name_key`. Hidden, missing and collection-only games never count, so a twin leaves with them.
 * Uncorrelated: SQLite runs it once per query. Needs `@systemId`.
 */
export const DUPLICATES_SQL = `g.id in (select id from (
  select g2.id as id,
    count(*) over (partition by lower(trim(m2.title))) as byTitle,
    case when name_key(g2.rel_path) is null then 1
      else count(*) over (partition by name_key(g2.rel_path)) end as byFile
  from games g2 join game_metadata m2 on m2.game_id = g2.id
  left join game_user_state u2 on u2.game_id = g2.id
  where g2.system_id = @systemId and g2.collection_only = 0 and g2.missing = 0
    and coalesce(u2.hidden, 0) = 0
) where byTitle > 1 or byFile > 1)`;
