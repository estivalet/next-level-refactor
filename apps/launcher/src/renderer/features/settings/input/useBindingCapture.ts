import { useEffect, useRef, useState } from 'react';
import {
  captureStep,
  IDLE_CAPTURE,
  type CaptureEvent,
  type CaptureState,
  type CaptureTarget,
} from './captureBinding.ts';

/**
 * Runs a binding capture: listens for the next key while a keyboard capture is open, times out,
 * and hands each completed binding to `onResult`. `dispatch` also takes gamepad snapshots.
 */
export function useBindingCapture(onResult: (target: CaptureTarget, binding: string) => void) {
  const [capture, setCapture] = useState<CaptureState>(IDLE_CAPTURE);
  const stateRef = useRef(capture);
  const onResultRef = useRef(onResult);
  onResultRef.current = onResult;

  const dispatch = (event: CaptureEvent) => {
    const next = captureStep(stateRef.current, event);
    if (next === stateRef.current) return;
    const { result, ...rest } = next;
    stateRef.current = rest;
    setCapture(rest);
    if (result) onResultRef.current(result.target, result.binding);
  };
  const dispatchRef = useRef(dispatch);
  dispatchRef.current = dispatch;

  const active = capture.target !== null;
  useEffect(() => {
    if (!active) return;
    // Capture phase, so the key never reaches the shell or the field that has focus.
    const onKey = (event: KeyboardEvent) => {
      event.preventDefault();
      event.stopPropagation();
      dispatchRef.current({ type: 'key', code: event.code });
    };
    const timer = window.setInterval(() => {
      dispatchRef.current({ type: 'tick', now: Date.now() });
    }, 250);
    window.addEventListener('keydown', onKey, true);
    return () => {
      window.removeEventListener('keydown', onKey, true);
      window.clearInterval(timer);
    };
  }, [active]);

  return {
    capture,
    dispatch,
    start: (target: CaptureTarget) => {
      dispatch({ type: 'start', target, now: Date.now() });
    },
  };
}
