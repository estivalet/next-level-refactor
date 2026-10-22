import { DEFAULT_ART_CONFIG } from '../engine/useThemeArt.ts';
import type { ThemeModule } from '../engine/types.ts';
import { BigBoxListTheme } from './BigBoxListTheme.tsx';
import { BBL_KEYMAP } from './keymap.ts';

export const bigBoxListTheme: ThemeModule = {
  id: 'big-box-list',
  nameKey: 'themes.bigBoxList.name',
  descriptionKey: 'themes.bigBoxList.description',
  art: DEFAULT_ART_CONFIG,
  keymap: BBL_KEYMAP,
  Component: BigBoxListTheme,
};
