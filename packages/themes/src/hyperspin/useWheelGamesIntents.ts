// HyperSpin's games wheel: up/down wrap around the list, left/right and LT/RT jump by letter with
// a flash of the letter (D5), random picks another game.
import type { ThemeGame } from '@nextlevel/shared';
import { useEffect, useState } from 'react';
import type { NavIntentKind } from '../engine/types.ts';
import { letterJump, letterKey, randomOtherIndex } from './letterJump.ts';

const FLASH_MS = 600;

export function useWheelGamesIntents({
  display,
  focus,
  setFocus,
}: {
  display: readonly ThemeGame[];
  focus: number;
  setFocus: (index: number) => void;
}) {
  const [flash, setFlash] = useState<{ letter: string; id: number } | null>(null);
  useEffect(() => {
    if (!flash) return;
    const timer = window.setTimeout(() => {
      setFlash(null);
    }, FLASH_MS);
    return () => {
      window.clearTimeout(timer);
    };
  }, [flash]);

  /** True when the intent was a wheel move (handled); false for everything else. */
  const handle = (intent: NavIntentKind): boolean => {
    const n = display.length;
    if (intent === 'focus-prev' || intent === 'focus-next') {
      if (n > 0) setFocus((focus + (intent === 'focus-next' ? 1 : -1) + n) % n);
      return true;
    }
    if (intent === 'jump-prev' || intent === 'jump-next') {
      if (n === 0) return true;
      const titles = display.map((g) => g.title);
      const to = letterJump(titles, focus, intent === 'jump-next' ? 1 : -1);
      setFocus(to);
      setFlash((f) => ({ letter: letterKey(titles[to] ?? ''), id: (f?.id ?? 0) + 1 }));
      return true;
    }
    if (intent === 'random') {
      if (n > 1) setFocus(randomOtherIndex(n, focus, Math.random));
      return true;
    }
    return false;
  };

  return { flash, handle };
}
