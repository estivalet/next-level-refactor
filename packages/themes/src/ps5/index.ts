import { DEFAULT_ART_CONFIG } from '../engine/useThemeArt.ts';
import type { ThemeModule } from '../engine/types.ts';
import { PS5_KEYMAP } from './keymap.ts';
import { Ps5Theme } from './Ps5Theme.tsx';

export const ps5Theme: ThemeModule = {
  id: 'ps5',
  nameKey: 'themes.ps5.name',
  descriptionKey: 'themes.ps5.description',
  art: { ...DEFAULT_ART_CONFIG, useVideoBackground: true },
  keymap: PS5_KEYMAP,
  Component: Ps5Theme,
};
