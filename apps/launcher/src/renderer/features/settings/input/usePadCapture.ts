import { firstStandardPad, readPad } from '@nextlevel/themes';
import { useEffect, useRef } from 'react';
import type { CaptureEvent } from './captureBinding.ts';

/** While a gamepad capture is open, feeds the first standard pad's held buttons each frame. */
export function usePadCapture(active: boolean, dispatch: (event: CaptureEvent) => void) {
  const dispatchRef = useRef(dispatch);
  dispatchRef.current = dispatch;

  useEffect(() => {
    if (!active) return;
    let frame = 0;
    const poll = () => {
      const pads = typeof navigator.getGamepads === 'function' ? navigator.getGamepads() : [];
      const pad = firstStandardPad(pads);
      dispatchRef.current({ type: 'pad', pressed: pad ? [...readPad(pad)] : [] });
      frame = requestAnimationFrame(poll);
    };
    frame = requestAnimationFrame(poll);
    return () => {
      cancelAnimationFrame(frame);
    };
  }, [active]);
}
