# Big Box

A fullscreen carousel (FR-THM-1, screen spec S5): menu levels show logo plates, game levels show
box art. Ported from NextLevelOS `src/themes/big-box` @ 3d530b7.

## Layout

- **Top left:** a card for the focused item. Menu levels: its logo (or name), its type and its
  item or game count, and **Open**. Game levels: title, year · developer · genre, the
  description (loaded once the focus settles) and **Play**.
- **Top right:** the level title with its count; on game levels, the tabs **All · Favorites ·
  Hidden** with counts.
- **Above the carousel:** **Back** and the breadcrumb.
- **Bottom:** the carousel, and a hint row with your keys and buttons.
- **Background:** the focused item's art (wallpaper, video, background variants; for games the
  game background sources, then the system wallpaper), tinted with an accent per manufacturer.
- A system's filters (Official, Homebrew, …) are entries of the systems menu.

## Controls

The defaults below can be changed in Settings → Input; the help overlay always shows your own
bindings.

| Action | Keyboard | Gamepad | Big Box |
|---|---|---|---|
| left / right | ← → | D-pad, left stick | previous / next item |
| up, select | ↑, Enter | D-pad up, A | open the item, play the game |
| back | Esc, Backspace | B | up one level; at the root, the theme menu |
| home | Home | (unbound) | back to the root |
| search | F | X | search titles in a game list |
| favorite | X | Y | toggle favorite |
| hide | H | L3 | toggle hidden |
| tabPrev / tabNext | Q / E | LB / RB | switch game-list tab |
| help | F1, / | View | show every key and button |
| menu | Tab | Start | theme menu (Desktop · Resume) |

Mouse: a click focuses an item, a double-click opens or plays it, the wheel moves along the
carousel; Open, Play, Back and the tabs are buttons.

## Art

Uses the theme defaults (`logo/clear`, `background/artwork` then `background/photo`, video
backgrounds on). Game tiles use the per-system game art order, then box front, title screen,
gameplay screenshot, clear logo. Without art every plate shows its name.
