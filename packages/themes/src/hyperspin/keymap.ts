// Ported from NextLevelOS src/themes/hyperspin/keymap.ts @ 3d530b7: bindings are input actions
// (keyboard or gamepad, US-C1). Up/down turn the wheel; left/right and LT/RT jump by letter (D5);
// LB/RB step through the filters.
import type { KeyMap, NavIntentKind } from '../engine/types.ts';

export const HYPERSPIN_KEYMAP: KeyMap = {
  up: 'focus-prev',
  down: 'focus-next',
  left: 'jump-prev',
  right: 'jump-next',
  pageUp: 'jump-prev',
  pageDown: 'jump-next',
  select: 'enter',
  back: 'back',
  home: 'home',
  tabPrev: 'tab-prev',
  tabNext: 'tab-next',
  favorite: 'toggle-favorite',
  hide: 'toggle-hidden',
  search: 'toggle-search',
  random: 'random',
  help: 'show-help',
  menu: 'open-menu',
};

export const MENU_HELP_INTENTS: readonly NavIntentKind[] = [
  'focus-prev',
  'focus-next',
  'enter',
  'back',
  'home',
  'open-menu',
  'show-help',
];

export const GAMES_HELP_INTENTS: readonly NavIntentKind[] = [
  'focus-prev',
  'focus-next',
  'jump-prev',
  'jump-next',
  'enter',
  'back',
  'home',
  'tab-prev',
  'tab-next',
  'toggle-favorite',
  'toggle-hidden',
  'toggle-search',
  'random',
  'open-menu',
  'show-help',
];
