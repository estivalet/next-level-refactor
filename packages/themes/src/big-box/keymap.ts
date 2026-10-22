import type { KeyMap } from '../engine/types.ts';

/**
 * Big Box bindings (US-C1, screen spec S5): left/right move along the carousel, up or select
 * opens, LB/RB switch the game-list tabs, Start opens the theme menu, View shows every key.
 */
export const BIG_BOX_KEYMAP: KeyMap = {
  left: 'focus-prev',
  right: 'focus-next',
  up: 'enter',
  select: 'enter',
  back: 'back',
  home: 'home',
  search: 'toggle-search',
  favorite: 'toggle-favorite',
  hide: 'toggle-hidden',
  tabPrev: 'tab-prev',
  tabNext: 'tab-next',
  help: 'show-help',
  menu: 'open-menu',
};
