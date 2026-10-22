import { ThemeArtOptionsSchema, type ThemeArtOptions, type ThemeManifest } from './schema.ts';

const isObject = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value);

/** Keeps each valid `art` key and drops the others with a warning. */
function parseArt(raw: unknown, warnings: string[]): ThemeArtOptions {
  if (!isObject(raw)) {
    warnings.push('art must be an object; ignored');
    return {};
  }
  const shape = ThemeArtOptionsSchema.shape;
  const out: Record<string, unknown> = {};
  for (const key of Object.keys(shape) as (keyof typeof shape)[]) {
    if (!(key in raw)) continue;
    const parsed = shape[key].safeParse(raw[key]);
    if (parsed.success) out[key] = parsed.data;
    else warnings.push(`art.${key} has the wrong type; ignored`);
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
): { manifest: ThemeManifest | null; warnings: string[] } {
  const warnings: string[] = [];
  if (!isObject(json)) {
    return { manifest: null, warnings: ['theme.json is not an object; ignored'] };
  }
  if (json['id'] !== expectedId) {
    const found = JSON.stringify(json['id']);
    return {
      manifest: null,
      warnings: [`theme.json id ${found} does not match the folder; ignored`],
    };
  }
  const fallback = json['fallback'];
  if (fallback !== undefined && typeof fallback !== 'boolean') {
    return { manifest: null, warnings: ['theme.json fallback must be a boolean; ignored'] };
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
    else warnings.push('settings must be an object; ignored');
  }
  return { manifest, warnings };
}
