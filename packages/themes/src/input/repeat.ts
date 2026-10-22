import { REPEATING_ACTIONS, type InputAction } from '@nextlevel/shared';

/** An action to fire; `repeat` when it comes from holding, not from a new press. */
export interface Fired {
  action: InputAction;
  repeat: boolean;
}

export interface Repeater {
  /** The actions to fire now, given what is held: new presses, then due repeats. */
  step(held: ReadonlySet<InputAction>, now: number): Fired[];
  /** Forgets everything held, e.g. when the window loses focus. */
  reset(): void;
}

/**
 * Hold-to-repeat (US-C1): a press fires at once; directions and page keys fire again after
 * `delayMs`, then `rateHz` times a second until released. Used for keys and buttons alike, so
 * both repeat at the user's chosen rate. A gap between steps longer than `STALL_MS` (a busy
 * renderer) is not hold time: pending repeats move by the gap, so a press whose release is still
 * queued fires once, and a late repeat never bursts to catch up.
 */
/** Steps further apart than this mean the main thread stalled (frames are ~16 ms). */
const STALL_MS = 100;

export function createRepeater({ delayMs, rateHz }: { delayMs: number; rateHz: number }): Repeater {
  const interval = 1000 / rateHz;
  const nextAt = new Map<InputAction, number>();
  let lastStep: number | undefined;
  return {
    step(held, now) {
      for (const action of nextAt.keys()) if (!held.has(action)) nextAt.delete(action);
      const gap = lastStep === undefined ? 0 : now - lastStep;
      lastStep = now;
      if (gap > STALL_MS) for (const [action, due] of nextAt) nextAt.set(action, due + gap);
      const fired: Fired[] = [];
      for (const action of held) {
        const due = nextAt.get(action);
        if (due === undefined) {
          fired.push({ action, repeat: false });
          nextAt.set(action, REPEATING_ACTIONS.includes(action) ? now + delayMs : Infinity);
        } else if (now >= due) {
          fired.push({ action, repeat: true });
          nextAt.set(action, Math.max(due + interval, now + interval));
        }
      }
      return fired;
    },
    reset() {
      nextAt.clear();
      lastStep = undefined;
    },
  };
}
