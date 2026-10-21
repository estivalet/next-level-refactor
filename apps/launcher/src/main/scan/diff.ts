import type { ExistingGame, FoundGame, SystemDiff } from '../library/LibraryRepository.ts';

const basename = (relPath: string) => (relPath.split('/').pop() ?? relPath).toLowerCase();
const moveKey = (relPath: string, size: number) => `${basename(relPath)}|${String(size)}`;

/** Same path (including case), place, size, time and disc set: nothing to write. */
function storedAsFound(row: ExistingGame, game: FoundGame): boolean {
  return (
    row.relPath === game.relPath &&
    row.locationId === game.locationId &&
    row.size === game.size &&
    row.mtime === game.mtime &&
    row.discGroup === game.discGroup
  );
}

function countBy<T>(items: readonly T[], key: (item: T) => string): Map<string, number> {
  const counts = new Map<string, number>();
  for (const item of items) counts.set(key(item), (counts.get(key(item)) ?? 0) + 1);
  return counts;
}

/**
 * Compares a system's library rows with the files a scan found (FR-LIB-3). Matches ignore case;
 * a file whose name and size match exactly one unmatched row on both sides is that row moved.
 * Rows that are not found go missing; nothing is ever deleted (FR-LIB-4).
 */
export function diffSystem(
  existing: readonly ExistingGame[],
  found: readonly FoundGame[],
): SystemDiff {
  const byPath = new Map(existing.map((row) => [row.relPath.toLowerCase(), row]));
  const diff: SystemDiff = {
    added: [],
    present: [],
    moved: [],
    restored: [],
    missing: [],
    unchanged: 0,
  };
  const matched = new Set<number>();
  const unmatchedFound: FoundGame[] = [];

  for (const game of found) {
    const row = byPath.get(game.relPath.toLowerCase());
    if (!row || matched.has(row.id)) {
      unmatchedFound.push(game);
      continue;
    }
    matched.add(row.id);
    if (row.missing) diff.restored.push(row.id);
    if (!row.missing && storedAsFound(row, game)) diff.unchanged += 1;
    else diff.present.push({ id: row.id, game });
  }

  const unmatchedRows = existing.filter((row) => !matched.has(row.id));
  const foundCounts = countBy(unmatchedFound, (game) => moveKey(game.relPath, game.size));
  const rowCounts = countBy(unmatchedRows, (row) => moveKey(row.relPath, row.size));
  const rowsByKey = new Map(unmatchedRows.map((row) => [moveKey(row.relPath, row.size), row]));

  for (const game of unmatchedFound) {
    const key = moveKey(game.relPath, game.size);
    const row = rowsByKey.get(key);
    if (row && foundCounts.get(key) === 1 && rowCounts.get(key) === 1) {
      matched.add(row.id);
      diff.moved.push({ id: row.id, game });
      if (row.missing) diff.restored.push(row.id);
    } else {
      diff.added.push(game);
    }
  }

  for (const row of existing) {
    if (!matched.has(row.id) && !row.missing) diff.missing.push(row.id);
  }
  return diff;
}
