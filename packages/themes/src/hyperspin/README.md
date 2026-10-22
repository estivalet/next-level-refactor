# HyperSpin Classic

The classic cabinet front-end look (FR-THM-1, screen spec S5): a curved wheel of logos on the
right, an animated stage of artwork on the left. Ported from NextLevelOS `src/themes/hyperspin`
@ 3d530b7.

## Layout

- **Wheel (right):** menu items or games as clear logos (their name in bold caps without art) on
  an arc. The focused item sits at the vertical center, larger and leftmost; the wheel wraps. A
  pointer at the right edge marks it: `pointer/<name>.png`, then `pointer/_default.png`, else a
  built-in glowing knob. On a game list the pointer is the system's and stays while games scroll.
- **Filter pill (game lists):** `◂ name n/N ▸`; a click on an arrow steps through the tabs.
- **Stage (left):** once the focus settles, the item flies in with a random entrance: its logo,
  a framed video (or its screenshots / background art), the box art for games, and the game or
  item count. A letter jump flashes the new letter. The trail shows where you are.
- **Bottom:** a hint row with your keys and buttons. **Background:** the focused item's art, with
  video backgrounds on.

## Controls

The defaults below can be changed in Settings → Input; the help overlay always shows your own
bindings.

| Action | Keyboard | Gamepad | Menus | Game wheel |
|---|---|---|---|---|
| up / down | ↑ ↓ | D-pad, left stick | turn the wheel (wraps) | turn the wheel (wraps) |
| left / right | ← → | D-pad, left stick | — | jump to the previous / next letter |
| pageUp / pageDown | PageUp / PageDown | LT / RT | — | jump to the previous / next letter |
| select | Enter | A | open the item | play the game |
| back | Esc, Backspace | B | up one level; at the top, the theme menu | close search, then up one level |
| home | Home | (unbound) | back to the top | back to the top |
| tabPrev / tabNext | Q / E | LB / RB | — | previous / next filter (wraps) |
| random | R | R3 | — | a random other game |
| search | F | X | — | search titles |
| favorite / hide | X / H | Y / L3 | — | toggle favorite / hidden |
| help | F1, / | View | show every key and button | show every key and button |
| menu | Tab | Start | theme menu | theme menu |

Mouse: a click focuses a wheel item, a double-click opens or plays it, the mouse wheel turns the
wheel.

## Options

- `filtersInMenu` (default `true`): a system's filters (Official, Homebrew…) are menu entries;
  `false` makes them filter tabs in the system's game list.
- `wheel`: the game-list wheel shape — `width` (`34%`; `%`, `px` or `vw`), `itemHeight` (96,
  24–400), `spacing` (1, 0.3–2), `focusScale` (1.12, 0.5–3), `shrink` (0.03, 0–0.5),
  `minScale` (0.8, 0.1–1), `focusOffset` (0, −400–400), `curve` (9, 1–100), `padding`
  (`[6, 56, 6, 28]`, 4 × 0–400), `pointerHeight` (220, 16–1200).
- `menuWheel`: the menu wheel shape, any subset of the `wheel` keys on top of `wheel`.

An invalid value falls back to its default (the console names the key once).

## Art

Logos come from `logo/steel`, video backgrounds are on. Game wheel items use the game's
`logo-clear` media; the stage frame uses its `video` (with video backgrounds on), then its
screenshots; the box follows the game tile order.
