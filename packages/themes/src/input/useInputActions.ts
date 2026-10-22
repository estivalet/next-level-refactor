import type { GamepadButton, InputAction, InputSettings } from '@nextlevel/shared';
import { useLayoutEffect, useRef, type RefObject } from 'react';
import { firstStandardPad, readPad, type PadSnapshot } from './gamepad.ts';
import { isTextField, keyboardActions, passesTextInput } from './keyboard.ts';
import { createPadGate } from './padGate.ts';
import { createRepeater } from './repeat.ts';

/** The browser APIs the hook uses; replaceable in tests. */
export interface InputActionsDeps {
  now: () => number;
  requestFrame: (callback: () => void) => number;
  cancelFrame: (id: number) => void;
  getPads: () => ReadonlyArray<PadSnapshot | null>;
}

// Without requestAnimationFrame (tests, some hosts) the poll falls back to a 16 ms timer.
const hasFrames = () => typeof requestAnimationFrame === 'function';

const browserDeps = (): InputActionsDeps => ({
  now: () => performance.now(),
  requestFrame: (callback) =>
    hasFrames() ? requestAnimationFrame(callback) : window.setTimeout(callback, 16),
  cancelFrame: (id) => {
    if (hasFrames()) cancelAnimationFrame(id);
    else window.clearTimeout(id);
  },
  getPads: () => (typeof navigator.getGamepads === 'function' ? navigator.getGamepads() : []),
});

export interface UseInputActionsOptions {
  targetRef: RefObject<HTMLElement | null>;
  enabled: boolean;
  input: InputSettings;
  /** `repeat`: fired by holding the input down, not by a new press. */
  onAction: (action: InputAction, info: { repeat: boolean }) => void;
  deps?: InputActionsDeps;
}

/**
 * Keyboard and gamepad input as actions (FR-THM-3, US-C1). Keys are read from the target; the
 * first standard gamepad is polled every frame. Held directions repeat per the user's timing.
 * Chord buttons fire on release unless a chord completed (see createPadGate). After the window or
 * the theme loses focus, the page is hidden, a pad (dis)connects or input is switched off,
 * everything held is forgotten, and pad buttons still down are ignored until released, so a
 * press meant for an overlay never reaches the theme behind it.
 */
export function useInputActions({
  targetRef,
  enabled,
  input,
  onAction,
  deps,
}: UseInputActionsOptions) {
  const onActionRef = useRef(onAction);
  onActionRef.current = onAction;
  const depsRef = useRef(deps ?? browserDeps());

  // A layout effect: listening starts before paint, so a key pressed as soon as an overlay shows
  // is not lost.
  useLayoutEffect(() => {
    const target = targetRef.current;
    if (!enabled || !target) return;
    const api = depsRef.current;
    const repeater = createRepeater({ delayMs: input.repeatDelayMs, rateHz: input.repeatRateHz });
    const gate = createPadGate(input);
    const keysHeld = new Map<string, InputAction[]>();
    let latched = new Set<GamepadButton>();

    const padHeld = (): Set<GamepadButton> => {
      const pad = firstStandardPad(api.getPads());
      return pad ? readPad(pad) : new Set();
    };
    const tick = () => {
      const buttons = padHeld();
      latched = new Set([...latched].filter((button) => buttons.has(button)));
      for (const button of latched) buttons.delete(button);
      const pad = gate.step(buttons);
      const held = new Set<InputAction>(pad.held);
      for (const actions of keysHeld.values()) actions.forEach((action) => held.add(action));
      for (const action of pad.taps) onActionRef.current(action, { repeat: false });
      for (const fired of repeater.step(held, api.now())) {
        onActionRef.current(fired.action, { repeat: fired.repeat });
      }
    };
    const reset = () => {
      keysHeld.clear();
      repeater.reset();
      gate.reset();
      latched = padHeld();
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.repeat) return;
      if (isTextField(event.target) && !passesTextInput(event.code)) return;
      const actions = keyboardActions(event.code, input);
      if (actions.length === 0) return;
      event.preventDefault();
      keysHeld.set(event.code, actions);
      tick();
    };
    const onKeyUp = (event: KeyboardEvent) => {
      if (keysHeld.delete(event.code)) tick();
    };
    // Focus moving out of the theme (a click on the shell, a dialog) means its keyup may never
    // reach the target: forget held keys then. Moving between the theme's own elements is fine.
    const onFocusOut = (event: FocusEvent) => {
      const next = event.relatedTarget;
      if (!(next instanceof Node) || !target.contains(next)) reset();
    };
    const onHidden = () => {
      if (document.visibilityState === 'hidden') reset();
    };

    let frame = 0;
    const loop = () => {
      tick();
      frame = api.requestFrame(loop);
    };
    reset();
    frame = api.requestFrame(loop);
    target.addEventListener('keydown', onKeyDown);
    target.addEventListener('focusout', onFocusOut);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', reset);
    window.addEventListener('gamepadconnected', reset);
    window.addEventListener('gamepaddisconnected', reset);
    document.addEventListener('visibilitychange', onHidden);
    return () => {
      api.cancelFrame(frame);
      target.removeEventListener('keydown', onKeyDown);
      target.removeEventListener('focusout', onFocusOut);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', reset);
      window.removeEventListener('gamepadconnected', reset);
      window.removeEventListener('gamepaddisconnected', reset);
      document.removeEventListener('visibilitychange', onHidden);
    };
  }, [targetRef, enabled, input]);
}
