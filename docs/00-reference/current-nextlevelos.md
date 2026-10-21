# Current NextLevelOS — reference analysis

What the existing app (`../NextLevelOS`, snapshot of 2026-10-20, 271 commits) does, what is worth
keeping, and what the rebuild must fix. NextLevelOS keeps evolving: before porting anything,
re-read the current code there rather than trusting file sizes or names in this snapshot.

## 1. What it is today

A Windows desktop app (Electron 43 + React 19 + Vite + Tailwind 4) that looks like a small
operating system: desktop, draggable windows, taskbar, start menu. Its apps:

| App | What it does |
|---|---|
| **Game Library** | Browse the menu tree, game lists, global search, launch games, favorite/hide, edit details, scan for new ROMs, scrape art & metadata (ScreenScraper) |
| **Themes** | Fullscreen "front-end" mode with 6 themes: Big Box, Big Box List, Console Home, PS5 Style, HyperSpin Classic, Showcase |
| **Menu Editor** | Edit, create and activate `menu*.json` files |
| **Collection Manager** | Create and edit collections (curated game lists across systems) |
| **Settings** | Forms for `themes.json` and `screenscraper.json` |
| Widgets | Clock, Weather |

It boots into the last-used theme behind a splash screen. `M` minimizes the theme to the desktop.

Scale of the owner's library: ~440 systems, ~1,000 gamelist files, ~187,000 game entries,
~1,900 menu items, 3 storage drives.

## 2. How configuration works today

| File | Holds | Problems |
|---|---|---|
| `public/data/config.json` | storage drives + priorities, scan extensions, assets path, themes path, WSL/squashfs settings, **test hardware data**, active menu | Unrelated concerns in one flat object; dotted keys (`"wsl.distro.name"`); no schema |
| `public/data/launchers.json` | 438 systems → `command` + `rompath` (+ `romext`) | Nearly every command is `%NEXTLEVEL_RUNNER% -s "<System>" -r "%romname%"`: the real launch logic is elsewhere. One entry has a broken quote (`-r %romname%"`) — nothing validates it |
| `public/nextlevel-launcher.py` → `electron/bin/nextlevel-launcher.exe` | 3,500-line Python runner compiled with PyInstaller: emulator paths hard-coded per drive letter, per-system argument functions, WSL and squashfs mounting | The actual "emulator configuration" is code. Adding an emulator means editing Python and rebuilding an exe. Reads `data/config.json` relative to its working directory |
| `public/data/menu*.json` | Navigation tree. Items have `name`, `display`, `type` (`system`/`collection`), `shortname`, `filter`, `theme`, `visible` | Mixes navigation with system identity. The `name` string is the key into launchers, gamelists, art folders and ScreenScraper IDs. Typos survive (`"disply"` ×6) |
| `public/data/gamelists/<System>.json` | One file per system/collection: game metadata **and** launch overrides (`core`, `shader`, `config`, `emulator`, `squashfs_exe`) **and** user state (`played`, `lastPlayedOn`, `hidden`, `have`, `filter: ["favorite"]`) **and** scraper status (`status`, `error`, `num_candidates`) **and** MAME data | Five kinds of data in one record; files keyed by display name; favorites stored as a filter tag; some files are copies (`19XX Collection copy.json`) |
| `public/data/themes.json` | Theme list, default theme, per-theme art preferences | Reasonable; the Settings app now edits it |
| `public/data/screenscraper.json` | System name → ScreenScraper ID | Should be part of the system definition |
| `scrappers/screenscraper.credentials.json` | Scraper credentials | Fine (gitignored), but a second secret location |
| Theme packs `<themesPath>/<id>/theme.json` | Per-theme overrides + art | Good idea; keep |

Other runtimes: Python for scraping (`scrappers/`), maintenance scripts (`scripts/`), a GameFAQs
sandbox, a Gemini bot. The README is still the AI Studio template.

## 3. Keep (good ideas to carry over)

- **The desktop-shell experience** and the boot-into-theme flow.
- **The themes engine design** (`src/themes/README.md`): a headless engine (navigation reducer,
  level model, input, art resolution) + presentation-only themes. This is the most mature part of
  the codebase and the right shape for sharing with the web player.
- **Theme packs** with pack → shared assets fallback and art-coverage reporting.
- **Art folder conventions** (`logo/clear`, `background/artwork`, `video/`, per-ROM `media/<kind>/`).
- **Multi-drive storage with priority.**
- **The `nextlevel://` protocol** with HTTP Range support for streaming local media.
- **Safe writes**: `.bak` on save, conflict detection when a file changed on disk since load.
- **Collections, filters (official/homebrew/…), favorites, hidden, last played.**
- **Single-game scraping** with a preview-and-choose step.
- **Test discipline** in the newer code (engine, settings, menu editor all have tests).

## 4. Fix (why the rebuild exists)

1. **No single model of a "system".** Identity is a display string repeated across six files.
   → Systems get a stable `id` and one definition (see [data-model.md](../03-architecture/data-model.md)).
2. **Emulator setup lives in compiled Python.** → Emulators and launch profiles become data,
   edited in Settings, executed by one TypeScript launch service.
3. **Hand-edited, unvalidated JSON.** → All configuration is edited in-app and validated by
   one schema; files on disk are owned by the app.
4. **Mixed record types in gamelists.** → Separate metadata, launch overrides, user state and
   scrape status.
5. **187k games in JSON files fetched by the renderer.** → A local SQLite library with indexes.
6. **Three runtimes** (Node, Python, PyInstaller exe). → One: TypeScript.
7. **Ad-hoc IPC** (`window.electronAPI` grown method by method, `any` props). → A typed IPC contract.
8. **Very large components** (`GameLibrary.tsx` 2,445 lines, `main.cjs` 937 lines). → Feature
   modules with size limits (see [coding-standards.md](../03-architecture/coding-standards.md)).
9. **Keyboard-only themes.** → Gamepad support is a first-class input.
10. **No accounts, no distribution.** → Sign-in, subscriptions and an online catalog are new scope.

## 5. Reuse plan

Paths are relative to `../NextLevelOS`. Port each item when its milestone starts (rules in
[CLAUDE.md](../../CLAUDE.md#the-nextlevelos-reference)).

| Port (adapt + bring tests) | Milestone |
|---|---|
| `src/themes/engine/` pure modules: `navReducer`, `levelModel`, `gridMath`, `filteredFocus`, `gameFlags`, `gameCount`, `intentLabels`, `themeArt`, `themePack`, `themeCoverage`, `transitions` | M4 |
| `src/themes/components/` (Carousel, VerticalWheel, ShelfRow, GameGrid, TabBar, Background, KeyHelpOverlay, hooks) | M4 |
| The six themes (`big-box`, `big-box-list`, `console-home`, `ps5`, `hyperspin`, `showcase`) | M4 |
| `electron/mediaRange.cjs`, `electron/protocolScheme.cjs` → TypeScript | M2 |
| `src/apps/MenuEditor/treeOps.ts`, `rows.ts` | M5 |

| Use as reference only (behavior/spec, not code) | For |
|---|---|
| `public/nextlevel-launcher.py` per-system args and emulator quirks | emulator presets (M3) |
| `public/data/launchers.json`, `screenscraper.json` | system catalog seed script (M2) |
| `scrappers/scrape_cli.py` + its pytest tests | TypeScript scraper (M6) |
| `electron/settingsFiles.cjs` conflict-on-save + `.bak` behavior | SettingsService (M1) |
| `electron/romScan.cjs`, `menuFile.cjs` + tests | ScanService, menus (M2, M5) |
| `src/boot/` boot sequence and splash | boot routing (M1) |
| `docs/themes.md` | theme options and art-priority spec (M4) |

| Leave behind | Why |
|---|---|
| `src/apps/GameLibrary.tsx`, `src/apps/CollectionManager.tsx` | replaced by feature modules over the SQLite library |
| `electron/main.cjs`, `electron/preload.cjs` | replaced by services + typed IPC |
| Weather widget, `bots/`, `sandbox/`, Gemini usage | out of scope |

## 6. Migration path for existing users

The rebuild ships an **importer** (see FR-IMP in the PRD) that reads `config.json`,
`launchers.json`, `menu*.json`, `gamelists/*.json`, `themes.json` and `screenscraper.json` and
produces the new settings + library. The owner's own setup is the first migration test case.
