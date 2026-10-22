# Showcase

A bright, magazine-style theme (FR-THM-1, screen spec S5): big system tiles with a description,
and a strip of box covers under the focused game's details. Ported from NextLevelOS
`src/themes/showcase` @ 3d530b7.

## Layout

- **Home:** the root's categories (the generated menu's manufacturers, then Collections) as tabs,
  with the breadcrumb right after the active one, and the clock. Below, a row of large tiles
  (background art; the clear logo, then the name, without it) whose focus holds the second slot;
  the focused tile has a **Start** bar. The hero shows the item's name, its description from
  `system-info/<name>.json` (else its game or item count), its hardware art and logo.
- **Game levels:** the system logo (the filter's name under it on a filter level), when the game
  was last played, the title, year · developer, genre · players and the favorite / hidden
  badges; the focused game's video in a frame once the focus settles; the tabs with counts and
  the count of the active tab; a strip of covers.
- **Bottom:** a hint row with your keys and buttons. **Background:** the focused item's art, with
  video backgrounds on.

## Controls

The defaults below can be changed in Settings → Input; the help overlay always shows your own
bindings.

| Action | Keyboard | Gamepad | Home | Game strip |
|---|---|---|---|---|
| left / right | ← → | D-pad, left stick | previous / next tile (wraps) | previous / next cover (wraps) |
| select | Enter | A | start the item | play the game |
| back | Esc, Backspace | B | up one level; at category depth, the theme menu | close search, then up one level |
| home | Home | (unbound) | back to the first row | back to the first row |
| tabPrev / tabNext | Q / E | LB / RB | previous / next category (wraps) | previous / next tab |
| pageUp / pageDown | PageUp / PageDown | LT / RT | — | jump six covers back / forward |
| search | F | X | — | search titles |
| favorite / hide | X / H | Y / L3 | — | toggle favorite / hidden |
| help | F1, / | View | show every key and button | show every key and button |
| menu | Tab | Start | theme menu | theme menu |

Mouse: a click on a category tab or a game tab selects it; a click focuses a tile or cover, a
double-click (or a click on **Start**) opens or plays it, the wheel moves along the row.

## Options

- `filtersInMenu` (default `false`): a system's filters (Official, Homebrew…) are tabs in its game
  list, opening on Official when it has one; `true` makes them tiles on the home.

## Art

Theme defaults with video backgrounds. Tiles use the menu background variants and `logo/clear`
logos; the hero adds `art/hardware/<name>.png` and the description in
`system-info/<name>.json` (`{ "description": "…" }`). Covers follow the game tile order; the
video window plays the game's `video` media.
