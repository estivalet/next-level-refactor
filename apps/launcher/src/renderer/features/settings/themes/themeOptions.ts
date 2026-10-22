import type {
  ArtIndex,
  Settings,
  ThemeArtOptions,
  ThemeOptions,
  WheelOptions,
} from '@nextlevel/shared';

// Edits of `settings.themes.entries[id]` (FR-THM-4, data model §2.5). A value of undefined
// removes the key, so the theme's default (module, then pack) applies again; empty objects are
// dropped, and a theme without options has no entry.

type Entry = ThemeOptions;

const prune = <T extends Record<string, unknown>>(value: T): T | undefined => {
  const kept = Object.fromEntries(Object.entries(value).filter(([, v]) => v !== undefined));
  return Object.keys(kept).length > 0 ? (kept as T) : undefined;
};

function withEntry(settings: Settings, themeId: string, change: (entry: Entry) => Entry): Settings {
  const { [themeId]: current, ...others } = settings.themes.entries;
  const next = prune(change(current ?? {}) as Record<string, unknown>) as Entry | undefined;
  return {
    ...settings,
    themes: { ...settings.themes, entries: next ? { ...others, [themeId]: next } : others },
  };
}

export function setArtOption<K extends keyof ThemeArtOptions>(
  settings: Settings,
  themeId: string,
  key: K,
  value: ThemeArtOptions[K] | undefined,
): Settings {
  return withEntry(settings, themeId, (entry) => ({
    ...entry,
    art: prune({ ...entry.art, [key]: value }),
  }));
}

export function setThemeSetting(
  settings: Settings,
  themeId: string,
  key: string,
  value: unknown,
): Settings {
  return withEntry(settings, themeId, (entry) => ({
    ...entry,
    settings: prune({ ...entry.settings, [key]: value }),
  }));
}

/** One key of HyperSpin's `wheel` or `menuWheel` (the others stay). */
export function setWheelOption<K extends keyof WheelOptions>(
  settings: Settings,
  themeId: string,
  wheel: 'wheel' | 'menuWheel',
  key: K,
  value: WheelOptions[K] | undefined,
): Settings {
  const current = settings.themes.entries[themeId]?.settings?.[wheel];
  const object = current && typeof current === 'object' ? (current as WheelOptions) : {};
  return setThemeSetting(settings, themeId, wheel, prune({ ...object, [key]: value }));
}

export function resetThemeOptions(settings: Settings, themeId: string): Settings {
  return withEntry(settings, themeId, () => ({}));
}

/** Logo variants (`logo/<variant>/`) and background folders (`background/<style>`, not the
 * wallpaper) that exist in the theme's pack or the shared art folder. */
export function artFolders(index: ArtIndex | undefined): {
  logoVariants: string[];
  backgroundVariants: string[];
} {
  const logos = new Set<string>();
  const backgrounds = new Set<string>();
  for (const file of [...(index?.packFiles ?? []), ...(index?.assetsFiles ?? [])]) {
    const [root, folder, ...rest] = file.split('/');
    if (!folder || rest.length === 0) continue;
    if (root === 'logo') logos.add(folder);
    if (root === 'background' && folder !== 'wallpaper') backgrounds.add(`background/${folder}`);
  }
  return { logoVariants: [...logos].sort(), backgroundVariants: [...backgrounds].sort() };
}
