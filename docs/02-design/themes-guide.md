# Themes guide

How to use, set up and add art to the fullscreen front-end themes. For the code side (the engine,
`ThemeHost`, adding a theme) see `packages/themes/src/*/README.md`; for the screens see
[screen-specifications.md](screen-specifications.md) S5 and S9.

## Quick reference

| Theme | id | Layout | Video backgrounds | Logo style | Filters |
|---|---|---|---|---|---|
| Big Box | `big-box` | logo carousel for menus, box-art carousel for games | on | `clear` | menu |
| Big Box List | `big-box-list` | Big Box menus; games as a list beside the game's art | on | `clear` | menu |
| Console Home | `console-home` | home tiles, tabbed game grid | off | `clear` | menu |
| PS5 Style | `ps5` | category tabs, icon shelf, five-column game grid | on | `clear` | menu |
| HyperSpin Classic | `hyperspin` | curved logo wheel with an animated stage | on | `steel` | menu (option) |
| Showcase | `showcase` | big system tiles with a description, cover strip | on | `clear` | game-list tabs (option) |

Every value in the table is a default you can change in **Settings → Themes → Options** (see
[Options](#options)).

- **Start:** the launcher opens the last theme you used (Big Box the first time) once the library
  has games; Settings → General → **Start in** can choose a theme or the desktop instead.
- **Switch theme:** `T`, or **Switch theme** in the theme menu. The new theme opens on the same
  level with the same game focused, and is the one the launcher starts in next time.
- **Desktop:** `M` (gamepad View+Start), or **Desktop** in the theme menu. The taskbar's
  **Front-end** button (or Start → Front-end) comes back to where you were.
- **Theme menu:** back at the top level, or `Tab` / Start: Desktop · Switch theme · Resume.
- **Help:** `F1` or `/` (gamepad View) shows every key and button of the theme, with your own
  bindings.

## Keys and buttons

The defaults below are remappable in **Settings → Input** (keyboard keys and gamepad buttons per
action). Every theme's help overlay shows your current bindings.

| Action | Keyboard | Gamepad |
|---|---|---|
| move | arrows | D-pad, left stick |
| select (open / play) | Enter | A |
| back | Esc, Backspace | B |
| home (top level) | Home | — |
| theme menu | Tab | Start |
| help | F1, / | View |
| search titles | F | X |
| favorite / hide | X / H | Y / L3 |
| previous / next tab | Q / E | LB / RB |
| page up / page down | PageUp / PageDown | LT / RT |
| random game | R | R3 |
| desktop | M | View+Start |
| switch theme | T | — |

What they do per theme:

| Action | Big Box | Big Box List | Console Home | PS5 Style | HyperSpin | Showcase |
|---|---|---|---|---|---|---|
| left / right | move | move (menus) | move | move | letter jump (games) | move |
| up / down | up opens | up opens (menus); move in the list | move in the grid | move in the grid | turn the wheel | — |
| tabs (LB/RB) | games tabs | games tabs | games tabs | category / games tabs | filters | category / games tabs |
| page (LT/RT) | 7 tiles | 10 rows | 3 rows | 2 rows | letter jump | 6 covers |
| random | — | — | — | — | random game | — |

Game lists have the tabs **All · Favorites · Hidden** (a system's filters come first where the
theme shows them as tabs). Mouse: a click focuses, a double-click opens or plays, the wheel moves.

## Where files live

Two folders are set in **Settings → Storage**:

- **Art folder**: art every theme can use.
- **Theme packs folder**: one folder per theme, `<theme packs folder>/<theme id>/` (for example
  `E:\NextLevel\themes\showcase\`), with art and option defaults for that theme only.

Art is always looked up **in the theme's pack first, then in the art folder**. A pack whose
`theme.json` has `"fallback": false` uses only its own files.

Menu art is named after the **menu item's name** (the system's name, the manufacturer, the
collection's name), not its display label. Game art comes from each system's ROM folder (see
[Game art](#game-art)).

### Folder layout

The same layout is used in the art folder and in every pack:

```
<pack or art folder>/
  theme.json                               pack only, optional (see Theme packs)
  logo/<style>/<name>.png                  clear logo (clear, steel, …)
  background/wallpaper/<name>.jpg|png      full-screen wallpaper (optional, wins over everything)
  background/artwork/<name>.jpg|png        composed artwork
  background/photo/<name>.jpg|png          photo of the hardware
  video/<name>.mp4                         menu video
  art/hardware/<name>.png                  hardware cutout (Showcase)
  system-info/<name>.json                  { "description": "…" } (Showcase)
  pointer/<name>.png, pointer/_default.png wheel pointer (HyperSpin)
  sound/move-menu.wav|ogg|mp3              blip when moving in menus
  sound/move-games.wav|ogg|mp3             blip when moving in game lists
```

Files in `_UNSORTED_DO_NOT_DELETE/` are ignored. After adding files, use **Rescan art** (see
[Checking a pack](#checking-a-pack)).

## What shows where

**Menu backgrounds** (categories and systems), first file found wins, each step pack first:

1. `background/wallpaper/<name>`
2. `video/<name>.mp4`, when the theme has video backgrounds on
3. the theme's **Backgrounds** order (default `background/artwork`, then `background/photo`)

**Game list backgrounds**: the focused game's art in the theme's **Game backgrounds** order
(default fanart → video → screenshot), then the system's wallpaper. Still backgrounds slowly zoom
in and out unless **Background zoom** is off (and never when Windows animations are off).

**Tiles, icons and frames** use the **Backgrounds** order and never the wallpaper:

| Theme | Uses |
|---|---|
| Big Box, Big Box List | menu plates: clear logo |
| Console Home | home tiles: backgrounds; tile logo |
| PS5 Style | shelf icons: backgrounds; hero logo |
| HyperSpin Classic | wheel: logos (`logo/steel`); stage frame: video, then backgrounds; pointer |
| Showcase | tiles: backgrounds (square art fits best); hero: `system-info` description, `art/hardware`, logo |

### Game art

Game media is indexed by the library scan from each system's ROM folder:
`<system folder>/media/<kind>/<rom name>.<ext>` with the kinds `box-front`, `box-back`,
`fanart`, `video`, `screenshot-game-play`, `screenshot-title`, `screenshot-select`,
`logo-clear` and `marquee`. Images are png, jpg, jpeg, webp or gif; videos mp4 or webm. Scan again
after adding media.

Game tiles try, by default, box front → title screenshot → gameplay screenshot → clear logo. A
theme's **Game art** option sets another order for all systems or for one system (carts for
Nintendo 64, say); a game without that art still falls through the list.

## Options

**Settings → Themes** has a card per theme: **Use this theme**, its pack status and **Options**.
A theme's options page:

- **Art**: logo style (the `logo/<style>` folders found are suggested), backgrounds order, video
  backgrounds, background zoom, game backgrounds order, game art per system.
- **Theme settings** (HyperSpin and Showcase): **Filters in the menu** — on, a system's filters
  (Official, Homebrew…) are menu entries; off, they are tabs in its game list. HyperSpin also has
  the **Game list wheel** and **Menu wheel** (the menu wheel's empty boxes use the game list
  wheel's values):

| Key | Default | Range | Effect |
|---|---|---|---|
| Width | 34% | `%`, `px` or `vw` | wheel column width |
| Item height | 96 | 24–400 | item height (px) |
| Spacing | 1 | 0.3–2 | distance between items, in item heights |
| Focus size | 1.12 | 0.5–3 | size of the selected item |
| Shrink per step | 0.03 | 0–0.5 | size lost per step away from the selection |
| Smallest size | 0.8 | 0.1–1 | smallest item size |
| Focus offset | 0 | −400–400 | px the selected item moves toward the stage |
| Curve | 9 | 1–100 | arc radius in item heights (larger = flatter) |
| Logo padding | 6, 56, 6, 28 | 0–400 each | top, right, bottom, left |
| Pointer height | 220 | 16–1200 | pointer image height (px) |

Each option shows what applies without your value — the theme's default, or **Pack default**
when the theme's pack sets one — and **Use default** clears your value. **Reset to defaults**
clears every option of the theme. A value out of range shows its range and Save waits until it is
fixed. Saved options reach an open theme at once.

**Theme sounds** (Settings → General) turns the navigation sounds of every theme on or off and
sets their volume (default on, 50 %). A theme without `sound/` files is silent either way.

Precedence for every option: the theme's built-in default → its pack's `theme.json` → your value
in Settings.

## Theme packs

A pack is a folder named after the theme id in the theme packs folder, using the
[folder layout](#folder-layout). An optional `theme.json` describes it and sets defaults:

```json
{
  "id": "showcase",
  "version": "0.1.0",
  "author": "you",
  "description": "My Showcase pack",
  "fallback": true,
  "art": { "logoVariant": "clear" },
  "settings": { "filtersInMenu": false }
}
```

- `id` must match the folder name, otherwise the file is ignored (a warning shows in the coverage
  panel). A file that is not valid JSON, or whose `fallback` is not true/false, is ignored too.
- `fallback: false` stops the theme from using the shared art folder.
- `art` and `settings` take the same keys as the options above (`logoVariant`,
  `backgroundVariants`, `useVideoBackground`, `backgroundZoom`, `gameBackgroundSources`,
  `gameArt`; `filtersInMenu`, `wheel`, `menuWheel`); a key of the wrong type is dropped with a
  warning.

## Checking a pack

Each theme card shows **No pack** (the pack folder has no art and no `theme.json`) or **Art NN%**: how much
of the menu's logo, background and (with video backgrounds on) video art the pack has itself.
Click it for the coverage panel:

- per slot, how many menu items the pack covers and which are missing (wallpaper is shown but
  optional, so it doesn't count toward the percentage);
- the pack's version, author and description, and its warnings;
- **Preview without fallback**: the front-end shows that theme with its pack art only, until the
  launcher closes (it is never saved);
- **Rescan art**: reads the folders again after you add or remove files; an open theme picks up
  the new files.
