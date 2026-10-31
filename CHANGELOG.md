# Changelog

All notable changes are recorded here. Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/);
versions follow [SemVer](https://semver.org/) (`0.<milestone>.<patch>` until 1.0).

## [Unreleased]

### Changed

- The Game Library opens on the active menu as cards, one level at a time (Home, Back, breadcrumb,
  grid or list), with **Not in menu** and **Collections** cards; the long system tree is gone
  (D61).
- A system, collection or smart filter opens into three columns: tabs, filters and genres with
  counts on the left; a box-art grid or the list in the middle (remembered per system); details
  with the video, screenshot or box on the right (D62).

### Fixed

- Importing NextLevelOS gives each system exactly the games of its gamelist: files on disk that
  no gamelist names are no longer added (a manual scan still adds them), games that only a
  collection names stay in that collection instead of joining the system, and gamelists no menu
  opens (old copies such as `Atari 2600 copy`) are reported and skipped. Library migration 0011.

### Added

- **Completed**: mark games completed from the context menu or the details, and a Completed tab;
  importing NextLevelOS turns a game's `completed` tag into the flag (D60). Library migration 0010.
- **Recently played** tab (played games, newest first).

## [0.9.0] - 2026-10-30

M9 — Catalog & downloads. Admins publish rights-cleared games with a verified license in the
console; subscribers browse what their plan includes, install them with resumable, checksum-
verified downloads into a Catalog games folder, update and uninstall them; installed games follow
each item's keep/remove rule when it leaves the catalog. A first-run wizard sets up new installs,
the console opens on a dashboard, and the launcher is portable: it writes nothing outside its own
folder. Catalog files are stored on the API machine's disk only (`FILES_DIR`); R2 storage comes
with production deployment in M10. Real Google sign-in (D26) and Stripe test mode (D32) still wait
for the owner's checks.

### Added

- **Catalog admin API (M9b):** catalog items with files, art and one license record each.
  Uploads stream through the API, which computes size and SHA-256 (4 GiB per file; local disk
  storage, `FILES_DIR`). Publishing needs a verified, unexpired license with evidence, an
  `on_lapse` choice and a game file (C10). Replacing a file bumps the item's version. Expired
  licenses unpublish their items automatically; download records are kept 12 months. Every change
  is in the audit log (system actions show as System). Migration `0003`.
- **Subscriber catalog API (M9c):** launchers browse the published items their plan's scopes
  allow (filters by system, genre, text and the Starter set), get item details, and ask for
  download URLs: one signed URL per file, valid 10 minutes, for their own device only, 60 per
  hour; downloads resume with byte ranges. `POST /v1/catalog/status` tells the launcher which
  installed items are current, have an update, or left the catalog (with the item's on_lapse
  rule). Logs show the files route's pattern, never a token or download URL.
- **Console Catalog (M9d):** a Catalog page (search, status and scope filters; title, system,
  scope, license state, status, version) and an item editor with Metadata, Files (upload with
  progress, then the size and SHA-256 the API computed; Replace and Remove ask first on a
  published item), Art (one image or video per kind), License (the record, evidence upload,
  Mark verified once evidence is there; saving a new license on a published item warns it
  unpublishes it) and Publish (On lapse Keep/Remove with no default, Starter set, every blocker
  named, Publish/Unpublish). File names a system can't use are explained before uploading.
- **Console Dashboard (M9d, D49):** the console opens on a dashboard: active subscribers
  (paying · complimentary), MRR per currency, downloads in the last 7 days, a downloads-per-day
  chart for 30 days (with a table view), the top 10 items, the 10 latest sign-ups and failed
  payments (`GET /v1/admin/stats`). Download records now keep their item (migration `0004`).
- **Launcher catalog downloads and installs (M9e):** the launcher installs catalog games
  through a download queue that survives restarts. Downloads run one at a time, resume from
  their partial files, ask again once when a link has expired, pause when the network drops and
  continue when it's back, and check every file's size and SHA-256 before installing. Games go
  to the **Catalog games** folder (Settings → Storage; by default `Catalog` inside the
  NextLevel folder; changing it affects new installs only), with their metadata and art.
  Uninstall deletes only the files the catalog installed and asks first for a favorite or a
  game in a collection. After each online sign-in check, installed games whose items left the
  catalog follow the item's rule: kept and marked, or removed with a notice.
- **Catalog app (M9f):** a desktop Catalog app with Browse (Starter set, New and one row per
  system; search, system and genre filters; keyboard and gamepad), item details with the license
  credit, Install / Update / Play / Uninstall, an Installed tab that works offline, and a Downloads
  tab with pause, resume, retry and cancel. Games removed because they left the catalog are listed
  in a notice. The taskbar tray shows running downloads (count and overall %); a click opens the
  Downloads tab.
- **First-run wizard (M9g, D48):** a new install walks through systems (popular ones ticked), game
  folders with a scan, emulators (Locate executable… and the official site; nothing is
  installed for you), where NextLevel starts, and Done. Skipping everything lands in the Catalog
  on its Starter set. Existing installs never see it; Settings → General → Run setup again shows
  it at the next start. Play on a game whose system has no emulator offers Locate emulator… and
  the official site, then plays.

### Changed

- **Portable launcher (D50, M9a):** everything the launcher writes lives in its own folder —
  `data\` next to `NextLevel.exe` (development: `.nextlevel-dev\` in the repo): settings,
  library, secrets, logs, the Chromium profile, crash dumps and temp files. The first start moves
  an older `%APPDATA%\NextLevel` folder in (size-checked, then deleted; on a failure nothing changes
  and a dialog says so). A NextLevel folder moved to another drive letter or PC keeps its paths
  (settings paths inside it follow, after a backup); on another PC the encrypted secrets can't
  be read, so you sign in again. A folder the launcher can't write (e.g. under Program Files)
  shows a dialog instead of starting.

### Fixed

- API: a URL refused by the router keeps its status (414 for a too-long parameter), is logged
  and carries the security headers; sign-in's token pruning uses an index on
  `refresh_tokens.expires_at` (migration `0002`); plan subscriber counts count active users once.
- Billing: a subscription deleted in Stripe is logged and its event stored instead of retried
  for days; late events for a deleted account are ignored; a second paying subscription for one
  user is logged; deleting an account whose subscription Stripe already cancelled succeeds; grant
  notes leave the audit log with the account. The billing stub's Pay page says when the webhook
  failed.
- Launcher Subscribe screen: errors from "I've already paid" and "Choose another plan" are shown;
  a wait that times out says the payment wasn't seen yet; a browser that won't open is explained;
  pending buttons keep focus (gamepad); no "Choose a plan" flash when subscriptions aren't open;
  no browser opens if you sign out while Checkout is being prepared.
- Admin console: Grant explains when no plan can be granted, keeps the dialog open while the
  grant is sent, refuses past dates in the picker and clears an old revoke error; focus returns
  to Grant after a revoke; the plan editor keeps typed edits across refreshes, shows a price
  refusal under the price that was sent and says why Save is disabled; scope rows show errors
  under the field they name and "Saved."; no Delete account on a deleted (tombstone) user.

### Docs

- Catalog guide (players and admins), the takedown runbook as built, `FILES_DIR` backups, where the
  C8–C10 tests live, and a release check from a packaged portable build.
- Registering a Stripe webhook endpoint for staging/production (events and API version).
- M9 catalog plan (`docs/superpowers/plans/2026-10-28-m9-catalog.md`).

## [0.8.0] - 2026-10-27

M8 — Subscriptions, in **Stripe test mode only** (D31): plans with monthly/yearly prices, the
launcher's Subscribe screen with Stripe Checkout, the Customer Portal for billing, webhooks that
keep access in step with Stripe, complimentary grants, and — before anyone is charged —
Download my data and Delete account. Billing is switched by `BILLING_ENABLED`; with it off
(the default) everyone allowed stays on the Default plan as in 0.7. `BILLING_STUB=1` runs the
whole flow without a Stripe account. Live keys, Stripe Tax and the compliance checklist are M10.
Guide: `docs/02-design/accounts-guide.md`; setup: `docs/05-operations/environment-setup.md`.

### Added

- Billing contracts and data (M8a): plans with Stripe prices, catalog scopes, subscriptions,
  `stripe_events` (migration `0001_billing`). Admin API for plans, scopes and complimentary grants
  (audited); public `GET /v1/plans`. With `BILLING_ENABLED=true` access follows the current
  subscription (payment failed → grace; offline access stops at a grant's end); the device limit
  comes from the plan.
- Billing provider (M8b): Stripe Checkout and Customer Portal (ADR-009 accepted), or the
  `BILLING_STUB=1` fake with signed webhooks. `POST /v1/me/billing/checkout` and `/portal` (one
  payable checkout per user), a return page in English and Portuguese, and
  `POST /v1/webhooks/stripe` (signature checked, idempotent, state re-read from Stripe).
- Launcher (M8c): Subscribe screen (Monthly/Yearly, plan cards, waiting for the payment, unlocks
  without a restart), Account billing line and **Manage billing**.
- Admin console (M8d): Plans and Catalog scopes pages, the Subscription panel with complimentary
  grants and revoke, Users filters by access and plan.
- Download my data and Delete account (M8e, D36) in the launcher's Account app and the admin
  console: Stripe is cancelled first (nothing is deleted if it can't be), audit entries lose the
  email, former admins are kept as anonymous tombstones.

### Changed

- The Users list's Plan column shows each user's real plan (it said "Default" for everyone).
- `BILLING_ENABLED=true` is accepted (M7 refused it); new `BILLING_STUB`, `STRIPE_SECRET_KEY`,
  `STRIPE_WEBHOOK_SECRET`.

## [0.7.0] - 2026-10-25

M7 — Accounts: only allowed accounts reach the launcher. Google sign-in in the system browser,
14 days of offline play, devices you can see and revoke, and an admin console for users,
settings and the audit log. Billing is off until M8 (everyone allowed is on the Default plan).
User guide: `docs/02-design/accounts-guide.md`.

**Not yet verified:** sign-in with a real Google account. Automated tests and CI use the
`AUTH_STUB=1` sign-in stub; the owner's check with real Google clients (D26) is still to come.
The offline grace can be set from 1 to 30 days (a sign-in lasts 30 days). The admin console's
end-to-end test needs Chromium (`npx playwright install chromium`).

### Added

- `apps/api` (M7a): Fastify + Drizzle over SQLite, run by Node 24 from TypeScript. Env checked at
  start, one error envelope with request ids, OpenAPI at `/v1/openapi.json`, health check.
- Launcher sign-in on the API: Google (or the `AUTH_STUB=1` personas) code exchange with PKCE,
  access tokens (15 min) and rotating refresh tokens (30 days, reuse revokes the device), sign-up
  mode (allow-list by default), bootstrap admins from `ADMIN_EMAILS`, the Default plan while
  billing is off, a 3-device limit with "remove one to continue", `/v1/me` and devices, rate
  limits. `npm run dev` now starts the API, the admin console and the launcher together.
- Launcher sign-in (M7b): Sign in with Google in the system browser (PKCE + loopback), the
  session in the Windows credential store, an hourly entitlement check, 14 days offline with an
  Offline indicator, "Connect to the internet to continue" after that (library untouched),
  suspended and not-authorized screens, "remove a device to continue", the maintenance banner,
  and the **Account** app (profile, plan, devices with Revoke, Refresh, Sign out).
- Admin console v0 (M7c, `apps/admin`): Google sign-in for admins (cookie session, CSRF,
  8 h idle), **Users** (search, filter, detail with role, Suspend with a reason, Unsuspend,
  devices with Revoke, audit trail), **Settings** (offline grace days, who can sign in,
  allow-list, maintenance banner) and the **Audit log**; English and Portuguese. Every admin
  change is recorded with who, what, when and before/after.

### Fixed

- Batch scrape: the summary says "1 game" in the singular; done never shows above the total;
  Pause and Cancel read "Pausing…" / "Cancelling…" until the current game finishes; after Start
  the keyboard is on Pause, after Close back on Scrape ▾; **Show Needs review** opens the
  batch's system.
- Art downloads running at the same time no longer fail when one removes the shared temp folder.
- Candidate thumbnails are served only when the bytes are an image, with the type the bytes show.
- Choosing a ScreenScraper system for an unknown system id is refused.

## [0.6.0] - 2026-10-25

M6 — Scraping & media: ScreenScraper art and details for one game with a preview, or a whole
system in a resumable background batch; art written where NextLevelOS finds it and shown at
once. User guide: `docs/02-design/scraping-guide.md`.

### Added
- M6a scraper core (FR-SCR-3, US-D6): **Settings → Scraper** keeps the ScreenScraper account and
  the developer id/password (D15) in the Windows credential store (`secrets.bin`, encrypted with
  Electron `safeStorage`), never in settings, backups or logs; **Test** shows the account and
  today's request count. The same page orders regions and languages and picks the art kinds and
  fields a batch scrape fills. Under the hood: a TypeScript ScreenScraper client ported from
  NextLevelOS (title matching, hash identify, metadata, art selection) with quota limits and a
  response cache.
- M6b single-game scrape (FR-SCR-1, FR-SCR-4, FR-SCR-5, US-C5): **Scrape…** in the Library's
  game menu finds the game on ScreenScraper (by ROM hash, then by title), previews its art
  and fields against what the game has, and applies the ticked ones. Art is written where
  NextLevelOS looks for it (`media/<kind>/<rom stem>`, PNG / JPEG fanart / MP4, D17) and
  shows at once in the Library and the themes; fields you edited stay yours unless you tick
  them (D19). The details panel shows the box art and when the game was last scraped.
- M6c media location and batch engine (FR-SCR-2, FR-SCR-4): **Settings → Storage → Where
  scraped art goes** — next to the ROMs (default) or one central folder, which the scan reads
  first. A batch scrape engine fills a system or a selection one game at a time: it applies a
  game only on an exact hash match or a single close candidate and marks the rest for review
  (D18), never touches fields you edited, pauses when the daily quota runs out (resuming on
  its own) or the network or credentials fail, and picks up where it left off after a
  restart.
- M6d batch scrape in the Library (FR-SCR-2, US-C6): **Scrape ▾** next to Scan ▾ (a system, or
  the selected games) with a rules dialog from your Settings → Scraper defaults; progress,
  Pause / Resume / Cancel and the reason for a pause in the header; a finished summary with
  **Show Needs review**, a new Filter entry listing the games a batch couldn't match on its
  own, with a count in the status bar.

### Changed
- Game art kinds follow the NextLevelOS folder names (D16): `box-3d`, `cart-front` and
  `screenshot-game-title` are offered, `screenshot-select` is gone. Settings move to schema
  version 2; saved theme game-art lists are renamed on load (the next save backs up the old
  file).

## [0.5.0] - 2026-10-24

M5 — Menus, collections & import: menus as user data with a visual Menu Editor and live
preview, smart filters and collection editing in the Library, and an importer that brings a
NextLevelOS setup over with a dry run first.

### Added
- M5a menus core (FR-MENU-1..3, FR-LIB-9, US-D5): menus are stored in the library and themes show
  the active one; until a menu is saved they keep the generated menu. Menu nodes can be
  categories, systems, collections and smart filters; what can't open (hidden, disabled, empty or
  deleted) is left out. Smart filters are saved game queries; Favorites, Recently played and Most
  played are created on first start. An open theme reloads its menu when a menu, collection or
  smart filter changes or a scan finishes, and stays on the same entry. The Menu Editor arrives in
  M5b.
- M5b Menu Editor (FR-MENU-1..4, US-D5): a new desktop app to keep several menus with one active,
  edit the tree (drag and drop, keyboard moves, rename, search, undo), point entries at systems,
  collections and smart filters, and see what isn't in the menu yet (nothing is added on its own).
  Entries that can't show are greyed with the reason. Preview shows the unsaved menu in the
  current theme. A save over a newer version asks to reload.
- M5c smart filters and collections in the Library (FR-LIB-8, FR-LIB-9): a Smart filters list
  with counts, a dialog to create and edit them over every field, and delete that says which
  menus lose the entry. Collections in manual order reorder by dragging rows (a selection moves
  together) and gain **Add games…**, a search picker across systems.
- HyperSpin letter jumps and the HyperSpin/Showcase settled game stay fast on 10k-game lists.
- Open themes now also reload the menu when a game change makes a menu entry appear or go away
  (e.g. the first favorite brings in Favorites), when a system is turned on or off, and when a
  collection is created.
- M5d Import NextLevelOS (FR-IMP-1/2, US-B3) in Settings → Data: choose the NextLevelOS
  `public\data` folder (and, optionally, an emulators folder: found emulators are added for
  systems without one), run a dry run that reports what maps, what doesn't and why, then import
  with progress per stage. Storage, systems (folders, extensions, ScreenScraper ids), theme
  options, games with metadata, favorites, hidden, filters, play history, per-game core and
  RetroArch options, arcade info, collections and menus come over; games whose files aren't
  found are kept as missing and come back when a scan finds them. Importing again updates what
  the last import brought and never duplicates; collections and menus made here are left alone.
  The NextLevelOS folder is only read.
- Settings → Systems: a ScreenScraper system id override per system.

### Changed
- Scans search group folders whose name starts with `!`, `+` or `#` (`! Hacks/! Hacks-SMW/…`) up
  to 10 levels deep; other sub-folders are still searched one level deep.
- The theme art lists in Settings refresh when the art or theme packs folder changes.

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
