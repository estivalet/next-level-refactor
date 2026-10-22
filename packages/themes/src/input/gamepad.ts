import {
  GAMEPAD_BUTTONS,
  INPUT_ACTIONS,
  padButtons,
  type GamepadButton,
  type InputAction,
  type InputSettings,
} from '@nextlevel/shared';

/** The parts of a `Gamepad` the input layer reads. */
export interface PadSnapshot {
  mapping: string;
  axes: readonly number[];
  buttons: ReadonlyArray<{ pressed: boolean }>;
}

/** How far the left stick must move before it counts as a direction. */
export const STICK_DEADZONE = 0.5;

/** The first connected pad with the standard (Xbox/PlayStation) layout. */
export function firstStandardPad<T extends PadSnapshot>(pads: ReadonlyArray<T | null>): T | null {
  return pads.find((pad): pad is T => pad?.mapping === 'standard') ?? null;
}

/** The buttons held on a standard-mapping pad, the left stick as four directions. */
export function readPad(pad: PadSnapshot, deadzone = STICK_DEADZONE): Set<GamepadButton> {
  const held = new Set<GamepadButton>();
  if (pad.mapping !== 'standard') return held;
  pad.buttons.forEach((button, index) => {
    const name = GAMEPAD_BUTTONS[index];
    if (button.pressed && name && index < 17) held.add(name);
  });
  const [x = 0, y = 0] = pad.axes;
  if (x <= -deadzone) held.add('lsLeft');
  if (x >= deadzone) held.add('lsRight');
  if (y <= -deadzone) held.add('lsUp');
  if (y >= deadzone) held.add('lsDown');
  return held;
}

/**
 * The actions whose gamepad bindings are held, in INPUT_ACTIONS order. A held two-button chord
 * wins over the single-button bindings of its buttons, so View+Start is `toDesktop`, not also
 * `help` and `menu`.
 */
export function chordActions(
  held: ReadonlySet<GamepadButton>,
  input: InputSettings,
): InputAction[] {
  const isHeld = (binding: string) => padButtons(binding).every((button) => held.has(button));
  const inChord = new Set<GamepadButton>();
  for (const action of INPUT_ACTIONS) {
    for (const binding of input.gamepad[action]) {
      const buttons = padButtons(binding);
      if (buttons.length > 1 && isHeld(binding)) buttons.forEach((button) => inChord.add(button));
    }
  }
  return INPUT_ACTIONS.filter((action) =>
    input.gamepad[action].some((binding) => {
      const buttons = padButtons(binding);
      if (!isHeld(binding)) return false;
      return buttons.length > 1 || !buttons.some((button) => inChord.has(button));
    }),
  );
}
