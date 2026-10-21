// Disc rules ported from NextLevelOS scripts/nextlevel-gamelist-cleanup-multidisk.py @ 3d530b7.

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
