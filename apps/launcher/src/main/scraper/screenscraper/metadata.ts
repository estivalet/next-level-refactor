// Reading game facts out of a ScreenScraper `jeu`, ported from NextLevelOS
// scrappers/ScreenScraper.py (extract_metadata, _get_game_names, _get_game_region) @ 3d530b7.
import type { ScrapeField } from '@nextlevel/shared';
import { REGIONS, removeAccents } from './titles.ts';
import { isRecord, text, type SsGame } from './types.ts';

export type ScrapedMetadata = Record<Exclude<ScrapeField, 'title'>, string | number | null>;

const YEAR_REGIONS = ['wor', 'us', 'eu', 'jp'];

const items = (value: unknown): Array<Record<string, unknown>> =>
  Array.isArray(value) ? value.filter(isRecord) : [];

/** The text in the first preferred language, else the first non-empty text. */
function byLanguage(list: unknown, langs: readonly string[]): string | null {
  const texts = items(list)
    .map((item) => ({ lang: item['langue'], value: text(item['text']) }))
    .filter((item): item is { lang: unknown; value: string } => item.value !== null);
  for (const lang of langs) {
    const hit = texts.find((item) => item.lang === lang);
    if (hit) return hit.value;
  }
  return texts[0]?.value ?? null;
}

function year(dates: unknown): number | null {
  const byRegion = new Map<string, string>();
  for (const item of items(dates)) {
    const region = text(item['region'])?.toLowerCase();
    const value = text(item['text']);
    if (region && value && !byRegion.has(region)) byRegion.set(region, value);
  }
  const fourDigits = (value: string | undefined) => {
    const match = value === undefined ? null : /^(\d{4})/.exec(value);
    return match ? Number(match[1]) : null;
  };
  const preferred = YEAR_REGIONS.find((region) => byRegion.has(region));
  if (preferred) return fourDigits(byRegion.get(preferred));
  for (const value of byRegion.values()) {
    const found = fourDigits(value);
    if (found !== null) return found;
  }
  return null;
}

/** ScreenScraper's note is 0–20; the library's rating is 0–5 with one decimal. */
function rating(note: unknown): number | null {
  const value = isRecord(note) ? Number(text(note['text'])) : NaN;
  if (!Number.isFinite(value) || value < 0 || value > 20) return null;
  return Math.round((value / 4) * 10) / 10;
}

const objectText = (value: unknown) => (isRecord(value) ? text(value['text']) : null);

/** Every metadata field but the title; missing or malformed fields are null. */
export function extractMetadata(game: SsGame, langs: readonly string[]): ScrapedMetadata {
  const firstGenre = items(game.genres)[0];
  return {
    description: byLanguage(game.synopsis, langs),
    year: year(game.dates),
    developer: objectText(game.developpeur),
    publisher: objectText(game.editeur),
    genre: firstGenre ? byLanguage(firstGenre['noms'], langs) : null,
    players: objectText(game.joueurs),
    rating: rating(game.note),
  };
}

/** Every name the game is known by, once each, in API order. */
export function gameNames(game: SsGame): string[] {
  const raw = game.noms;
  const values = Array.isArray(raw)
    ? raw.map((item: unknown) =>
        isRecord(item) ? (text(item['text']) ?? text(item['nom'])) : text(item),
      )
    : isRecord(raw)
      ? Object.values(raw).map(text)
      : [text(raw)];
  return [...new Set(values.filter((value): value is string => value !== null))];
}

/** The name for the preferred region (for the `title` field), else the first name. */
export function gameName(game: SsGame, regions: readonly string[]): string | null {
  const named = items(game.noms);
  for (const region of regions) {
    const hit = named.find((item) => item['region'] === region && text(item['text']));
    if (hit) return text(hit['text']);
  }
  return gameNames(game)[0] ?? null;
}

/** The game's region code from `regions[].nom`, or null. */
export function candidateRegion(game: SsGame): string | null {
  for (const item of items(game.regions)) {
    const value = text(item['nom']) ?? text(item['name']);
    const region = value ? REGIONS[removeAccents(value).toLowerCase()] : undefined;
    if (region) return region;
  }
  return null;
}

/** The first release date's year, as ScreenScraper wrote it. */
export function candidateYear(game: SsGame): string | null {
  const first = items(game.dates)[0];
  return text(first?.['text'])?.slice(0, 4) ?? null;
}
