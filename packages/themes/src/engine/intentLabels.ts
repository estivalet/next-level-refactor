// Ported from NextLevelOS src/themes/engine/intentLabels.ts @ 3d530b7: labels are i18n keys, and
// key help shows the user's own keys and buttons for each action a theme binds (FR-THM-3).
import { bindingLabel, type InputAction, type InputSettings } from '@nextlevel/shared';
import type { KeyMap, NavIntentKind } from './types.ts';

export const intentLabelKey = (intent: NavIntentKind): string => `themes.intents.${intent}`;

export interface KeyBinding {
  intent: NavIntentKind;
  labelKey: string;
  keys: string[];
  buttons: string[];
}

/** One row per intent, in keymap order (or `intents` order), with de-duplicated labels. */
export function describeKeymap(
  keymap: KeyMap,
  input: InputSettings,
  intents?: readonly NavIntentKind[],
): KeyBinding[] {
  const rows = new Map<NavIntentKind, KeyBinding>();
  for (const [action, intent] of Object.entries(keymap) as [InputAction, NavIntentKind][]) {
    const row = rows.get(intent) ?? {
      intent,
      labelKey: intentLabelKey(intent),
      keys: [],
      buttons: [],
    };
    for (const code of input.keyboard[action]) {
      const label = bindingLabel('keyboard', code);
      if (!row.keys.includes(label)) row.keys.push(label);
    }
    for (const binding of input.gamepad[action]) {
      const label = bindingLabel('gamepad', binding);
      if (!row.buttons.includes(label)) row.buttons.push(label);
    }
    rows.set(intent, row);
  }
  const order = intents ?? [...rows.keys()];
  return order.flatMap((intent) => {
    const row = rows.get(intent);
    return row ? [row] : [];
  });
}
