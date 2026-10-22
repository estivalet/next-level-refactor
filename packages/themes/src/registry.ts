// Ported from NextLevelOS src/themes/registry.ts @ 3d530b7: only the module list survives; which
// theme is active lives in the launcher's settings.themes (FR-THM-5), not localStorage.
import { bigBoxTheme } from './big-box/index.ts';
import { bigBoxListTheme } from './big-box-list/index.ts';
import { consoleHomeTheme } from './console-home/index.ts';
import { hyperspinTheme } from './hyperspin/index.ts';
import { ps5Theme } from './ps5/index.ts';
import type { ThemeModule } from './engine/types.ts';

/** Every bundled theme, in gallery order. Big Box is the default. */
export const THEMES: readonly ThemeModule[] = [
  bigBoxTheme,
  bigBoxListTheme,
  consoleHomeTheme,
  ps5Theme,
  hyperspinTheme,
];

export const THEME_IDS: readonly string[] = THEMES.map((theme) => theme.id);

export const DEFAULT_THEME_ID = 'big-box';

export function getTheme(id: string): ThemeModule | undefined {
  return THEMES.find((theme) => theme.id === id);
}

/** The theme with this id, or Big Box when the id is unknown or missing. */
export function resolveTheme(id: string | null | undefined): ThemeModule {
  return (id ? getTheme(id) : undefined) ?? bigBoxTheme;
}
