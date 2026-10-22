import type { Settings } from '@nextlevel/shared';
import { resolveTheme, type ThemeModule } from '@nextlevel/themes';
import { useCallback, useEffect, useState } from 'react';
import { getBridge } from '../../bridge.ts';
import { frontendThemeId } from './frontendTheme.ts';

interface PendingSwitch {
  id: string;
  /** Theme ids the settings may still pass through from our own saves (and the start). */
  ours: readonly string[];
}

/** The pending switch, while the settings only show our own earlier saves. */
function holding(pending: PendingSwitch | null, settingsId: string): PendingSwitch | null {
  if (!pending || settingsId === pending.id || !pending.ours.includes(settingsId)) return null;
  return pending;
}

/**
 * The theme the front-end shows, and a switch to another one (FR-THM-1). A switch shows at once
 * and is saved as `themes.lastUsed`. It holds while the settings still name a theme from this run
 * of switches (a save landing late must not undo a later switch), and gives way once they reach it
 * or a change made in Settings names another theme.
 */
export function useFrontendTheme(settings: Settings): {
  theme: ThemeModule;
  switchTo: (id: string) => void;
} {
  const settingsId = frontendThemeId(settings);
  const [pending, setPending] = useState<PendingSwitch | null>(null);
  const active = holding(pending, settingsId);
  const theme = resolveTheme(active ? active.id : settingsId);

  useEffect(() => {
    void getBridge().invoke('frontend.themeOpened', { themeId: theme.id });
  }, [theme.id]);

  const switchTo = useCallback(
    (id: string) => {
      setPending((current) => {
        const still = holding(current, settingsId);
        return { id, ours: [...(still ? still.ours : [settingsId]), id] };
      });
    },
    [settingsId],
  );
  return { theme, switchTo };
}
