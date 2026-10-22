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
 * both repeat at the user's chosen rate.
 */
export function createRepeater({ delayMs, rateHz }: { delayMs: number; rateHz: number }): Repeater {
  const interval = 1000 / rateHz;
  const nextAt = new Map<InputAction, number>();
  return {
    step(held, now) {
      for (const action of nextAt.keys()) if (!held.has(action)) nextAt.delete(action);
      const fired: Fired[] = [];
      for (const action of held) {
        const due = nextAt.get(action);
        if (due === undefined) {
          fired.push({ action, repeat: false });
          nextAt.set(action, REPEATING_ACTIONS.includes(action) ? now + delayMs : Infinity);
        } else if (now >= due) {
          fired.push({ action, repeat: true });
          nextAt.set(action, due + interval);
        }
      }
      return fired;
    },
    reset() {
      nextAt.clear();
    },
  };
}
