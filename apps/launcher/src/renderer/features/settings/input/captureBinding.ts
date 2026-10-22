import { normalizePadBinding, type GamepadButton, type InputAction } from '@nextlevel/shared';

export type CaptureTarget = { action: InputAction; device: 'keyboard' | 'gamepad' };

export interface CaptureState {
  target: CaptureTarget | null;
  startedAt: number;
  /** Buttons held together so far (at most 2), for a gamepad capture. */
  peak: GamepadButton[];
  /** Set once, when a capture completes; the caller applies it. */
  result?: { target: CaptureTarget; binding: string };
}

export type CaptureEvent =
  | { type: 'start'; target: CaptureTarget; now: number }
  | { type: 'key'; code: string }
  | { type: 'pad'; pressed: readonly GamepadButton[] }
  | { type: 'tick'; now: number }
  | { type: 'cancel' };

export const IDLE_CAPTURE: CaptureState = { target: null, startedAt: 0, peak: [] };

/** How long "Press a key…" waits before giving up. */
export const CAPTURE_TIMEOUT_MS = 5000;

const done = (target: CaptureTarget, binding: string): CaptureState => ({
  ...IDLE_CAPTURE,
  result: { target, binding },
});

/**
 * "Press a key or button" capture (FR-THM-3). A key completes on keydown; a gamepad binding is
 * the buttons held together (up to two), completed when all are released. Escape cancels.
 */
export function captureStep(state: CaptureState, event: CaptureEvent): CaptureState {
  if (event.type === 'start') return { target: event.target, startedAt: event.now, peak: [] };
  const { target } = state;
  if (!target) return state;
  switch (event.type) {
    case 'cancel':
      return IDLE_CAPTURE;
    case 'tick':
      return event.now - state.startedAt >= CAPTURE_TIMEOUT_MS ? IDLE_CAPTURE : state;
    case 'key':
      if (event.code === 'Escape') return IDLE_CAPTURE;
      return target.device === 'keyboard' ? done(target, event.code) : state;
    case 'pad': {
      if (target.device !== 'gamepad') return state;
      if (event.pressed.length === 0) {
        return state.peak.length > 0
          ? done(target, normalizePadBinding(state.peak.join('+')))
          : state;
      }
      const peak = [...state.peak];
      for (const button of event.pressed) {
        if (peak.length < 2 && !peak.includes(button)) peak.push(button);
      }
      return { ...state, peak };
    }
  }
}
