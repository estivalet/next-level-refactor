import {
  BUILT_IN_THEME_IDS,
  ThemeArtOptionsSchema,
  themeSettingsSchema,
  type ImportItem,
  type LegacyThemes,
  type Settings,
} from '@nextlevel/shared';

type Themes = Settings['themes'];
const BUILT_IN = new Set<string>(BUILT_IN_THEME_IDS);

/** Keeps the keys `accepts` takes one by one; the rest are reported as dropped. */
function keepValid(
  values: Record<string, unknown>,
  accepts: (key: string, value: unknown) => boolean,
  report: (key: string) => void,
): Record<string, unknown> {
  const kept: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(values)) {
    if (accepts(key, value)) kept[key] = value;
    else report(key);
  }
  return kept;
}

/** `gameArt` keyed by NextLevelOS system name → keyed by system id (`default` stays). */
function mapGameArt(
  gameArt: unknown,
  match: (name: string) => string | null,
  items: ImportItem[],
): Record<string, unknown> | undefined {
  if (!gameArt || typeof gameArt !== 'object') return undefined;
  const mapped: Record<string, unknown> = {};
  for (const [name, kinds] of Object.entries(gameArt)) {
    const id = name === 'default' ? 'default' : match(name);
    if (id) mapped[id] = kinds;
    else items.push({ area: 'theme', key: name, reason: 'unknownSystem' });
  }
  return mapped;
}

/**
 * themes.json → `settings.themes` (FR-IMP-1): each built-in theme's art and settings, with
 * NextLevelOS winning over keys set here (D12), and the default theme. Unknown themes and keys
 * that don't validate are reported.
 */
export function mapThemes(
  legacy: LegacyThemes | null,
  current: Themes,
  match: (name: string) => string | null,
): { themes: Themes; items: ImportItem[] } {
  const items: ImportItem[] = [];
  if (!legacy) return { themes: current, items };
  const entries = { ...current.entries };
  for (const theme of legacy.themes) {
    if (!BUILT_IN.has(theme.id)) {
      items.push({ area: 'theme', key: theme.id, reason: 'unknownTheme' });
      continue;
    }
    const dropped = (key: string) => {
      items.push({ area: 'theme', key: `${theme.id}: ${key}`, reason: 'dropped' });
    };
    const rawArt = { ...(theme.art ?? {}) };
    if ('gameArt' in rawArt) rawArt['gameArt'] = mapGameArt(rawArt['gameArt'], match, items);
    const art = keepValid(
      rawArt,
      (key, value) =>
        key in ThemeArtOptionsSchema.shape &&
        ThemeArtOptionsSchema.safeParse({ [key]: value }).success,
      dropped,
    );
    const schema = themeSettingsSchema(theme.id);
    const settings = keepValid(
      theme.settings ?? {},
      (key, value) =>
        schema !== undefined && key in schema.shape && schema.safeParse({ [key]: value }).success,
      dropped,
    );
    const own = entries[theme.id] ?? {};
    entries[theme.id] = {
      ...own,
      ...(Object.keys(art).length > 0 ? { art: { ...own.art, ...art } } : {}),
      ...(Object.keys(settings).length > 0 ? { settings: { ...own.settings, ...settings } } : {}),
    };
    items.push({ area: 'theme', key: theme.id, reason: 'themeArt' });
  }
  const activeDefault =
    legacy.activeDefault && BUILT_IN.has(legacy.activeDefault)
      ? legacy.activeDefault
      : current.activeDefault;
  return { themes: { ...current, entries, activeDefault }, items };
}
