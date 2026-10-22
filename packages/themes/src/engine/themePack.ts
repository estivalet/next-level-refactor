// Ported from NextLevelOS src/themes/engine/themePack.ts @ 3d530b7. Manifest parsing moved to
// @nextlevel/shared (main reads theme.json); here only the merge rules remain. Precedence
// follows data model §2.5: module defaults → pack theme.json → the user's Settings entry.
import type { ThemeArtOptions, ThemeManifest } from '@nextlevel/shared';
import type { ThemeArtConfig, ThemeSettings } from './types.ts';

const isObject = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value);

/** The keys of `options` that are set. */
const defined = (options: ThemeArtOptions | undefined): Partial<ThemeArtConfig> =>
  Object.fromEntries(Object.entries(options ?? {}).filter(([, value]) => value !== undefined));

/** Module art, then the pack's, then the user's; later wins per key. */
export function mergeThemeArt(
  moduleArt: ThemeArtConfig,
  packArt?: ThemeArtOptions,
  userArt?: ThemeArtOptions,
): ThemeArtConfig {
  return { ...moduleArt, ...defined(packArt), ...defined(userArt) };
}

/**
 * Module settings, then the pack's, then the user's. Objects under the same top-level key merge
 * key by key (later wins); any other value is replaced.
 */
export function mergeThemeSettings(...sources: Array<ThemeSettings | undefined>): ThemeSettings {
  const out: ThemeSettings = {};
  for (const source of sources) {
    if (!source) continue;
    for (const [key, value] of Object.entries(source)) {
      const previous = out[key];
      out[key] = isObject(previous) && isObject(value) ? { ...previous, ...value } : value;
    }
  }
  return out;
}

/** Whether the shared art folder is used: the manifest's `fallback` (default true), unless a
 * "Preview without fallback" is on. */
export function effectiveFallback(
  manifest: ThemeManifest | null,
  opts: { preview?: boolean } = {},
): boolean {
  if (opts.preview) return false;
  return manifest?.fallback ?? true;
}
