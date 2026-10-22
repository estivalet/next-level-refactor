import type { Settings } from '@nextlevel/shared';
import { resolveTheme, type ThemeModule } from '@nextlevel/themes';
import { useCallback, useEffect, useState } from 'react';
import { getBridge } from '../../bridge.ts';
import { frontendThemeId } from './frontendTheme.ts';

/**
 * The theme the front-end shows, and a switch to another one (FR-THM-1). A switch shows at once
 * and is saved as `themes.lastUsed`; it holds until the settings move off the theme they named
 * when the user switched (the save arriving, or a change made in Settings).
 */
export function useFrontendTheme(settings: Settings): {
  theme: ThemeModule;
  switchTo: (id: string) => void;
} {
  const settingsId = frontendThemeId(settings);
  const [pending, setPending] = useState<{ id: string; base: string } | null>(null);
  const theme = resolveTheme(pending && pending.base === settingsId ? pending.id : settingsId);

  useEffect(() => {
    void getBridge().invoke('frontend.themeOpened', { themeId: theme.id });
  }, [theme.id]);

  const switchTo = useCallback(
    (id: string) => {
      setPending({ id, base: settingsId });
    },
    [settingsId],
  );
  return { theme, switchTo };
}
