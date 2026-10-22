import { DEFAULT_ART_CONFIG } from '../engine/useThemeArt.ts';
import type { ThemeModule } from '../engine/types.ts';
import { SHOWCASE_KEYMAP } from './keymap.ts';
import { ShowcaseTheme } from './ShowcaseTheme.tsx';

export const showcaseTheme: ThemeModule = {
  id: 'showcase',
  nameKey: 'themes.showcase.name',
  descriptionKey: 'themes.showcase.description',
  art: { ...DEFAULT_ART_CONFIG, useVideoBackground: true },
  settings: { filtersInMenu: false },
  keymap: SHOWCASE_KEYMAP,
  Component: ShowcaseTheme,
};
