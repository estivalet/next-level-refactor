import { BIG_BOX_KEYMAP } from '../big-box/keymap.ts';
import type { KeyMap } from '../engine/types.ts';

/** Menu levels are Big Box's menu: left/right move along the plates, up or select opens. */
export const BBL_MENU_KEYMAP: KeyMap = BIG_BOX_KEYMAP;

/**
 * Games level (US-C1, screen spec S5): the list is vertical, so up/down move; LB/RB switch the
 * tabs, LT/RT jump a page (D5).
 */
export const BBL_GAMES_KEYMAP: KeyMap = {
  up: 'focus-prev',
  down: 'focus-next',
  select: 'enter',
  back: 'back',
  home: 'home',
  search: 'toggle-search',
  favorite: 'toggle-favorite',
  hide: 'toggle-hidden',
  tabPrev: 'tab-prev',
  tabNext: 'tab-next',
  pageUp: 'page-prev',
  pageDown: 'page-next',
  help: 'show-help',
  menu: 'open-menu',
};

/** Every binding of the theme (the module keymap, for the gamepad-reach check); help uses the
 * level's own map. */
export const BBL_KEYMAP: KeyMap = { ...BBL_MENU_KEYMAP, ...BBL_GAMES_KEYMAP };
