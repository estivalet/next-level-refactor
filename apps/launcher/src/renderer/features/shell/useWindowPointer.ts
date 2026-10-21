import { useEffect, useRef, type PointerEvent } from 'react';
import { dragTo, resizeTo, type Point } from './pointerMath.ts';
import { useShell } from './ShellContext.tsx';
import type { ShellWindow } from './windowManager.ts';

interface Gesture {
  pointerStart: Point;
  rect: ShellWindow['rect'];
  latest: Point;
  frame: number | null;
}

/**
 * Pointer handlers that move (`drag`) or resize a window. The pointer is captured so the gesture
 * keeps working outside the element; updates are batched to one dispatch per animation frame.
 * A cancelled pointer or lost capture ends the gesture, so a later hover never drags.
 */
export function useWindowPointer(kind: 'drag' | 'resize', win: ShellWindow) {
  const { dispatch } = useShell();
  const gesture = useRef<Gesture | null>(null);

  function apply(g: Gesture) {
    g.frame = null;
    if (kind === 'drag') {
      const { x, y } = dragTo(g.rect, g.pointerStart, g.latest);
      dispatch({ type: 'move', id: win.id, x, y });
    } else {
      const { width, height } = resizeTo(g.rect, g.pointerStart, g.latest);
      dispatch({ type: 'resize', id: win.id, width, height });
    }
  }

  function end() {
    const g = gesture.current;
    if (g?.frame != null) cancelAnimationFrame(g.frame);
    gesture.current = null;
  }

  useEffect(() => end, []);

  return {
    onPointerDown(event: PointerEvent<HTMLElement>) {
      if (event.button !== 0 || win.maximized) return;
      if ((event.target as HTMLElement).closest('button')) return;
      event.currentTarget.setPointerCapture(event.pointerId);
      const point = { x: event.clientX, y: event.clientY };
      gesture.current = { pointerStart: point, rect: win.rect, latest: point, frame: null };
    },
    onPointerMove(event: PointerEvent<HTMLElement>) {
      const g = gesture.current;
      if (!g) return;
      g.latest = { x: event.clientX, y: event.clientY };
      g.frame ??= requestAnimationFrame(() => {
        apply(g);
      });
    },
    onPointerUp(event: PointerEvent<HTMLElement>) {
      const g = gesture.current;
      if (!g) return;
      g.latest = { x: event.clientX, y: event.clientY };
      end();
      apply(g);
    },
    onPointerCancel: end,
    onLostPointerCapture: end,
  };
}
