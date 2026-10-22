import type { GamepadButton, InputAction, InputSettings } from '@nextlevel/shared';
import { useEffect, useRef, type RefObject } from 'react';
import { chordActions, firstStandardPad, readPad, type PadSnapshot } from './gamepad.ts';
import { isTextField, keyboardActions, passesTextInput } from './keyboard.ts';
import { createRepeater } from './repeat.ts';

/** The browser APIs the hook uses; replaceable in tests. */
export interface InputActionsDeps {
  now: () => number;
  requestFrame: (callback: () => void) => number;
  cancelFrame: (id: number) => void;
  getPads: () => ReadonlyArray<PadSnapshot | null>;
}

const browserDeps = (): InputActionsDeps => ({
  now: () => performance.now(),
  requestFrame: (callback) => requestAnimationFrame(callback),
  cancelFrame: (id) => {
    cancelAnimationFrame(id);
  },
  getPads: () => (typeof navigator.getGamepads === 'function' ? navigator.getGamepads() : []),
});

export interface UseInputActionsOptions {
  targetRef: RefObject<HTMLElement | null>;
  enabled: boolean;
  input: InputSettings;
  onAction: (action: InputAction) => void;
  deps?: InputActionsDeps;
}

/**
 * Keyboard and gamepad input as actions (FR-THM-3, US-C1). Keys are read from the target; the
 * first standard gamepad is polled every frame. Held directions repeat per the user's timing.
 * After the window loses focus, the page is hidden, a pad disconnects or input is switched off,
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

  useEffect(() => {
    const target = targetRef.current;
    if (!enabled || !target) return;
    const api = depsRef.current;
    const repeater = createRepeater({ delayMs: input.repeatDelayMs, rateHz: input.repeatRateHz });
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
      const held = new Set<InputAction>(chordActions(buttons, input));
      for (const actions of keysHeld.values()) actions.forEach((action) => held.add(action));
      for (const action of repeater.step(held, api.now())) onActionRef.current(action);
    };
    const reset = () => {
      keysHeld.clear();
      repeater.reset();
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
    target.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', reset);
    window.addEventListener('gamepaddisconnected', reset);
    document.addEventListener('visibilitychange', onHidden);
    return () => {
      api.cancelFrame(frame);
      target.removeEventListener('keydown', onKeyDown);
      target.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', reset);
      window.removeEventListener('gamepaddisconnected', reset);
      document.removeEventListener('visibilitychange', onHidden);
    };
  }, [targetRef, enabled, input]);
}
