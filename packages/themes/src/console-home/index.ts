import { DEFAULT_ART_CONFIG } from '../engine/useThemeArt.ts';
import type { ThemeModule } from '../engine/types.ts';
import { ConsoleHomeTheme } from './ConsoleHomeTheme.tsx';
import { CONSOLE_HOME_KEYMAP } from './keymap.ts';

export const consoleHomeTheme: ThemeModule = {
  id: 'console-home',
  nameKey: 'themes.consoleHome.name',
  descriptionKey: 'themes.consoleHome.description',
  art: { ...DEFAULT_ART_CONFIG, useVideoBackground: false },
  keymap: CONSOLE_HOME_KEYMAP,
  Component: ConsoleHomeTheme,
};
