import { createContext, useContext } from 'react';
import type { ThemeSettings } from './types.ts';

/** The active theme's merged settings (module ← pack ← user). Without a provider: `{}`. */
export const ThemeSettingsContext = createContext<ThemeSettings>({});

export function useThemeSettings(): ThemeSettings {
  return useContext(ThemeSettingsContext);
}
