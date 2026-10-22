// Ported from NextLevelOS src/themes/ps5/keymap.ts @ 3d530b7: bindings are input actions (keyboard
// or gamepad, US-C1). On the home, LB/RB switch the category; in a game list, the tab.
import type { KeyMap, NavIntentKind } from '../engine/types.ts';

export const PS5_KEYMAP: KeyMap = {
  left: 'focus-prev',
  right: 'focus-next',
  up: 'focus-up',
  down: 'focus-down',
  select: 'enter',
  back: 'back',
  home: 'home',
  tabPrev: 'tab-prev',
  tabNext: 'tab-next',
  pageUp: 'page-prev',
  pageDown: 'page-next',
  favorite: 'toggle-favorite',
  hide: 'toggle-hidden',
  search: 'toggle-search',
  help: 'show-help',
  menu: 'open-menu',
};

export const HOME_HELP_INTENTS: readonly NavIntentKind[] = [
  'focus-prev',
  'focus-next',
  'enter',
  'back',
  'home',
  'tab-prev',
  'tab-next',
  'open-menu',
  'show-help',
];

export const GAMES_HELP_INTENTS: readonly NavIntentKind[] = [
  'focus-prev',
  'focus-next',
  'focus-up',
  'focus-down',
  'page-prev',
  'page-next',
  'enter',
  'back',
  'home',
  'tab-prev',
  'tab-next',
  'toggle-favorite',
  'toggle-hidden',
  'toggle-search',
  'open-menu',
  'show-help',
];
