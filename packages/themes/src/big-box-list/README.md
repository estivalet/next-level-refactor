# Big Box List

Big Box's menus with a split game list (FR-THM-1, screen spec S5): menu levels are Big Box's
logo-plate carousel; game levels are a vertical text list on a slanted left panel with the
focused game's art on the right. Ported from NextLevelOS `src/themes/big-box-list` @ 3d530b7.

## Layout

- **Menu levels:** exactly Big Box's (card, level title, breadcrumb, logo-plate carousel).
- **Game levels, left panel:** NEXTLEVEL brand, the system title (a filter level shows its
  system), the game count with the filter name after it (e.g. `8 GAMES · OFFICIAL`), the tabs
  **All · Favorites · Hidden**, and the search box when open. Below, the list: the focused row is
  highlighted and the list wraps around.
- **Game levels, right:** the game's clear logo (its title when there is none), the system's
  short name as a badge with year · developer · genre, and the box art.
- **Top right:** search button and clock. **Bottom:** a hint row with your keys and buttons.

## Controls

The defaults below can be changed in Settings → Input; the help overlay always shows your own
bindings.

| Action | Keyboard | Gamepad | Menu levels | Game list |
|---|---|---|---|---|
| left / right | ← → | D-pad, left stick | previous / next item | — |
| up / down | ↑ ↓ | D-pad, left stick | up opens the item | previous / next game (wraps) |
| select | Enter | A | open the item | play the game |
| back | Esc, Backspace | B | up one level; at the root, the theme menu | close search, then up one level |
| home | Home | (unbound) | back to the root | back to the root |
| search | F | X | — | search titles |
| favorite / hide | X / H | Y / L3 | — | toggle favorite / hidden |
| tabPrev / tabNext | Q / E | LB / RB | — | switch tab |
| pageUp / pageDown | PageUp / PageDown | LT / RT | — | jump 10 games back / forward |
| help | F1, / | View | show every key and button | show every key and button |
| menu | Tab | Start | theme menu | theme menu |

Mouse: a click focuses a row, a double-click plays it, the wheel moves through the list.

## Art

Uses the theme defaults, like Big Box. The box art follows the game tile order (per-system game
art, then box front, title screen, gameplay screenshot, clear logo); the logo is the game's
`logo-clear` media.
