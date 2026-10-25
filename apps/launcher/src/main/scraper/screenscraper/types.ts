// ScreenScraper API shapes, kept loose on purpose: the API returns strings for numbers, objects or
// arrays depending on the game, and `{}` placeholders for empty results. Readers check each field
// before use (as the NextLevelOS port did) instead of rejecting a whole game.

export interface SsText {
  region?: unknown;
  langue?: unknown;
  text?: unknown;
  nom?: unknown;
}

export interface SsMedia {
  type?: unknown;
  region?: unknown;
  url?: unknown;
  format?: unknown;
}

/** A `jeu` from `jeuInfos.php` or one entry of `jeuRecherche.php`'s `jeux`. */
export interface SsGame {
  id?: unknown;
  noms?: unknown;
  regions?: unknown;
  synopsis?: unknown;
  dates?: unknown;
  developpeur?: unknown;
  editeur?: unknown;
  genres?: unknown;
  joueurs?: unknown;
  note?: unknown;
  medias?: unknown;
  systeme?: unknown;
}

/** `ssuser` from any response: quota and limits of the account (or the anonymous user). */
export interface SsUser {
  id?: unknown;
  maxthreads?: unknown;
  maxrequestspermin?: unknown;
  requeststoday?: unknown;
  maxrequestsperday?: unknown;
}

export const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/** A non-empty trimmed string, or null. */
export const text = (value: unknown): string | null =>
  typeof value === 'string' && value.trim() !== '' ? value.trim() : null;

/** ScreenScraper sends numbers as strings; a positive integer or null. */
export function positiveInt(value: unknown): number | null {
  const n = typeof value === 'string' ? Number(value) : value;
  return typeof n === 'number' && Number.isInteger(n) && n > 0 ? n : null;
}
