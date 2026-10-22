// Ported from NextLevelOS src/themes/components/useThemeRootFocus.ts @ 3d530b7.
import { useEffect, type RefObject } from 'react';

/**
 * Keeps keyboard focus on a theme's input root: focus it when the engine status changes (each
 * status renders a different root), when the window regains focus, and when a level change
 * strands focus on <body> (a clicked button or the search input unmounted with the old level).
 * Focus outside the theme is left alone. While `enabled` is false (an overlay owns the input, or
 * the theme is behind the desktop) the window-focus grab is off.
 */
export function useThemeRootFocus(
  rootRef: RefObject<HTMLElement | null>,
  { status, stackDepth, enabled = true }: { status: string; stackDepth: number; enabled?: boolean },
): void {
  useEffect(() => {
    if (enabled) rootRef.current?.focus();
  }, [status, rootRef, enabled]);

  useEffect(() => {
    if (!enabled) return;
    const onWindowFocus = () => {
      if (rootRef.current && !rootRef.current.contains(document.activeElement)) {
        rootRef.current.focus();
      }
    };
    window.addEventListener('focus', onWindowFocus);
    return () => {
      window.removeEventListener('focus', onWindowFocus);
    };
  }, [rootRef, enabled]);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const active = document.activeElement;
    if (active === root) return;
    const lost = !active || active === document.body;
    if (lost || root.contains(active)) root.focus();
  }, [stackDepth, rootRef]);
}
