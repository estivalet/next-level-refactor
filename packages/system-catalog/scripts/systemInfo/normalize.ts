import type { SystemInfo, SystemInfoModel, SystemInfoTopGame } from '@nextlevel/shared';

// Turns the owner's inconsistently keyed scraped system JSONs into museum entry fields
// (FR-MUS-1, FR-MUS-5). Pure; output respects SystemInfoSchema limits by trimming, dropping empty
// values and truncating over-long text.

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

/** Trimmed text (arrays joined with "; ", numbers stringified), cut to `max`; undefined if empty. */
export function cleanText(value: unknown, max: number): string | undefined {
  let text: string;
  if (typeof value === 'string') text = value;
  else if (typeof value === 'number' && Number.isFinite(value)) text = String(value);
  else if (Array.isArray(value)) {
    text = value
      .map((item) => cleanText(item, max))
      .filter((item): item is string => item !== undefined)
      .join('; ');
  } else return undefined;
  const trimmed = text.trim().slice(0, max).trim();
  return trimmed === '' ? undefined : trimmed;
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
const TEXT_MAX = {
  fullName: 200,
  manufacturer: 200,
  country: 80,
  generation: 40,
  unitsSold: 80,
  description: 20000,
  history: 20000,
  legacy: 20000,
  cpu: 300,
  ram: 300,
  graphics: 300,
  sound: 300,
  media: 300,
  display: 300,
  predecessor: 200,
  successor: 200,
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
const IGNORED_KEYS = ['name', 'id', 'systemId'];

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

function normalizeModel(raw: unknown): SystemInfoModel | null {
  if (!isRecord(raw)) return null;
  const name = firstValue(raw, ['model_name', 'model', 'name'], (v) => cleanText(v, 120));
  if (name === undefined) return null;
  const model: SystemInfoModel = { name };
  const releaseYear = firstValue(raw, ['release_year', 'released'], cleanYear);
  const launchPrice = firstValue(raw, ['price_at_launch', 'price_at_launch_usd', 'price_uk'], (v) =>
    cleanText(v, 60),
  );
  const cpu = firstValue(raw, ['cpu'], (v) => cleanText(v, 200));
  const ram = firstValue(raw, ['ram', 'memory'], (v) => cleanText(v, 200));
  const notes = firstValue(raw, ['notes', 'description'], (v) => cleanText(v, 4000));
  const imageUrl = firstValue(raw, ['image_example', 'image'], httpUrl);
  if (releaseYear !== undefined) model.releaseYear = releaseYear;
  if (launchPrice !== undefined) model.launchPrice = launchPrice;
  if (cpu !== undefined) model.cpu = cpu;
  if (ram !== undefined) model.ram = ram;
  if (notes !== undefined) model.notes = notes;
  if (imageUrl !== undefined) model.imageUrl = imageUrl;
  return model;
}

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

/** One scraped JSON object → entry fields. Never throws; unknown keys go to `dropped`. */
export function normalizeScraped(raw: unknown): NormalizeResult {
  const entry = emptyEntry();
  if (!isRecord(raw)) return { entry, dropped: [] };

  for (const field of Object.keys(TEXT_KEYS) as (keyof typeof TEXT_KEYS)[]) {
    const value = firstValue(raw, TEXT_KEYS[field], (v) => cleanText(v, TEXT_MAX[field]));
    if (value !== undefined) entry[field] = value;
  }
  const releaseYear = firstValue(raw, RELEASE_KEYS, cleanYear);
  if (releaseYear !== undefined) entry.releaseYear = releaseYear;
  const discontinuedYear = firstValue(raw, DISCONTINUED_KEYS, cleanYear);
  if (discontinuedYear !== undefined) entry.discontinuedYear = discontinuedYear;

  entry.models = listOf(raw, MODEL_KEYS, normalizeModel);
  entry.peripherals = listOf(raw, PERIPHERAL_KEYS, (item) => cleanText(item, 200) ?? null);
  entry.topGames = listOf(raw, GAME_KEYS, normalizeGame);

  if (
    entry.description !== undefined ||
    entry.history !== undefined ||
    entry.legacy !== undefined
  ) {
    entry.sources = [{ name: 'Wikipedia' }];
  }
  const dropped = Object.keys(raw).filter((key) => !KNOWN_KEYS.has(key));
  for (const key of LIST_KEYS) {
    if (key in raw && !Array.isArray(raw[key])) dropped.push(key);
  }
  return { entry, dropped };
}
