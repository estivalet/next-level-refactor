# Console Home

A light home-menu theme (FR-THM-1, screen spec S5): menu levels are a row of rounded art tiles,
game levels a tabbed grid. Ported from NextLevelOS `src/themes/console-home` @ 3d530b7.

## Layout

- **Top:** the clock and the breadcrumb (the menu title at the root).
- **Menu levels:** a row of tiles with the item's background art and logo (its name without
  art). The footer shows the focused item's name.
- **Game levels:** the level title, the tabs **All · Favorites · Hidden** with counts and the game
  count; a rail with **Back** and **Search**; a six-column grid of game art with favorite and
  hidden badges. The footer shows the focused game's title.
- **Footer:** **Back** and **Exit** (theme menu) buttons and a hint row with your keys and
  buttons. **Background:** the focused item's art, blurred under a frosted layer (no video).

## Controls

The defaults below can be changed in Settings → Input; the help overlay always shows your own
bindings.

| Action | Keyboard | Gamepad | Console Home |
|---|---|---|---|
| left / right | ← → | D-pad, left stick | previous / next tile or game |
| up / down | ↑ ↓ | D-pad, left stick | a row up / down in the grid |
| select | Enter | A | open the tile, play the game |
| back | Esc, Backspace | B | close search, then up one level; at the root, the theme menu |
| home | Home | (unbound) | back to the root |
| search | F | X | search titles; Enter or ↓ hands input back to the grid |
| favorite / hide | X / H | Y / L3 | toggle favorite / hidden |
| tabPrev / tabNext | Q / E | LB / RB | switch tab |
| pageUp / pageDown | PageUp / PageDown | LT / RT | jump three rows back / forward |
| help | F1, / | View | show every key and button |
| menu | Tab | Start | theme menu |

Mouse: a click focuses a tile or game, a double-click opens or plays it, the wheel moves a row in
the grid; Back, Search and Exit are buttons that leave the keyboard on the theme.

## Art

Theme defaults without video backgrounds. Tiles use the menu background variants and the
`logo/clear` logos; game cells follow the game tile order.
