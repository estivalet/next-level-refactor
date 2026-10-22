# Changelog

All notable changes are recorded here. Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/);
versions follow [SemVer](https://semver.org/) (`0.<milestone>.<patch>` until 1.0).

## [Unreleased]

## [0.4.0] - 2026-10-22

M4 — Themes: the fullscreen front-end with the six themes on one engine, gamepad and keyboard
input (remappable), theme options and sounds in Settings, theme packs with art coverage, and
starting straight into a theme. User guide: [docs/02-design/themes-guide.md](docs/02-design/themes-guide.md).

### Added
- M4a themes engine (FR-THM-2, FR-THM-3, FR-THM-6, ADR-010): `packages/themes` holds the engine
  ported from NextLevelOS (navigation, levels, art paths, pack merge, coverage) behind a
  `ThemeHost` interface; the launcher implements it over IPC. Themes arrive in M4b.
- A game media index: every scan records `media/<kind>/<rom>.<ext>` files per game, and
  `nextlevel://` serves indexed media and theme art (pack before the shared art folder) with
  ranged requests, never outside the configured folders.
- The front-end reads a generated menu (manufacturer → system → filters, then collections) and
  whole game levels in one call each.
- Settings → Storage gets the art folder and the theme packs folder; Settings → Input maps every
  action to keys and gamepad buttons (press to bind, View+Start style chords, duplicate check,
  reset, repeat delay and rate). Held directions repeat after 400 ms at 10 per second by default.
- M4b front-end mode with Big Box (FR-THM-1, FR-THM-3, FR-THM-5, US-C1, US-C2): the theme runs
  fullscreen above the desktop. M or View+Start goes to the desktop and the taskbar's Front-end
  button (or Start → Front-end) comes back to the same place; back at the top, or Start, opens the
  theme menu (Desktop · Resume). Big Box shows logo plates for menus and box art for games, with
  All · Favorites · Hidden tabs, search, favorite and hide, and a key help that shows your own
  keys and buttons. Mouse: click to focus, double-click to open or play, wheel to move.
- Play from the front-end: input pauses while the game runs and comes back on the same game; a
  failure shows the reason and Fix in Settings, also from a gamepad.
- The launcher starts in the last theme (Big Box the first time), a chosen theme or the desktop
  (Settings → General → Start in); it starts on the desktop while the library has no games.
  Settings → Themes lists the themes and the one in use.
- M4c themes (FR-THM-1): Big Box List (Big Box menus with a split game list), Console Home (light
  home tiles and a tabbed game grid) and PS5 Style (category tabs, icon shelf, dark game grid),
  each with the All · Favorites · Hidden tabs, search, favorite and hide on keys and buttons.
- The theme switcher: T (or Switch theme in the theme menu) picks another theme and opens it on
  the same level with the same game focused; it is also the theme the launcher starts in next.
- LT/RT (PageUp/PageDown) jump a page through game lists.
- HyperSpin Classic (FR-THM-1): a curved logo wheel with a pointer and an animated stage of logo,
  video and box art; left/right and LT/RT jump by letter, R3 (R) picks a random game, LB/RB step
  through the filters. Its wheel shape and filter layout are theme options.
- Showcase (FR-THM-1): big system tiles with a description from `system-info/<name>.json`, and a
  cover strip under the focused game's details, last-played time and video. A system's filters
  are game-list tabs (opening on Official) unless the theme option puts them in the menu.
- Theme options in Settings (FR-THM-4): Settings → Themes → Options opens a page per theme for
  its logo style, background order, video backgrounds, background zoom, game background order,
  game art per system, filters in the menu and HyperSpin's wheels, each showing its default (or
  the pack's) with Use default and Reset to defaults; an open theme follows a save at once.
- Settings → General → Theme sounds: on/off and volume for every theme's navigation sounds.
- Theme pack coverage (FR-THM-2): each theme card in Settings → Themes shows `No pack` or `Art NN%`;
  its panel lists the art each pack covers and misses, the pack's warnings, Preview without
  fallback for this session, and Rescan art.

### Changed
- The Library no longer shows a failure for a game started from the front-end; the front-end
  shows it.

## [0.3.0] - 2026-10-21

M3 — Launching: emulators, profiles and presets, Test launch, Play from the Library, per-game
launch options and the launch log.

### Added
- M3a launching engine (FR-EMU-2..5, FR-EMU-7, FR-EMU-8, ADR-004): emulators and launch profiles
  live in settings. Argument templates use a fixed token set (`{rom}`, `{romDir}`, `{core}`,
  `{extraArgs}`, …), are checked on save, and render to an argv array that's spawned without a
  shell. The profile comes from the game's override, then the system default, then the first
  profile for the system. The ROM is looked up on the game's own storage location first.
- Emulator presets for RetroArch (one profile per core), MAME (one per system) and Dolphin, PCSX2,
  DuckStation, PPSSPP, Cemu, Ryujinx, Azahar, xemu, Xenia Canary, DOSBox, ScummVM and Flycast,
  ported from the NextLevelOS runner. A snapshot test pins each preset's argv.
- Settings → Emulators: add an emulator from a preset (you only choose the program) or as Custom,
  find emulators in a folder, add more preset profiles, and edit profiles. The editor has token
  autocomplete, names unknown tokens, shows a live command preview, and has a Test launch with
  the exit code and stderr; a failure names the path and the reason (for example a missing working
  folder). Settings → Systems sets a system's emulator profile.
- `.zip`/`.7z` games are extracted to a temp folder for profiles that can't read archives, using
  the bundled 7-Zip (ADR-014). The folder is removed after the emulator exits; start-up removes
  folders left by an earlier run.
- Every launch, including Test launches, is recorded in a launch log (newest 1,000) with its
  command, exit code and the last 4 KiB of stderr.
- M3b Play from the Library (FR-EMU-6, US-C2): the Play button, Play in the game menu, Enter or
  double-click. The launcher minimizes while the game runs, says "Playing <title>…", and comes
  back to the same game, with its play count. If the game doesn't start (or quits with an error
  within 10 seconds), a dialog says why, shows the emulator's output and has **Fix in Settings**,
  which opens the setting to change.
- Launch options per game (FR-EMU-4): another profile, a core and extra arguments, or back to the
  system default.
- Settings → Data & logs shows the launch log (FR-EMU-10); a row opens to the command line and
  the emulator's output.

### Changed
- The standalone emulator presets pass a game's extra arguments (`{extraArgs}`) first. Profiles
  you already added keep their arguments; Launch options says when a profile has no
  `{extraArgs}`.

## [0.2.0] - 2026-10-21

M2 — Library core: system catalog, storage, background scan and the Game Library app.

### Added
- M2a system catalog (FR-EMU-1): all 438 NextLevelOS systems with permanent ids, default folder
  names, extensions (ES-DE v3.5.0 where names match — MIT, see `packages/system-catalog/NOTICE.md`
  — else NextLevelOS data) and ScreenScraper ids; regenerated by a seed script, never hand-edited.
- Settings → Storage (FR-LIB-1): add, rename, reorder and remove storage locations; duplicate or
  relative paths are rejected.
- Settings → Systems (FR-EMU-1, FR-LIB-2): searchable, virtualized list of every system; enable
  systems and override a system's ROM folder name and extensions.
- M2b library (FR-LIB-1, FR-LIB-4, NFR-REL-1): games live in `library.db` (SQLite, WAL), created
  and migrated at start-up with a backup of the old file first; a library from a newer version is
  refused instead of overwritten. If it can't be opened the app still starts and says so.
- Scan for games in Settings → Storage (FR-LIB-3, FR-LIB-5): runs in a background worker with
  progress and Cancel; finds new, moved (renamed, same size) and missing games across storage
  locations, first location wins; `.cue`/`.m3u` sets and loose `Disc 1/2` files count as one game.
  Missing files are flagged, never deleted, and come back when the drive is reconnected. Systems
  with games that you never set are turned on; systems you switched off are left alone.
- Settings drafts keep unsaved edits when the settings change underneath them (a scan, a
  conflict reload) instead of discarding them.
- M2c Game Library app (FR-LIB-6..8, FR-LIB-10, NFR-PERF-2/3), in the NextLevelOS look:
  - Systems grouped by manufacturer with game counts, and collections, in a virtualized tree; a
    virtualized game list that loads only the pages on screen; a details panel.
  - Missing games are greyed and name the path where the file was expected.
  - Filter All / Favorites / Hidden / Missing and sort by title, year, rating or recently added.
    Hidden games show only under Hidden and are left out of global search.
  - Global search across all systems (SQLite FTS5): about 50 ms for 200k games.
  - Favorite, hide (also for several selected games) and rate 1–5 stars.
  - Edit details (title, year, developer, publisher, genre, players, description, region,
    filters). Edited fields are locked, so a later scrape keeps them.
  - Collections: create, rename, delete, add games from any system, remove, order by hand or by
    title or year.
  - Scan ▾ scans all systems or the one shown, with progress and Cancel.
  - Relink a missing game to the file it was renamed or moved to; it keeps its details,
    favorite and collections.
- A scan now also recognises a renamed file (same extension, size and modified time), so
  `Game.zip` → `Game (USA).zip` keeps the game's details.

### Fixed
- Settings → Storage: a scan that fails to start now says why, and scan results show each
  system's total missing games, not only the ones that went missing in that scan.
- An unreadable system folder (for example access denied) is now logged instead of looking
  empty.

## [0.1.0] - 2026-10-21

M1 — Shell: desktop shell and settings.

### Added
- M1b settings (FR-SET-1..4, FR-SET-7, US-D3): `settings.json` validated by one shared Zod schema,
  atomic saves (NFR-REL-1) with the newest 10 backups, stale saves rejected (`CONFLICT`),
  restore with a backup of the current state first, export/import with validation, and a recovery
  screen (restore latest backup / reset to defaults) when the file can't be used.
- Settings app: schema-driven General section (language, start with Windows) with field-level
  validation and a Save/Discard bar; Backups (what changed, restore, export, import); Data & logs
  (paths and open folder). Boot splash while settings load.
- Portuguese (pt-BR) translation, switching live (NFR-I18N-1); a test keeps both locales in sync.
- File logging with electron-log in `<data>/logs`.
- M1a desktop shell (FR-SHELL-1..5, proposed): desktop icons, movable/resizable windows kept
  inside the desktop, minimize/maximize/close, a dock-style taskbar with a clock, and a Start menu
  with app search and Quit (`app.quit` IPC channel). Look follows the current NextLevelOS shell.
- Settings app skeleton with an About section (version via TanStack Query).
- Hardening (NFR-SEC-1): no remote navigation in app windows (https links open in the system
  browser), CSP per the security doc, extra IPC arguments and unknown channels rejected, renderer
  and themes/ui import guards built from Node's full built-in list.

## [0.0.0] - 2026-10-21

M0 — Foundations.

### Added
- M0 foundations (NFR-MAINT-1): npm-workspaces monorepo (`apps/launcher`, `apps/api` and
  `apps/admin` stubs, `packages/shared`, `system-catalog`, `themes`, `ui`, `config`); strict
  TypeScript with project references; ESLint (incl. package boundary rules), Prettier, Vitest.
- Shared `Result`, `AppError` and the typed IPC contract with its first channel, `app.version`.
- Launcher: Electron window built with electron-vite, sandboxed renderer, typed
  `window.nextlevel` bridge, Zod-validated IPC router, i18n "Hello" screen showing the version.
- Playwright Electron smoke test and a GitHub Actions workflow on `windows-latest`.
- Project documentation: vision, requirements, user stories, roadmap, glossary, information
  architecture, screen specs, architecture, data model, API/IPC spec, coding standards, ADR-001…013,
  test strategy, release checklist, environment setup, deployment & operations, security & privacy,
  content policy, optional series plan, CLAUDE.md / AGENTS.md.

### Changed
- Node 24 LTS is the baseline (was 22) for the launcher tooling and the API.
