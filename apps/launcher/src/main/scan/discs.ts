// Disc rules ported from NextLevelOS scripts/nextlevel-gamelist-cleanup-multidisk.py @ 3d530b7.
import type { FoundGame } from '../library/LibraryRepository.ts';

/** "Disc 1", "Disk 2", "Tape 1 Side B", "Cassette 3" (FR-LIB-5). */
export const DISC_PATTERN = /\b(Disk|Disc|Tape|Cassette)\s+(\d+)(?:\s+Side\s+([AB]))?\b/i;
const SIDE_PATTERN = /\bSide\s+([AB])\b/gi;

function stem(relPath: string): string {
  const name = relPath.split('/').pop() ?? relPath;
  const dot = name.lastIndexOf('.');
  return dot > 0 ? name.slice(0, dot) : name;
}

/** A file stem without its disc tag: "Saga (USA) (Disc 1)" → "Saga (USA)". */
export function normalizeDiscName(fileStem: string): string {
  return fileStem
    .replace(new RegExp(DISC_PATTERN.source, 'gi'), '')
    .replace(SIDE_PATTERN, '')
    .replace(/\(\s*\)/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** The title a new game gets from its file: no folder, extension or disc tag; region tags stay. */
export function titleFromRelPath(relPath: string): string {
  return normalizeDiscName(stem(relPath)) || stem(relPath);
}

interface DiscFile {
  game: FoundGame;
  number: number;
  side: number;
}

const folderOf = (relPath: string) => relPath.slice(0, Math.max(0, relPath.lastIndexOf('/')));
const byRelPath = (a: FoundGame, b: FoundGame) => {
  const left = a.relPath.toLowerCase();
  const right = b.relPath.toLowerCase();
  return left < right ? -1 : left > right ? 1 : 0;
};

/**
 * Collapses loose multi-disc sets ("Saga (Disc 1)", "Saga (Disc 2)") in one folder into one game,
 * the first disc, tagged with the set name. An .m3u named like the set replaces it (FR-LIB-5).
 */
export function groupDiscs(files: readonly FoundGame[]): FoundGame[] {
  const playlists = new Set<string>();
  const groups = new Map<string, DiscFile[]>();
  const result: FoundGame[] = [];
  for (const game of files) {
    const name = stem(game.relPath);
    const folder = folderOf(game.relPath).toLowerCase();
    if (game.relPath.toLowerCase().endsWith('.m3u'))
      playlists.add(`${folder}/${name.toLowerCase()}`);
    const match = DISC_PATTERN.exec(name);
    if (!match) {
      result.push(game);
      continue;
    }
    const key = `${folder}/${normalizeDiscName(name).toLowerCase()}`;
    const disc = { game, number: Number(match[2]), side: match[3]?.toUpperCase() === 'B' ? 1 : 0 };
    groups.set(key, [...(groups.get(key) ?? []), disc]);
  }
  for (const [key, discs] of groups) {
    if (discs.length === 1) {
      result.push(...discs.map((disc) => disc.game));
      continue;
    }
    if (playlists.has(key)) continue;
    const [first] = discs.sort(
      (a, b) => a.number - b.number || a.side - b.side || byRelPath(a.game, b.game),
    );
    if (first) {
      result.push({ ...first.game, discGroup: normalizeDiscName(stem(first.game.relPath)) });
    }
  }
  return result.sort(byRelPath);
}
