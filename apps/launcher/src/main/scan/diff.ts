import type { ExistingGame, FoundGame, SystemDiff } from '../library/LibraryRepository.ts';

const basename = (relPath: string) => (relPath.split('/').pop() ?? relPath).toLowerCase();
const extension = (relPath: string) => /\.[^./]*$/.exec(basename(relPath))?.[0] ?? '';
const moveKey = (path: string, size: number) => `${basename(path)}|${String(size)}`;
/** A rename keeps the extension, size and modified time (Windows keeps mtime on rename). */
const renameKey = (path: string, size: number, mtime: number) =>
  `${extension(path)}|${String(size)}|${String(mtime)}`;

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

/**
 * Pairs found files with unmatched rows by key, when each is the only candidate for the other.
 * Returns the files left unpaired.
 */
function pairUnique(
  files: readonly FoundGame[],
  rows: readonly ExistingGame[],
  fileKey: (game: FoundGame) => string,
  rowKey: (row: ExistingGame) => string,
  pair: (row: ExistingGame, game: FoundGame) => void,
): FoundGame[] {
  const fileCounts = countBy(files, fileKey);
  const rowCounts = countBy(rows, rowKey);
  const rowsByKey = new Map(rows.map((row) => [rowKey(row), row]));
  const left: FoundGame[] = [];
  for (const game of files) {
    const key = fileKey(game);
    const row = rowsByKey.get(key);
    if (row && fileCounts.get(key) === 1 && rowCounts.get(key) === 1) pair(row, game);
    else left.push(game);
  }
  return left;
}

function countBy<T>(items: readonly T[], key: (item: T) => string): Map<string, number> {
  const counts = new Map<string, number>();
  for (const item of items) counts.set(key(item), (counts.get(key(item)) ?? 0) + 1);
  return counts;
}

/**
 * Compares a system's library rows with the files a scan found (FR-LIB-3). Matches ignore case;
 * a file whose name and size match exactly one unmatched row on both sides is that row moved, and
 * then one whose extension, size and mtime do is that row renamed (owner decision 2026-10-21).
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

  const move = (row: ExistingGame, game: FoundGame) => {
    matched.add(row.id);
    diff.moved.push({ id: row.id, game });
    if (row.missing) diff.restored.push(row.id);
  };
  const unmatchedRows = () => existing.filter((row) => !matched.has(row.id));
  const notMoved = pairUnique(
    unmatchedFound,
    unmatchedRows(),
    (game) => moveKey(game.relPath, game.size),
    (row) => moveKey(row.relPath, row.size),
    move,
  );
  const notRenamed = pairUnique(
    notMoved,
    unmatchedRows(),
    (game) => renameKey(game.relPath, game.size, game.mtime),
    (row) => renameKey(row.relPath, row.size, row.mtime),
    move,
  );
  diff.added.push(...notRenamed);

  for (const row of existing) {
    if (!matched.has(row.id) && !row.missing) diff.missing.push(row.id);
  }
  return diff;
}
