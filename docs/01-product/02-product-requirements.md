# 02 — Product requirements (PRD)

Authoritative list of what v1 must do. Priorities: **M** = must for v1, **S** = should, **C** = could.
Each requirement has a stable ID; stories in [03-user-stories.md](03-user-stories.md) and tests
reference these IDs. Schemas live in [data-model.md](../03-architecture/data-model.md), not here.

## 1. Accounts & access (`FR-AUTH`)

| ID | Requirement | P |
|---|---|---|
| FR-AUTH-1 | Users sign in with Google. No passwords are stored by the service. | M |
| FR-AUTH-2 | The launcher signs in through the system browser (not an embedded web view) and receives a session from the API. | M |
| FR-AUTH-3 | Two roles: `admin` and `subscriber`. A user without an active or in-grace subscription may sign in but only sees the subscribe screen. | M |
| FR-AUTH-4 | Admins are designated in the admin console or by an environment allow-list at first boot (bootstrap admin). An `ADMIN_EMAILS` address becomes admin when its account is created; a later demotion in the console sticks. | M |
| FR-AUTH-5 | The launcher works offline for up to the grace period (default 14 days, admin-configurable) after its last successful entitlement check. After that it shows the sign-in screen; local data is untouched. | M |
| FR-AUTH-6 | Users can sign out; sign-out removes tokens from the device and leaves the local library intact. | M |
| FR-AUTH-7 | An admin can suspend a user; the suspension takes effect at the launcher's next entitlement check (at most 1 hour while online). | M |
| FR-AUTH-8 | A user can be signed in on up to N devices (default 3, per plan). Users can see and revoke their devices. | S |

## 2. Subscriptions & billing (`FR-SUB`)

| ID | Requirement | P |
|---|---|---|
| FR-SUB-1 | Plans have a name, monthly/yearly price, device limit and catalog scopes. Admins manage plans. | M |
| FR-SUB-2 | Subscribing, changing plan, cancelling and updating payment details happen in a hosted payment page (Stripe Checkout / Customer Portal). The service never sees card numbers. | M |
| FR-SUB-3 | Subscription state is driven by payment-provider webhooks: `active`, `past_due`, `canceled`, `expired`. `past_due` keeps access for the provider's retry window. | M |
| FR-SUB-4 | Admins can grant a complimentary subscription (for testers, reviewers, demos). | M |
| FR-SUB-5 | Billing can be switched off entirely (development and early milestones): every signed-in allow-listed user is treated as subscribed to a default plan. | M |

## 3. Library & ROM sources (`FR-LIB`)

| ID | Requirement | P |
|---|---|---|
| FR-LIB-1 | Users add **storage locations** (base folders) with a priority. Systems' ROM folders resolve under each location; the first location that contains a game wins. | M |
| FR-LIB-2 | Each system can override its ROM folder name and accepted file extensions. Defaults come from the system catalog. | M |
| FR-LIB-3 | A scan finds new, moved and missing games per system or for all systems, runs in the background, can be cancelled and reports progress. | M |
| FR-LIB-4 | Missing files are flagged, not deleted, so metadata survives a disconnected drive. | M |
| FR-LIB-5 | Multi-disc games (`.m3u`, `.cue` + `.bin`, `Disc 1/2`) appear as one game. | M |
| FR-LIB-6 | Games carry metadata (title, year, developer, publisher, genre, players, description, region, filters) editable in-app. | M |
| FR-LIB-7 | Users can favorite, hide, rate and mark games completed (D60); the launcher records play count and last played. | M |
| FR-LIB-8 | Collections: create, rename, delete, add/remove games from any system, order manually or by field. | M |
| FR-LIB-9 | Smart filters: saved queries (e.g. "Favorites", "Recently played", "Genre = Shooter") usable as menu nodes. | S |
| FR-LIB-10 | Global search across all systems by title, with results under 150 ms for 200k games. | M |
| FR-LIB-11 | Import and export of game lists in EmulationStation `gamelist.xml` format. | C |

## 4. Systems, emulators & launching (`FR-EMU`)

| ID | Requirement | P |
|---|---|---|
| FR-EMU-1 | The launcher ships a **system catalog** (id, name, manufacturer, year, type, default extensions, scraper IDs, suggested emulators). Users enable the systems they want. | M |
| FR-EMU-2 | Users add **emulators** (name, executable path, version) and **emulator profiles** (argument template, working directory, supported systems, RetroArch core where relevant) in Settings. | M |
| FR-EMU-3 | Argument templates use a fixed, documented set of tokens (e.g. `{rom}`, `{romDir}`, `{romName}`, `{core}`, `{emulatorDir}`). Unknown tokens fail validation when saving, not at launch. | M |
| FR-EMU-4 | Each system has a default profile; each game may override it (profile, core, extra args). | M |
| FR-EMU-5 | A **Test launch** button in Settings runs a profile against a chosen game and shows the exact command and the emulator's exit code/stderr. | M |
| FR-EMU-6 | Launching hides the front-end, waits for the emulator to exit, then restores focus to the same game. | M |
| FR-EMU-7 | Built-in presets for common emulators (RetroArch, Dolphin, PCSX2, DuckStation, PPSSPP, MAME, Cemu, …) so the user only picks the executable. | M |
| FR-EMU-8 | Archives (`.zip`, `.7z`) are passed directly when the profile supports them, otherwise extracted to a temp folder that is cleaned after exit. | S |
| FR-EMU-9 | Pre-launch steps (mount squashfs, WSL, custom script) as optional profile hooks. | C |
| FR-EMU-10 | Each launch is recorded in a launch log (time, profile, command, exit code, duration) viewable in Settings. | S |

## 5. Online catalog & downloads (`FR-CAT`)

| ID | Requirement | P |
|---|---|---|
| FR-CAT-1 | Subscribers browse the catalog by system, genre and text search, filtered to what their plan allows. Built in M9 (Catalog app Browse: Starter set, New, per-system rows; scopes enforced by the API, C8). | M |
| FR-CAT-2 | Each catalog item shows title, system, description, art, size, license and rights holder/credit. | M |
| FR-CAT-3 | Install downloads the files into a launcher-managed storage location, verifies SHA-256 checksums, and adds the game (with metadata and art) to the library. Built in M9: the Catalog games folder (`<NextLevel folder>\Catalog` by default, D45). | M |
| FR-CAT-4 | Downloads are resumable, queued, cancellable, and show progress. Built in M9: one at a time, queue and partial files survive restarts, an expired link is asked for again once. | M |
| FR-CAT-5 | Installed catalog games can be uninstalled from the launcher. Local ROMs are never deleted by uninstall. | M |
| FR-CAT-6 | Download URLs are short-lived and tied to the user; they cannot be shared. | M |
| FR-CAT-7 | When a catalog item is removed or a subscription lapses, installed copies remain playable or are removed according to the item's license terms (field on the item). Built in M9: `on_lapse` keep/remove, applied after each online sign-in check (D43); a lapsed subscription locks the launcher and removes nothing. | M |
| FR-CAT-8 | Every catalog item has a license record (see [content policy](../06-legal/content-policy.md)); items without one cannot be published. | M |

## 6. Themes & front-end mode (`FR-THM`)

| ID | Requirement | P |
|---|---|---|
| FR-THM-1 | Port the six NextLevelOS themes (Big Box, Big Box List, Console Home, PS5 Style, HyperSpin Classic, Showcase) onto the shared themes engine. | M |
| FR-THM-2 | Theme packs: per-theme folder with art + option overrides, falling back to the shared asset folder. Art coverage report per theme. | M |
| FR-THM-3 | Every theme is fully usable with a gamepad (Xbox/PlayStation layouts), keyboard, or mouse. Inputs are remappable in Settings. | M |
| FR-THM-4 | Theme options (logo variant, background order, video backgrounds, per-system game-art choice, wheel settings, sounds) are edited in Settings. | M |
| FR-THM-5 | The launcher can boot straight into the last theme, a chosen theme, or the desktop. | M |
| FR-THM-6 | Themes read data only through the engine's host interface, so the same theme code runs in the web player later. | M |

## 7. Menus (`FR-MENU`)

| ID | Requirement | P |
|---|---|---|
| FR-MENU-1 | Visual menu editor: add, rename, reorder (drag and keyboard), hide, delete nodes; categories nest without limit. | M |
| FR-MENU-2 | Node types: category, system, collection, smart filter. Nodes reference systems/collections by ID, so renaming never breaks links. | M |
| FR-MENU-3 | Several menus can exist; one is active. A new user gets a generated menu (by manufacturer) of their enabled systems. | M |
| FR-MENU-4 | Per-node options: display name, short name, theme override, filter tabs on/off. (v0.5.0: all but theme override, which is stored and reported by the importer — D9.) | S |

## 8. Scraping & media (`FR-SCR`)

| ID | Requirement | P |
|---|---|---|
| FR-SCR-1 | Scrape one game: search ScreenScraper, preview candidates, choose fields and art kinds to apply. | M |
| FR-SCR-2 | Batch scrape a system with rules (only missing fields, art kinds, region priority), resumable and rate-limit aware. | S |
| FR-SCR-3 | Scraper credentials are entered in Settings and stored in the OS credential store. | M |
| FR-SCR-4 | Media is stored per system under `media/<art kind>/` next to the ROM folder (current convention) or in a central media folder (setting). | M |
| FR-SCR-5 | The library records which media files exist so themes never probe the disk at render time. | M |

## 9. Settings (`FR-SET`)

| ID | Requirement | P |
|---|---|---|
| FR-SET-1 | Every launcher option is editable in the Settings app. No feature requires editing a file. | M |
| FR-SET-2 | Settings are validated on save with field-level messages; invalid settings are never written. | M |
| FR-SET-3 | Each save keeps a rotating backup (last 10). Settings → Backups can restore any of them. | M |
| FR-SET-4 | Settings can be exported to and imported from a single file. | M |
| FR-SET-5 | Optional cloud sync of settings, menus, collections and user game state across a subscriber's devices (not ROMs or media). | S |
| FR-SET-6 | Kiosk mode: hide the desktop and Settings; a PIN unlocks them. | S |
| FR-SET-7 | Settings show where data lives on disk (data folder, library DB, logs) with "open folder" buttons. | M |

## 9a. Desktop shell (`FR-SHELL`)

Screen: [S6 Desktop shell](../02-design/screen-specifications.md#s6-desktop-shell). All rows **(proposed)**.

| ID | Requirement | P |
|---|---|---|
| FR-SHELL-1 | The desktop shows an icon for each launcher app; double-click, or Enter on a focused icon, opens it in a window. | M |
| FR-SHELL-2 | Windows can be moved, resized, minimized, maximized/restored and closed. The window that is opened or clicked comes to the front with focus. Windows are kept inside the desktop area so their title bar stays reachable. | M |
| FR-SHELL-3 | Opening an app that is already open brings its window to the front (restoring it if minimized) instead of opening a second one, unless the app allows several. | M |
| FR-SHELL-4 | The taskbar shows Start, one entry per open window, and a tray with the clock. Activating an entry focuses or restores its window, or minimizes it if it is already focused. Tray indicators (downloads, online status) arrive with their milestones. | M |
| FR-SHELL-5 | The Start menu lists the apps, filters them as you type, and offers Quit. Esc or a click outside closes it. Front-end, Account and Sign out entries arrive with M4 and M7. | M |

## 10. First run & import (`FR-ONB`, `FR-IMP`)

| ID | Requirement | P |
|---|---|---|
| FR-ONB-1 | First-run wizard: sign in → choose systems → add ROM folders (or skip) → pick emulator executables for enabled systems (or skip) → pick a theme. Every step can be skipped and revisited in Settings. Built in M9 (D48; Settings → General → Run setup again; existing installs skip it). | M |
| FR-ONB-2 | A user who skips everything lands in the catalog with a suggested starter set. | M |
| FR-IMP-1 | Import a current NextLevelOS data folder: storage, systems, launchers (as emulator profiles where possible), menus, gamelists, collections, favorites/hidden/played, themes, ScreenScraper IDs. | M |
| FR-IMP-2 | The importer is a dry run first: it reports what maps, what doesn't, and why, before writing anything. | M |

## 11. Admin console (`FR-ADM`)

| ID | Requirement | P |
|---|---|---|
| FR-ADM-1 | Users: list, search, view subscription and devices, grant complimentary access, suspend/unsuspend, change role. Complimentary grants: M8 (plan, optional end, note; D35); also Delete account (D36). | M |
| FR-ADM-2 | Plans: create, edit, archive; set price IDs, device limit, catalog scopes. | M |
| FR-ADM-3 | Catalog: create items, upload files, attach art and metadata, attach license record, publish/unpublish. Built in M9 (console Catalog; see the catalog guide). | M |
| FR-ADM-4 | Settings: grace period, sign-up open/closed (allow-list mode), maintenance banner text. | M |
| FR-ADM-5 | Audit log of every admin action (who, what, when, before/after). | M |
| FR-ADM-6 | Dashboard: active subscribers, downloads per day, top catalog items. Built in M9 (D49: plus MRR, latest sign-ups, failed payments). | S |

## 12. Non-functional requirements (`NFR`)

| ID | Requirement |
|---|---|
| NFR-PERF-1 | Cold start to interactive theme ≤ 3 s on the reference PC (Ryzen 5 4600H, 16 GB, SSD) with 200k games. |
| NFR-PERF-2 | Opening a game list of 10k games ≤ 300 ms; scrolling holds 60 fps (virtualized). |
| NFR-PERF-3 | Global search ≤ 150 ms for 200k games (SQLite FTS). |
| NFR-PERF-4 | Launcher idle memory ≤ 400 MB with a theme open. |
| NFR-REL-1 | No write leaves a file or database half-written (atomic writes, transactions). |
| NFR-REL-2 | A crash in a theme never loses library data and the shell can recover (error boundary + restart theme). |
| NFR-SEC-1 | See [security-and-privacy.md](../06-legal/security-and-privacy.md). Renderer has no Node access; all OS access goes through typed IPC with validated input. |
| NFR-A11Y-1 | Shell and Settings: full keyboard navigation, visible focus, WCAG AA contrast, screen-reader labels. Themes: focus always visible, reduced-motion setting respected. |
| NFR-I18N-1 | All UI strings go through a translation layer; v1 ships English, with Portuguese (pt-BR) as the second locale (confirmed by the owner 2026-10-21; pt-BR ships from M1). |
| NFR-COMP-1 | Windows 10 22H2+ and Windows 11, x64. |
| NFR-OBS-1 | Launcher writes rotating local logs; API writes structured JSON logs with request IDs. No telemetry without opt-in. |
| NFR-MAINT-1 | TypeScript strict everywhere; lint, type-check and tests pass in CI before merge. |
| NFR-MAINT-2 | Every requirement here traces to at least one test or a documented manual check. |
| NFR-UPD-1 | The launcher auto-updates from a release channel, with the option to defer. |
