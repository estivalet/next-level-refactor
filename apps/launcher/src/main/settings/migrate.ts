import { CURRENT_SCHEMA_VERSION } from '@nextlevel/shared';

export type MigrateResult = { kind: 'ok'; value: unknown } | { kind: 'newerVersion' };

type Json = Record<string, unknown>;

const isObject = (value: unknown): value is Json =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/** D16 renamed the title screenshot kind and dropped `screenshot-select` (no ScreenScraper kind). */
const RENAMED_KINDS: Record<string, string | null> = {
  'screenshot-title': 'screenshot-game-title',
  'screenshot-select': null,
};

function renameGameArt(gameArt: Json): Json {
  const result: Json = {};
  for (const [system, kinds] of Object.entries(gameArt)) {
    result[system] = Array.isArray(kinds)
      ? kinds.flatMap((kind: unknown) => {
          if (typeof kind !== 'string' || !(kind in RENAMED_KINDS)) return [kind];
          const renamed = RENAMED_KINDS[kind];
          return renamed ? [renamed] : [];
        })
      : kinds;
  }
  return result;
}

/** v1 → v2 (M6): game art kinds in saved theme options follow D16; new sections come from defaults. */
function toV2(record: Json): Json {
  const themes = record['themes'];
  if (!isObject(themes) || !isObject(themes['entries'])) return record;
  const entries: Json = {};
  for (const [id, entry] of Object.entries(themes['entries'])) {
    const art = isObject(entry) ? entry['art'] : undefined;
    entries[id] =
      isObject(entry) && isObject(art) && isObject(art['gameArt'])
        ? { ...entry, art: { ...art, gameArt: renameGameArt(art['gameArt']) } }
        : entry;
  }
  return { ...record, themes: { ...themes, entries } };
}

/**
 * Brings a parsed settings file up to the current schema version. Pure: the file on disk changes
 * at the next save, which backs up the old file first (data model §2.2).
 */
export function migrate(raw: unknown): MigrateResult {
  if (!isObject(raw)) return { kind: 'ok', value: raw };
  const version = raw['schemaVersion'] ?? 1;
  if (typeof version === 'number' && version > CURRENT_SCHEMA_VERSION)
    return { kind: 'newerVersion' };
  const value = version === 1 ? toV2(raw) : raw;
  return { kind: 'ok', value: { ...value, schemaVersion: version === 1 ? 2 : version } };
}
