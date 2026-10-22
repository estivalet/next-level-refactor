# PS5 Style

A dark console-dashboard theme (FR-THM-1, screen spec S5): the root's categories are tabs across
the top, each category's items sit on an icon shelf, and game levels are a five-column grid.
Ported from NextLevelOS `src/themes/ps5` @ 3d530b7.

## Layout

- **Home:** the categories (the generated menu's manufacturers, then Collections) as tabs, with
  the breadcrumb right after the active one, and the clock. Below, a shelf of item icons whose
  focus stays on the third slot while the shelf slides; a hero with the focused item's logo (its
  name without art), its game or item count and **Explore**.
- **Game levels:** the system icon and title, the tabs **All · Favorites · Hidden** with counts,
  the count of the active tab, and a grid of game art with favorite and hidden badges, on a dark
  backdrop with a light wave.
- **Bottom:** a hint row with your keys and buttons. **Background (home):** the focused item's
  art, with video backgrounds on.

## Controls

The defaults below can be changed in Settings → Input; the help overlay always shows your own
bindings.

| Action | Keyboard | Gamepad | Home | Game grid |
|---|---|---|---|---|
| left / right | ← → | D-pad, left stick | previous / next icon | previous / next game |
| up / down | ↑ ↓ | D-pad, left stick | — | a row up / down |
| select | Enter | A | explore the item | play the game |
| back | Esc, Backspace | B | up one level; at category depth, the theme menu | close search, then up one level |
| home | Home | (unbound) | back to the first shelf | back to the first shelf |
| tabPrev / tabNext | Q / E | LB / RB | previous / next category (wraps) | previous / next tab |
| pageUp / pageDown | PageUp / PageDown | LT / RT | — | jump two rows back / forward |
| search | F | X | — | search titles |
| favorite / hide | X / H | Y / L3 | — | toggle favorite / hidden |
| help | F1, / | View | show every key and button | show every key and button |
| menu | Tab | Start | theme menu | theme menu |

Mouse: a click on a category tab selects it; a click focuses an icon or game, a double-click
explores or plays it, the wheel moves along the shelf or a row in the grid.

## Art

Theme defaults with video backgrounds. Icons use the menu background variants and `logo/clear`
logos; game cells follow the game tile order.
