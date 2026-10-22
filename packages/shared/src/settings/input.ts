import { z } from 'zod';

// Input mapping (data model §2 InputSettings, FR-THM-3, US-C1): physical keys and gamepad
// buttons → actions. Themes map actions to their own intents.

export const INPUT_ACTIONS = [
  'up',
  'down',
  'left',
  'right',
  'select',
  'back',
  'home',
  'menu',
  'help',
  'search',
  'favorite',
  'hide',
  'random',
  'tabPrev',
  'tabNext',
  'pageUp',
  'pageDown',
  'toDesktop',
  'switchTheme',
] as const;

export type InputAction = (typeof INPUT_ACTIONS)[number];

/**
 * Gamepad buttons; the first 17 are the W3C standard-mapping indices 0–16 in order, the `ls*`
 * entries are the left stick pushed past the deadzone.
 */
export const GAMEPAD_BUTTONS = [
  'a',
  'b',
  'x',
  'y',
  'lb',
  'rb',
  'lt',
  'rt',
  'view',
  'start',
  'ls',
  'rs',
  'dpadUp',
  'dpadDown',
  'dpadLeft',
  'dpadRight',
  'guide',
  'lsUp',
  'lsDown',
  'lsLeft',
  'lsRight',
] as const;

export type GamepadButton = (typeof GAMEPAD_BUTTONS)[number];

/** Actions that repeat while held (US-C1). */
export const REPEATING_ACTIONS: readonly InputAction[] = [
  'up',
  'down',
  'left',
  'right',
  'pageUp',
  'pageDown',
];

const KEYBOARD_DEFAULTS: Record<InputAction, string[]> = {
  up: ['ArrowUp'],
  down: ['ArrowDown'],
  left: ['ArrowLeft'],
  right: ['ArrowRight'],
  select: ['Enter'],
  back: ['Escape', 'Backspace'],
  home: ['Home'],
  menu: ['Tab'],
  help: ['F1', 'Slash'],
  search: ['KeyF'],
  favorite: ['KeyX'],
  hide: ['KeyH'],
  random: ['KeyR'],
  tabPrev: ['KeyQ'],
  tabNext: ['KeyE'],
  pageUp: ['PageUp'],
  pageDown: ['PageDown'],
  toDesktop: ['KeyM'],
  switchTheme: ['KeyT'],
};

const GAMEPAD_DEFAULTS: Record<InputAction, string[]> = {
  up: ['dpadUp', 'lsUp'],
  down: ['dpadDown', 'lsDown'],
  left: ['dpadLeft', 'lsLeft'],
  right: ['dpadRight', 'lsRight'],
  select: ['a'],
  back: ['b'],
  home: [],
  menu: ['start'],
  help: ['view'],
  search: ['x'],
  favorite: ['y'],
  hide: ['ls'],
  random: ['rs'],
  tabPrev: ['lb'],
  tabNext: ['rb'],
  pageUp: ['lt'],
  pageDown: ['rt'],
  toDesktop: ['view+start'],
  switchTheme: [],
};

/** The buttons of a gamepad binding (`'view+start'`) in GAMEPAD_BUTTONS order. */
export function padButtons(binding: string): GamepadButton[] {
  const order = GAMEPAD_BUTTONS as readonly string[];
  return (binding.split('+') as GamepadButton[]).sort(
    (a, b) => order.indexOf(a) - order.indexOf(b),
  );
}

/** A chord written in canonical button order, so `start+view` equals `view+start`. */
export function normalizePadBinding(binding: string): string {
  return padButtons(binding).join('+');
}

const KeyCodeSchema = z.string().regex(/^[A-Za-z0-9]{1,30}$/);

const PadBindingSchema = z.string().refine((binding) => {
  const buttons = binding.split('+');
  return (
    buttons.length <= 2 &&
    new Set(buttons).size === buttons.length &&
    buttons.every((b) => (GAMEPAD_BUTTONS as readonly string[]).includes(b))
  );
});

function bindingsSchema(item: z.ZodString, defaults: Record<InputAction, string[]>) {
  const shape = Object.fromEntries(
    INPUT_ACTIONS.map((action) => [action, z.array(item).max(4).default(defaults[action])]),
  ) as Record<InputAction, z.ZodDefault<z.ZodArray<typeof item>>>;
  return z.object(shape).prefault({});
}

/** Reports a binding already used by an earlier action (in INPUT_ACTIONS order). */
function checkDuplicates(
  bindings: Record<InputAction, string[]>,
  device: 'keyboard' | 'gamepad',
  ctx: z.core.$RefinementCtx,
) {
  const seen = new Set<string>();
  for (const action of INPUT_ACTIONS) {
    bindings[action].forEach((binding, index) => {
      const key = device === 'gamepad' ? normalizePadBinding(binding) : binding;
      if (seen.has(key)) {
        ctx.addIssue({
          code: 'custom',
          path: ['input', device, action, index],
          message: 'duplicateBinding',
        });
      }
      seen.add(key);
    });
  }
}

export const InputSettingsSchema = z.object({
  keyboard: bindingsSchema(KeyCodeSchema, KEYBOARD_DEFAULTS),
  gamepad: bindingsSchema(PadBindingSchema, GAMEPAD_DEFAULTS),
  repeatDelayMs: z.number().int().min(150).max(1000).default(400),
  repeatRateHz: z.number().int().min(2).max(30).default(10),
});

export type InputSettings = z.output<typeof InputSettingsSchema>;

/** Cross-field input check for SettingsSchema.superRefine (paths start at the settings root). */
export function checkInput(settings: { input: InputSettings }, ctx: z.core.$RefinementCtx) {
  checkDuplicates(settings.input.keyboard, 'keyboard', ctx);
  checkDuplicates(settings.input.gamepad, 'gamepad', ctx);
}

/** The default bindings for one action, used by "Reset to defaults". */
export function defaultBindings(device: 'keyboard' | 'gamepad', action: InputAction): string[] {
  return [...(device === 'keyboard' ? KEYBOARD_DEFAULTS : GAMEPAD_DEFAULTS)[action]];
}

const KEY_LABELS: Record<string, string> = {
  ArrowUp: '↑',
  ArrowDown: '↓',
  ArrowLeft: '←',
  ArrowRight: '→',
  Escape: 'Esc',
  Slash: '/',
  Backslash: '\\',
  Space: 'Space',
};

const ARROWS: Record<string, string> = { Up: '↑', Down: '↓', Left: '←', Right: '→' };

const BUTTON_LABELS: Record<string, string> = {
  lb: 'LB',
  rb: 'RB',
  lt: 'LT',
  rt: 'RT',
  view: 'View',
  start: 'Start',
  ls: 'L3',
  rs: 'R3',
  guide: 'Guide',
};

function buttonLabel(button: string): string {
  const direction = /^(dpad|ls)(Up|Down|Left|Right)$/.exec(button);
  if (direction) {
    return `${direction[1] === 'dpad' ? 'D-pad' : 'L-stick'} ${ARROWS[direction[2] ?? ''] ?? ''}`;
  }
  return BUTTON_LABELS[button] ?? button.toUpperCase();
}

/** A short label for a key code or gamepad binding, as shown on chips and key help. */
export function bindingLabel(device: 'keyboard' | 'gamepad', binding: string): string {
  if (device === 'gamepad') return binding.split('+').map(buttonLabel).join(' + ');
  const known = KEY_LABELS[binding];
  if (known) return known;
  const match = /^(?:Key|Digit)(.+)$/.exec(binding);
  return match?.[1] ?? binding;
}
