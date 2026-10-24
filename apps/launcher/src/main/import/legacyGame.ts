import { FILTER_SLUG } from '@nextlevel/shared';
import { DISC_PATTERN, normalizeDiscName } from '../scan/discs.ts';

// Field rules shared by the games and collections mappers (FR-IMP-1, data model §6).

/** `./Homebrew\Star.bin` → `Homebrew/Star.bin`; empty names, bare folders and `..` → null. */
export function normalizeRelPath(filename: string): string | null {
  const path = filename
    .trim()
    .replace(/\\/g, '/')
    .replace(/^(\.\/)+/, '')
    .replace(/\/+$/, '');
  if (!path || path === '.' || path.split('/').includes('..')) return null;
  return path;
}

function stem(relPath: string): string {
  const name = relPath.split('/').pop() ?? relPath;
  const dot = name.lastIndexOf('.');
  return dot > 0 ? name.slice(0, dot) : name;
}

export const fileStem = stem;

/** The set name of a disc-tagged file (`Saga (Disc 2).chd` → `Saga`), else null (FR-LIB-5). */
export function discGroupOf(relPath: string): string | null {
  const name = stem(relPath);
  return DISC_PATTERN.test(name) ? normalizeDiscName(name) || null : null;
}

/** The disc number of a disc-tagged file, for ordering a set (Side B after A). */
export function discOrder(relPath: string): number {
  const match = DISC_PATTERN.exec(stem(relPath));
  if (!match) return 0;
  return Number(match[2]) * 2 + (match[3]?.toUpperCase() === 'B' ? 1 : 0);
}

const DATE = /^(\d{1,2})\/(\d{1,2})\/(\d{4}), (\d{1,2}):(\d{2}):(\d{2}) ([AP]M)$/;

/** `7/21/2026, 7:49:00 PM` (NextLevelOS `lastPlayedOn`, local time) → ISO; anything else → null. */
export function parseLastPlayed(value: string | undefined): string | null {
  const match = value ? DATE.exec(value.trim()) : null;
  if (!match) return null;
  const [month, day, year, hour, minute, second] = match.slice(1, 7).map(Number) as [
    number,
    number,
    number,
    number,
    number,
    number,
  ];
  if (month < 1 || month > 12 || hour < 1 || hour > 12 || minute > 59 || second > 59) return null;
  const hours = (hour % 12) + (match[7] === 'PM' ? 12 : 0);
  const date = new Date(year, month - 1, day, hours, minute, second);
  // Rejects 2/31 and the like, which Date would roll into the next month.
  return date.getMonth() === month - 1 && date.getDate() === day ? date.toISOString() : null;
}

/** `played` as a play count: `'20'`, `20` → 20; null, `''` or junk → 0. */
export function parsePlayCount(value: string | number | null | undefined): number {
  const count = typeof value === 'number' ? value : Number.parseInt(value ?? '', 10);
  return Number.isFinite(count) && count > 0 ? Math.floor(count) : 0;
}

/** A 4-digit year the metadata editor also accepts (1950–2100), else undefined. */
export function parseYear(value: string | number | undefined): number | undefined {
  const year = typeof value === 'number' ? value : /^\s*(\d{4})\s*$/.exec(value ?? '')?.[1];
  const number = Number(year);
  return Number.isInteger(number) && number >= 1950 && number <= 2100 ? number : undefined;
}

/** `msxdev_2003` → `msxdev-2003`; null when nothing slug-like is left. */
export function filterSlug(tag: string): string | null {
  const slug = tag
    .trim()
    .toLowerCase()
    .replace(/[\s_]+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40);
  return FILTER_SLUG.test(slug) ? slug : null;
}

/** Trimmed text, or undefined when empty or not text. */
export function text(value: unknown): string | undefined {
  if (typeof value === 'number') return String(value);
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

/** NextLevelOS marks folders with `folder: 1` (or `'1'`). */
export function isFolder(value: string | number | undefined): boolean {
  return value === 1 || value === '1' || value === 'true';
}
