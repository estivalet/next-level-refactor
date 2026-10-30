import { useEffect, useRef, useState } from 'react';

/** Pixels from the bottom screen edge that bring the taskbar back. */
const REVEAL_AT = 3;
/** Band the pointer must leave before a revealed taskbar slides away again. */
const KEEP_ZONE = 130;
const HIDE_DELAY_MS = 600;

const isTyping = (target: EventTarget | null) =>
  target instanceof HTMLElement &&
  (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName));

/**
 * Whether a covered taskbar is brought back (ported from NextLevelOS Taskbar @ 3d530b7): by the
 * pointer at the bottom screen edge until it moves clear, or toggled with `\` for keyboard use.
 */
export function useDockReveal(enabled: boolean): boolean {
  const [revealed, setRevealed] = useState(false);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    if (!enabled) return;
    const onMove = (event: MouseEvent) => {
      const fromBottom = window.innerHeight - event.clientY;
      if (fromBottom <= REVEAL_AT) {
        clearTimeout(hideTimer.current);
        setRevealed(true);
      } else if (fromBottom > KEEP_ZONE) {
        clearTimeout(hideTimer.current);
        hideTimer.current = setTimeout(() => {
          setRevealed(false);
        }, HIDE_DELAY_MS);
      }
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== '\\' || event.ctrlKey || event.altKey || event.metaKey) return;
      if (isTyping(event.target)) return;
      clearTimeout(hideTimer.current);
      setRevealed((value) => !value);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('keydown', onKey);
      clearTimeout(hideTimer.current);
    };
  }, [enabled]);

  return revealed;
}
