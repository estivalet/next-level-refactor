import { DEFAULT_ART_CONFIG } from '../engine/useThemeArt.ts';
import type { ThemeModule } from '../engine/types.ts';
import { HyperspinTheme } from './HyperspinTheme.tsx';
import { HYPERSPIN_KEYMAP } from './keymap.ts';

export const hyperspinTheme: ThemeModule = {
  id: 'hyperspin',
  nameKey: 'themes.hyperspin.name',
  descriptionKey: 'themes.hyperspin.description',
  art: { ...DEFAULT_ART_CONFIG, logoVariant: 'steel', useVideoBackground: true },
  settings: { filtersInMenu: true },
  keymap: HYPERSPIN_KEYMAP,
  Component: HyperspinTheme,
};
