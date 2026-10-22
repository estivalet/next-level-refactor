import { DEFAULT_ART_CONFIG } from '../engine/useThemeArt.ts';
import type { ThemeModule } from '../engine/types.ts';
import { BigBoxTheme } from './BigBoxTheme.tsx';
import { BIG_BOX_KEYMAP } from './keymap.ts';

export const bigBoxTheme: ThemeModule = {
  id: 'big-box',
  nameKey: 'themes.bigBox.name',
  descriptionKey: 'themes.bigBox.description',
  art: DEFAULT_ART_CONFIG,
  keymap: BIG_BOX_KEYMAP,
  Component: BigBoxTheme,
};
