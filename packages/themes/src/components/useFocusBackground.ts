// Ported from NextLevelOS src/themes/components/useFocusBackground.ts @ 3d530b7 (games are found by
// id; the system wallpaper is looked up by the level's node name).
import type { ThemeGame } from '@nextlevel/shared';
import { useDeferredValue, useMemo } from 'react';
import type { BackgroundLayer } from '../engine/types.ts';
import { useThemeArt } from '../engine/useThemeArt.ts';
import { useSettledFocus } from './useSettledFocus.ts';

/**
 * Background layers for the focused item, swapped only once the selection has settled (a run of
 * quick moves remounts `<Background>` once). Menu levels: wallpaper → video → the theme's
 * background variants, by node name; games levels: the theme's game background sources, then
 * the system wallpaper. `focusKey` is the node name on a menu level and the game id on a games
 * level.
 */
export function useFocusBackground({
  levelKind,
  focusKey,
  games,
  systemName,
  settleMs = 160,
}: {
  levelKind: 'menu' | 'games' | undefined;
  focusKey: string;
  games: readonly ThemeGame[];
  systemName: string;
  settleMs?: number;
}): BackgroundLayer[] {
  const art = useThemeArt();
  const settledKey = useSettledFocus(focusKey, settleMs);
  const deferredKey = useDeferredValue(settledKey);

  return useMemo<BackgroundLayer[]>(() => {
    if (!deferredKey) return [];
    if (levelKind === 'menu') return art.menuBackgroundLayers(deferredKey);
    const game = games.find((g) => String(g.id) === deferredKey);
    return game ? art.gameBackgroundLayers(game, systemName) : [];
  }, [deferredKey, levelKind, games, systemName, art]);
}
