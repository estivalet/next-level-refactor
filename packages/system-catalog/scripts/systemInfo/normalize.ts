import {
  SYSTEM_INFO_MODEL_LIMITS,
  SYSTEM_INFO_TEXT_LIMITS,
  type SystemInfo,
  type SystemInfoModel,
  type SystemInfoSource,
  type SystemInfoTopGame,
} from '@nextlevel/shared';

// Turns the owner's inconsistently keyed scraped system JSONs into museum entry fields
// (FR-MUS-1, FR-MUS-5). Pure; output respects SystemInfoSchema limits by trimming, dropping empty
// values and cutting over-long text at a word boundary (reported in `dropped`).

export type SystemInfoEntry = Omit<SystemInfo, 'systemId'>;
export interface NormalizeResult {
  entry: SystemInfoEntry;
  dropped: string[];
}

type Raw = Record<string, unknown>;

export const emptyEntry = (): SystemInfoEntry => ({
  models: [],
  peripherals: [],
  topGames: [],
  sources: [],
});

/**
 * `text` if it fits `max`, else cut after the last whole word that leaves room for "…". A single
 * word longer than `max` is cut hard, as there is no boundary to cut at.
 */
export function cutAtWord(text: string, max: number): string {
  if (text.length <= max) return text;
  const room = text.slice(0, max - 1);
  const lastSpace = /\s/u.test(text.charAt(max - 1)) ? room.length : room.search(/\s\S*$/u);
  const cut = (lastSpace > 0 ? room.slice(0, lastSpace) : room).replace(/[\s,;:]+$/u, '');
  return `${cut === '' ? room : cut}…`;
}

/**
 * Trimmed text (arrays joined with "; ", numbers stringified), cut at a word to `max`; undefined
 * if empty. `onTruncate` is called when the text had to be cut.
 */
export function cleanText(
  value: unknown,
  max: number,
  onTruncate?: () => void,
): string | undefined {
  let text: string;
  if (typeof value === 'string') text = value;
  else if (typeof value === 'number' && Number.isFinite(value)) text = String(value);
  else if (Array.isArray(value)) {
    text = value
      .map((item) => cleanText(item, max, onTruncate))
      .filter((item): item is string => item !== undefined)
      .join('; ');
  } else return undefined;
  const trimmed = text.trim();
  if (trimmed === '') return undefined;
  if (trimmed.length > max) onTruncate?.();
  return cutAtWord(trimmed, max);
}

/** A year in 1900-2100 from a number, or the first four-digit run in a string. */
export function cleanYear(value: unknown): number | undefined {
  let year: number | undefined;
  if (typeof value === 'number') year = value;
  else if (typeof value === 'string') {
    const match = /\d{4}/.exec(value);
    year = match ? Number(match[0]) : undefined;
  }
  return year !== undefined && Number.isInteger(year) && year >= 1900 && year <= 2100
    ? year
    : undefined;
}

function firstValue<T>(
  raw: Raw,
  keys: readonly string[],
  convert: (value: unknown) => T | undefined,
): T | undefined {
  for (const key of keys) {
    const value = convert(raw[key]);
    if (value !== undefined) return value;
  }
  return undefined;
}

const httpUrl = (value: unknown): string | undefined => {
  if (typeof value !== 'string') return undefined;
  try {
    const url = new URL(value.trim());
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.href : undefined;
  } catch {
    return undefined;
  }
};

/** Wikipedia text is CC BY-SA; every entry with story text credits it with the licence link. */
const WIKIPEDIA_LICENCE: SystemInfoSource = {
  name: 'Wikipedia (CC BY-SA 4.0)',
  url: 'https://creativecommons.org/licenses/by-sa/4.0/',
};
const IMAGE_PATH = /\.(?:jpe?g|png|gif|webp|svg)$/iu;
const PLACEHOLDER_HOST = /(?:^|\.)example\.(?:com|org)$/u;
const WIKIPEDIA_HOST = /(?:^|\.)wikipedia\.org$/u;

/** upload.wikimedia.org always; otherwise a non-placeholder host and an image file path. */
function isImageLink(href: string): boolean {
  const { hostname, pathname } = new URL(href);
  if (hostname === 'upload.wikimedia.org') return true;
  return !PLACEHOLDER_HOST.test(hostname) && IMAGE_PATH.test(pathname);
}

/** The first Wikipedia article URL among the scraped `references`. */
function wikipediaArticle(references: unknown): string | undefined {
  const list: unknown[] = Array.isArray(references) ? references : [references];
  return list
    .map(httpUrl)
    .find((href) => href !== undefined && WIKIPEDIA_HOST.test(new URL(href).hostname));
}

const TEXT_KEYS = {
  fullName: ['full_name'],
  manufacturer: ['manufacturer', 'brand', 'fabricante'],
  country: ['country_of_origin', 'country', 'país_de_origem'],
  generation: ['generation'],
  unitsSold: ['units_sold', 'sales'],
  description: ['description', 'descrição'],
  history: ['history_and_impact', 'impact'],
  legacy: ['legacy', 'legacyImpact', 'legado'],
  cpu: ['cpu'],
  ram: ['ram', 'memory'],
  graphics: ['graphics'],
  sound: ['sound'],
  media: ['storage_media', 'media', 'mídia_de_armazenamento'],
  display: ['display'],
  predecessor: ['predecessor'],
  successor: ['successor', 'notable_successor'],
} as const;

const MODEL_TEXT_KEYS = {
  launchPrice: ['price_at_launch', 'price_at_launch_usd', 'price_uk'],
  cpu: ['cpu'],
  ram: ['ram', 'memory'],
  notes: ['notes', 'description'],
} as const;

const RELEASE_KEYS = [
  'release_year',
  'initial_release_year',
  'first_release',
  'ano_de_lançamento',
  'releaseDate',
  'release_year_range',
];
const DISCONTINUED_KEYS = ['discontinued_year', 'ano_de_descontinuação', 'discontinuedDate'];
const MODEL_KEYS = ['models', 'modelos', 'modelsAndVariants'];
const PERIPHERAL_KEYS = ['peripherals', 'input_devices'];
const GAME_KEYS = ['notable_games', 'games_library', 'notable_software'];
const LIST_KEYS = [...MODEL_KEYS, ...PERIPHERAL_KEYS, ...GAME_KEYS];
// `references` is read only for the Wikipedia article link (FR-MUS-5).
const IGNORED_KEYS = ['name', 'id', 'systemId', 'references'];

const KNOWN_KEYS = new Set<string>([
  ...Object.values(TEXT_KEYS).flat(),
  ...RELEASE_KEYS,
  ...DISCONTINUED_KEYS,
  ...MODEL_KEYS,
  ...PERIPHERAL_KEYS,
  ...GAME_KEYS,
  ...IGNORED_KEYS,
]);

const isRecord = (value: unknown): value is Raw =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

type Report = (problem: string) => void;

/** A model normalizer that reports truncated fields and dropped image links to `report`. */
const modelNormalizer =
  (report: Report) =>
  (raw: unknown): SystemInfoModel | null => {
    if (!isRecord(raw)) return null;
    const name = firstValue(raw, ['model_name', 'model', 'name'], (v) =>
      cleanText(v, SYSTEM_INFO_MODEL_LIMITS.name, () => {
        report('models.name (truncated)');
      }),
    );
    if (name === undefined) return null;
    const model: SystemInfoModel = { name };
    const releaseYear = firstValue(raw, ['release_year', 'released'], cleanYear);
    if (releaseYear !== undefined) model.releaseYear = releaseYear;
    for (const field of Object.keys(MODEL_TEXT_KEYS) as (keyof typeof MODEL_TEXT_KEYS)[]) {
      const value = firstValue(raw, MODEL_TEXT_KEYS[field], (v) =>
        cleanText(v, SYSTEM_INFO_MODEL_LIMITS[field], () => {
          report(`models.${field} (truncated)`);
        }),
      );
      if (value !== undefined) model[field] = value;
    }
    const imageUrl = firstValue(raw, ['image_example', 'image'], httpUrl);
    if (imageUrl !== undefined && isImageLink(imageUrl)) model.imageUrl = imageUrl;
    else if (imageUrl !== undefined) report('imageUrl (not an image link)');
    return model;
  };

function normalizeGame(raw: unknown): SystemInfoTopGame | null {
  if (isRecord(raw)) {
    const title = firstValue(raw, ['title', 'name'], (v) => cleanText(v, 200));
    if (title === undefined) return null;
    const year = cleanYear(raw.year);
    return year === undefined ? { title } : { title, year };
  }
  const title = cleanText(raw, 200);
  return title === undefined ? null : { title };
}

function listOf<T>(raw: Raw, keys: readonly string[], map: (item: unknown) => T | null): T[] {
  const isFilled = (k: string): boolean => {
    const value = raw[k];
    return Array.isArray(value) && value.length > 0;
  };
  const key = keys.find(isFilled);
  if (key === undefined) return [];
  return (raw[key] as unknown[])
    .map(map)
    .filter((item): item is T => item !== null)
    .slice(0, 100);
}

/**
 * One scraped JSON object → entry fields. Never throws; unknown keys, truncated fields and
 * dropped image links go to `dropped`.
 */
export function normalizeScraped(raw: unknown): NormalizeResult {
  const entry = emptyEntry();
  if (!isRecord(raw)) return { entry, dropped: [] };
  const problems = new Set<string>();
  const report: Report = (problem) => {
    problems.add(problem);
  };

  for (const field of Object.keys(TEXT_KEYS) as (keyof typeof TEXT_KEYS)[]) {
    const value = firstValue(raw, TEXT_KEYS[field], (v) =>
      cleanText(v, SYSTEM_INFO_TEXT_LIMITS[field], () => {
        report(`${field} (truncated)`);
      }),
    );
    if (value !== undefined) entry[field] = value;
  }
  const releaseYear = firstValue(raw, RELEASE_KEYS, cleanYear);
  if (releaseYear !== undefined) entry.releaseYear = releaseYear;
  const discontinuedYear = firstValue(raw, DISCONTINUED_KEYS, cleanYear);
  if (discontinuedYear !== undefined) entry.discontinuedYear = discontinuedYear;

  entry.models = listOf(raw, MODEL_KEYS, modelNormalizer(report));
  entry.peripherals = listOf(raw, PERIPHERAL_KEYS, (item) => cleanText(item, 200) ?? null);
  entry.topGames = listOf(raw, GAME_KEYS, normalizeGame);

  if (
    entry.description !== undefined ||
    entry.history !== undefined ||
    entry.legacy !== undefined
  ) {
    const article = wikipediaArticle(raw.references);
    entry.sources =
      article === undefined
        ? [WIKIPEDIA_LICENCE]
        : [{ name: 'Wikipedia', url: article }, WIKIPEDIA_LICENCE];
  }
  const dropped = Object.keys(raw).filter((key) => !KNOWN_KEYS.has(key));
  for (const key of LIST_KEYS) {
    if (key in raw && !Array.isArray(raw[key])) dropped.push(key);
  }
  return { entry, dropped: [...dropped, ...problems] };
}
