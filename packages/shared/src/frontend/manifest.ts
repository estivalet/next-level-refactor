import {
  ThemeArtOptionsSchema,
  type ArtIndexWarning,
  type ThemeArtOptions,
  type ThemeManifest,
} from './schema.ts';

const isObject = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value);

/** Keeps each valid `art` key and drops the others with a warning. */
function parseArt(raw: unknown, warnings: ArtIndexWarning[]): ThemeArtOptions {
  if (!isObject(raw)) {
    warnings.push({ code: 'manifestArtNotObject' });
    return {};
  }
  const shape = ThemeArtOptionsSchema.shape;
  const out: Record<string, unknown> = {};
  for (const key of Object.keys(shape) as (keyof typeof shape)[]) {
    if (!(key in raw)) continue;
    const parsed = shape[key].safeParse(raw[key]);
    if (parsed.success) out[key] = parsed.data;
    else warnings.push({ code: 'manifestArtWrongType', field: key });
  }
  return out;
}

/**
 * Validates a parsed pack `theme.json`. The whole manifest is ignored when it is not an object,
 * its `id` is not the folder name, or `fallback` is not a boolean; a wrong `art` key or
 * `settings` is dropped on its own. Never throws.
 */
export function parseThemeManifest(
  json: unknown,
  expectedId: string,
): { manifest: ThemeManifest | null; warnings: ArtIndexWarning[] } {
  const warnings: ArtIndexWarning[] = [];
  if (!isObject(json)) {
    return { manifest: null, warnings: [{ code: 'manifestNotObject' }] };
  }
  if (json['id'] !== expectedId) {
    // JSON.stringify(undefined) is undefined at runtime, whatever its type says.
    const found = (JSON.stringify(json['id']) as string | undefined) ?? 'undefined';
    return {
      manifest: null,
      warnings: [{ code: 'manifestIdMismatch', field: found.slice(0, 200) }],
    };
  }
  const fallback = json['fallback'];
  if (fallback !== undefined && typeof fallback !== 'boolean') {
    return { manifest: null, warnings: [{ code: 'manifestFallbackInvalid' }] };
  }
  const manifest: ThemeManifest = { id: expectedId };
  for (const key of ['version', 'author', 'description'] as const) {
    const value = json[key];
    if (typeof value === 'string') manifest[key] = value;
  }
  if (typeof fallback === 'boolean') manifest.fallback = fallback;
  if (json['art'] !== undefined) manifest.art = parseArt(json['art'], warnings);
  const settings = json['settings'];
  if (settings !== undefined) {
    if (isObject(settings)) manifest.settings = settings;
    else warnings.push({ code: 'manifestSettingsNotObject' });
  }
  return { manifest, warnings };
}
