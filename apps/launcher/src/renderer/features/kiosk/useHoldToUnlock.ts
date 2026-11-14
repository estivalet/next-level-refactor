import { firstStandardPad, type PadSnapshot } from '@nextlevel/themes';
import { useEffect, useRef } from 'react';

const HOLD_MS = 3000;
const POLL_MS = 100;
const START = 9;

const browserPads = (): ReadonlyArray<PadSnapshot | null> =>
  typeof navigator.getGamepads === 'function' ? navigator.getGamepads() : [];

/**
 * Unlocking a locked kiosk (D54): Esc on the keyboard or Start on a gamepad held for 3 seconds
 * calls `onHold` once per hold.
 */
export function useHoldToUnlock({
  enabled,
  onHold,
  getPads = browserPads,
}: {
  enabled: boolean;
  onHold: () => void;
  getPads?: () => ReadonlyArray<PadSnapshot | null>;
}) {
  const onHoldRef = useRef(onHold);
  onHoldRef.current = onHold;

  useEffect(() => {
    if (!enabled) return;
    let keyTimer: ReturnType<typeof setTimeout> | null = null;
    let padFired = false;
    let padElapsed = 0;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.code !== 'Escape' || keyTimer) return;
      keyTimer = setTimeout(() => {
        onHoldRef.current();
      }, HOLD_MS);
    };
    const onKeyUp = (event: KeyboardEvent) => {
      if (event.code !== 'Escape' || !keyTimer) return;
      clearTimeout(keyTimer);
      keyTimer = null;
    };
    // Focus lost mid-hold (Alt+Tab): the keyup goes to another window, so the hold ends here.
    const onBlur = () => {
      if (keyTimer) clearTimeout(keyTimer);
      keyTimer = null;
    };
    // Counted in poll steps, so fake timers in tests and a throttled window behave the same.
    const poll = setInterval(() => {
      const pad = firstStandardPad(getPads());
      const held = Boolean(pad?.buttons.at(START)?.pressed);
      if (!held) {
        padFired = false;
        padElapsed = 0;
        return;
      }
      padElapsed += POLL_MS;
      if (!padFired && padElapsed >= HOLD_MS) {
        padFired = true;
        onHoldRef.current();
      }
    }, POLL_MS);

    window.addEventListener('keydown', onKeyDown, true);
    window.addEventListener('keyup', onKeyUp, true);
    window.addEventListener('blur', onBlur);
    return () => {
      window.removeEventListener('blur', onBlur);
      window.removeEventListener('keydown', onKeyDown, true);
      window.removeEventListener('keyup', onKeyUp, true);
      if (keyTimer) clearTimeout(keyTimer);
      clearInterval(poll);
    };
  }, [enabled, getPads]);
}
