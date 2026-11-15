// FR-MUS-4: the PS5 home has two focus zones, the shelf (default) and the hero's buttons, so a
// controller reaches "…" (the museum page) with no extra button: Down from the shelf focuses
// Explore, Left/Right move between Explore and "…", Up goes back to the shelf.
import { useState } from 'react';
import type { NavIntentKind } from '../engine/types.ts';

export type HeroButton = 'explore' | 'info';

export function useHomeZones({
  resetKey,
  enabled,
  hasInfo,
  onExplore,
  onInfo,
}: {
  /** Any change (level, category, shelf focus) puts focus back on the shelf. */
  resetKey: string;
  /** False where there is no hero (a games level, an empty shelf). */
  enabled: boolean;
  /** Whether the hero shows "…" (the focused node has a system). */
  hasInfo: boolean;
  onExplore: () => void;
  onInfo: () => void;
}) {
  const [hero, setHero] = useState<{ key: string; button: HeroButton } | null>(null);
  const button = enabled && hero?.key === resetKey ? hero.button : null;
  const heroFocus: HeroButton | null = button === 'info' && !hasInfo ? 'explore' : button;

  const focus = (next: HeroButton | null) => {
    setHero(next ? { key: resetKey, button: next } : null);
  };

  /** Takes the intents the hero zone handles; returns false for everything else. */
  const handleIntent = (intent: NavIntentKind): boolean => {
    if (!enabled) return false;
    if (heroFocus === null) {
      if (intent !== 'focus-down') return false;
      focus('explore');
      return true;
    }
    switch (intent) {
      case 'focus-up':
        focus(null);
        return true;
      case 'focus-prev':
        focus('explore');
        return true;
      case 'focus-next':
        if (hasInfo) focus('info');
        return true;
      case 'focus-down':
        return true;
      case 'enter':
        if (heroFocus === 'info') onInfo();
        else onExplore();
        return true;
      default:
        return false;
    }
  };

  return { heroFocus, handleIntent };
}
