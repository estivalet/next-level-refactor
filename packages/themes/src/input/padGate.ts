import {
  INPUT_ACTIONS,
  padButtons,
  type GamepadButton,
  type InputAction,
  type InputSettings,
} from '@nextlevel/shared';

export interface PadGate {
  /**
   * `held`: actions held this frame (fed to the repeater); `taps`: one-shot actions of chord
   * buttons released without completing a chord.
   */
  step(buttons: ReadonlySet<GamepadButton>): { held: InputAction[]; taps: InputAction[] };
  reset(): void;
}

/**
 * Gamepad chords without stray presses (FR-THM-3). Nobody presses two buttons in the same frame,
 * so a button that is part of a bound chord (View in View+Start) waits: it fires its own action
 * when released, unless a chord completed while it was down. A chord's buttons stay silent until
 * released. Buttons in no chord fire while held, as before.
 */
export function createPadGate(input: InputSettings): PadGate {
  const bindings = INPUT_ACTIONS.flatMap((action) =>
    input.gamepad[action].map((binding) => ({ action, buttons: padButtons(binding) })),
  );
  const chords = bindings.filter((binding) => binding.buttons.length > 1);
  const members = new Set(chords.flatMap((chord) => chord.buttons));
  const pending = new Set<GamepadButton>();
  const consumed = new Set<GamepadButton>();

  return {
    step(buttons) {
      const fired = new Set<InputAction>();
      for (const chord of chords) {
        if (!chord.buttons.every((button) => buttons.has(button))) continue;
        fired.add(chord.action);
        chord.buttons.forEach((button) => {
          consumed.add(button);
          pending.delete(button);
        });
      }
      const taps = new Set<InputAction>();
      for (const button of members) {
        if (buttons.has(button)) {
          if (!consumed.has(button)) pending.add(button);
          continue;
        }
        if (pending.delete(button)) {
          for (const single of bindings) {
            if (single.buttons.length === 1 && single.buttons[0] === button)
              taps.add(single.action);
          }
        }
        consumed.delete(button);
      }
      for (const single of bindings) {
        const [button] = single.buttons;
        if (single.buttons.length === 1 && button && !members.has(button) && buttons.has(button)) {
          fired.add(single.action);
        }
      }
      return {
        held: INPUT_ACTIONS.filter((action) => fired.has(action)),
        taps: INPUT_ACTIONS.filter((action) => taps.has(action)),
      };
    },
    reset() {
      pending.clear();
      consumed.clear();
    },
  };
}
