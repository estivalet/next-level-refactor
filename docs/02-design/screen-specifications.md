# Screen specifications

One section per screen: purpose, layout, contents, actions, states. Visual design for themes
follows the existing NextLevelOS themes (see `docs/themes.md` in the current repo). Wireframes are
ASCII; replace with images as screens are built.

Common states every screen must define: **loading**, **empty**, **error**, **offline** (when
relevant), **populated**.

---

## S1 Splash

- Purpose: show progress while booting (settings load, library open, entitlement check).
- Contents: logo, step label ("Opening library…"), progress bar.
- Errors: fatal (library DB unreadable) → "Repair library / Open data folder / Quit".

## S2 Sign-in

```
┌──────────────────────────────────────────────┐
│                 NEXTLEVEL                    │
│                                              │
│        [ G  Sign in with Google ]            │
│                                              │
│   Waiting for your browser…   (Cancel)       │
│                                              │
│   Offline? Your access expires in — days     │
└──────────────────────────────────────────────┘
```
- Actions: Sign in, Cancel (while waiting), Quit.
- States: idle, waiting-for-browser (with timeout 5 min), error (with message + retry), not-allowed ("This Google account isn't authorized" when sign-up is closed).
- Gamepad: A = sign in.

## S3 Subscribe

- Contents: user avatar/email, plan cards (name, price month/year, device limit, what the catalog includes), "Sign out".
- Actions: Choose plan → opens browser checkout; "I've already paid" → refresh.
- States: waiting-for-payment (polling indicator), payment-failed (from `past_due`), suspended (no plans, contact text).

## S4 First-run wizard

Five steps with a stepper, each with **Skip** and **Back**:

1. **Systems**: grid of systems grouped by manufacturer, popular ones pre-checked, search box.
2. **ROM folders**: list of storage locations (path, priority drag handle, remove), "Add folder", live scan counts per system.
3. **Emulators**: one row per enabled system that has games — suggested preset, "Locate executable…", status ✓/✗.
4. **Theme**: gallery of theme previews; select one.
5. **Done**: summary + "Start" (or "Browse catalog" when the library is empty).

## S5 Front-end (themes)

Each theme is specified by its own doc in `packages/themes/src/<id>/README.md`, ported from the
current themes (Big Box since M4b; Big Box List, Console Home and PS5 Style since M4c). Common
requirements:

- Levels: menu levels (categories/systems) → game list → (optional) details panel.
- Always-available inputs: back, home, theme menu, key/button help (`?` / gamepad *View*), in-list search, favorite, play.
- Game list tabs: All · Favorites · Hidden, plus the system's filter tabs when enabled.
- Status: offline badge, download-in-progress badge, clock.
- Empty system → "No games yet — Scan / Browse catalog".
- As built (M4b): while a game runs the front-end shows "Playing…" and ignores input; a launch
  failure shows its reason with Fix in Settings and Close, driven by the same input actions.
- As built (M4c): the theme menu is Desktop · Switch theme · Resume. The theme switcher (T, or
  Switch theme) shows one card per bundled theme; left/right and select apply one, back cancels.
  The new theme opens on the same level with the same game focused and becomes the last-used
  theme. LT/RT (PageUp/PageDown) jump a page in game lists: 7 tiles in Big Box, 10 rows in Big
  Box List, 3 rows in Console Home, 2 rows in PS5 Style; HyperSpin keeps letter jumps (M4d).

## S6 Desktop shell

```
┌─────────────────────────────────────────────────────────────┐
│ desktop icons                                    widgets     │
│ [Library] [Catalog] [Settings] …                 (clock)     │
│                                                              │
│              ┌ window ───────────────── _ □ × ┐               │
│              │                                 │              │
│              └─────────────────────────────────┘              │
├──────────────────────────────────────────────────────────────┤
│ [Start] [Front-end] [open windows…]       ⬇ 2  ◉ Online 21:04 │
└──────────────────────────────────────────────────────────────┘
```
- Visual style follows the current NextLevelOS shell (owner decision 2026-10-21): floating
  centered dock-style taskbar, macOS-style window buttons, dark glass Start menu with search. The
  wireframe above shows contents, not style. Requirements: FR-SHELL-1..5.
- Taskbar tray: downloads count, online/offline/grace indicator, notifications, clock.
- Start menu: apps, Front-end, Account, Sign out, Quit.

## S7 Library

```
┌ Library ───────────────────────────────────────────────────────┐
│ [Search all games…]                       [Scan ▾] [Scrape ▾]  │
├──────────────┬────────────────────────────────┬────────────────┤
│ Systems      │ Title            Year  Genre ★ │ [box art]      │
│ ▸ Nintendo   │ Super Mario 64   1996  Plat. ★ │ Title          │
│   N64  1,203 │ …  (virtualized)               │ Year · Dev     │
│   SNES 3,410 │                                │ Description    │
│ ▸ Sega       │                                │ [Play] [Edit]  │
├──────────────┴────────────────────────────────┴────────────────┤
│ 1,203 games · 12 missing · filter: All ▾          N64 · RetroArch│
└─────────────────────────────────────────────────────────────────┘
```
- Context menu on a game: Play, Play with…, Edit details, Scrape…, Add to collection, Favorite, Hide, Open folder, Show missing reason.
- Bulk select: add to collection, hide, scrape, set launch profile.
- Missing games shown greyed with a tooltip naming the expected path.
- **As built in M2c** (look of the current NextLevelOS Game Library, owner decision):
  - Header: global search (≥ 2 characters replaces the list with results from every system,
    each with its system name; Esc clears) and **Scan ▾** (Scan all systems / Scan <system>;
    while running it shows "Scanning n/m" and offers Cancel; the last summary or a start error
    sits next to it).
  - Left: virtualized tree of systems with games, grouped by manufacturer (Other last), then
    Collections with **+** (New collection).
  - Middle: virtualized multi-select list (click, Ctrl/⌘-click, Shift-click, arrows, Home/End,
    PageUp/PageDown; ContextMenu key or Shift+F10 opens the menu). A collection adds a toolbar:
    sort (manual / title / year), Move up / Move down (manual), Rename, Delete (asks first).
  - Right: details (title, system, facts, filters, description), Favorite, 1–5 stars (choosing
    the same star clears), Edit details, Open folder; a missing game shows since when, the
    expected path and **Relink…**.
  - Status bar: "N games · N missing", Filter (All, Favorites, Hidden, Missing), Sort (title,
    year, rating, recently added) for systems, and what is shown.
  - Context menu as built: Play (M3), Edit details…, Add to / Remove from favorites, Hide /
    Unhide, Add to collection…, Remove from collection (in a collection), Launch options… (M3),
    Open folder, Show missing reason… (opens Relink). **Play with… and Scrape… are left out
    until M6** (owner decision 2026-10-21). Add to collection opens a dialog listing the
    collections.
  - **Play (M3, FR-EMU-6, US-C2):** the **Play** button in the details panel, Play in the menu,
    Enter or double-click on a row or a search result. The button is disabled for missing games
    and while a game is starting or running (one at a time); the menu leaves Play out then. While it runs the launcher window is minimized and the Library
    shows "Playing <title>…"; afterwards the same row is selected and focused again and the
    details show "Played N times". A failure (before the start, or an exit code other than 0
    within 10 s) opens "<title> didn't start" with the message, the reason, the path, the exit
    code, the emulator output and **Fix in Settings**, which opens Settings on the section and
    item that fix it (Systems → the system, Emulators → the profile, Storage).
  - **Launch options… (M3, FR-EMU-4):** the profile ("System default (<name>)" or one of the
    profiles covering the system), a core and extra arguments (one per line), **Reset to system
    default**. A note says when the chosen profile has no `{extraArgs}`.
  - States: loading; empty ("No games yet" + Scan for games); library unavailable (message +
    Open data folder); no games in a tab.
  - Collections are managed here; S11 stays the M5 app for menus.

## S8 Catalog

- Tabs: **Browse** (rows: Starter set, New, by system), **Installed**, **Downloads**.
- Item card: art, title, system, size, license badge; states: available, queued, downloading (progress), installed, update available, failed.
- Item detail: description, screenshots, license + credit, size, Install/Uninstall/Play.
- Offline: "Catalog needs a connection — installed games still play".

## S9 Settings

Left navigation of sections (see IA §1), right form pane.

- Forms are generated from the settings schema (labels, help text, defaults) with custom widgets where needed (path picker, token-aware template editor, drag-to-order lists, key/button capture).
- Save bar: appears when dirty — **Save** / **Discard**; field errors inline; Save disabled while invalid.
- Drafts survive outside changes: when the settings change underneath an open section (a scan
  turning systems on, a conflict reload), the draft is rebased; the user's unsaved edits win.
- **Storage → Scan for games** (M2b, FR-LIB-3): **Scan now** (disabled with a hint while the
  section has unsaved changes or no storage location), then a progress bar (systems done / total,
  current system, files found) with **Cancel scan**, then the last result: "N games in N systems ·
  N new · N moved · N restored · N missing · N systems turned on" (zero counts omitted), a
  cancelled/failed line, and a virtualized per-system list. If the library can't be opened, the
  panel shows that error with **Open data folder**. The Library app's Scan ▾ (S7, M2c) uses the
  same channels.
- **Emulators** (M3, FR-EMU-2/5/7): **Add emulator…** (choose a preset or Custom, then the
  program; picking a known program offers its preset) creates the emulator and the preset's
  profiles for enabled systems; **Find emulators in a folder…** lists preset programs found up to
  two folders deep, checked unless already added. Each emulator shows its program and its
  profiles (virtualized) with **Change program…**, **Add from preset…** (the preset profiles it
  doesn't have, searchable), **New profile**, Edit, and Delete (asks first, naming the profile
  count; clears system defaults that named them).
- **Emulator profile editor**: name, a searchable system checklist, one row per argument with token
  autocomplete when `{` is typed and the first problem under the field ("Unknown token {romm}"),
  working folder, RetroArch core, archives (pass / extract first) and environment variables. A
  live preview of the resolved command for an example file or a game chosen from the library;
  **Test launch** (needs a game) shows command, exit code, duration and stderr, or the error.
- **Systems → system editor** (M3): the system's emulator profile: Automatic (first profile for
  the system) or one of the profiles that cover it.
- **Data & logs → Launch log** (M3, FR-EMU-10): the last 1,000 launches, newest first, loaded a
  page at a time: time, game (with a **Test** badge for Test launches), profile, duration
  ("Unknown" while it runs, or when the launcher never saw the end) and outcome (exit code or Failed). A row
  expands to the command line, the working folder and the emulator output. It refreshes when a
  launch ends.
- **General → Theme sounds** (M4d, FR-THM-4, D7): one on/off switch and a volume slider (0–100 %,
  default on at 50 %) for the navigation sounds of every theme; the slider is disabled while sounds
  are off. An open theme follows a save at once.
- **Themes** (M4b–M4d, FR-THM-1, FR-THM-2, FR-THM-4): a card per bundled theme (name, description,
  pack status, **In use**, **Use this theme**, **Options**). The pack status reads `No pack` (the pack
  folder has no art and no valid `theme.json`) or `Art NN%` (menu art the pack covers itself: logo, background and, with
  video backgrounds on, video per menu item; wallpaper shown but optional). A click opens the
  coverage panel: the pack's version · author · description, per slot `have / total` with the
  missing menu items, the pack's warnings, **Preview without fallback** (the front-end shows that
  theme with pack art only, until the launcher closes; never saved) and **Rescan art** (re-reads
  the folders; an open theme uses the new files; a failure is shown in the panel). **Options** opens the theme's page; **All themes** goes
  back to the card (with an invalid value the page stays, says why and moves focus to the value). The page has **Reset to
  defaults** (clears the theme's entry) and two groups:
  - **Art**: logo style (text with the `logo/<variant>` folders found in the art as suggestions),
    background order (ordered list of `background/<style>` folders: add, move up/down, remove),
    video backgrounds, background zoom, game background order (fanart · video · screenshot) and
    game art (All systems or one enabled system → ordered media kinds).
  - **Theme settings**, for the keys the theme's schema has: filters in the menu (HyperSpin,
    Showcase) and HyperSpin's game list wheel and menu wheel (every key with its range; an empty
    box uses the default shown as placeholder, the menu wheel's being the game list wheel's).
  Every option shows the value that applies without the user's ("Default: …", or "Pack default:
  …" when the theme pack sets it) and **Use default** once the user set one. Values out of range
  show the range and disable Save. An open theme follows a save at once.
- **Backups**: table (time, what changed, size) with Restore and Export.

## S10 Menu Editor

As built in M5b (FR-MENU-1..4, D8, D9):

- **Header:** menu picker (the active menu is marked "(active)"; while no menu is stored the
  generated one shows as "Default (not saved)" and Save stores it), New menu, Duplicate, Delete
  menu (asks), Set as active, an unsaved-changes dot, Undo (50 steps), Preview, Save.
  New/Duplicate open a dialog: name + start from *Copy of current* (new node ids) · *Generated
  from enabled systems* · *Empty*. Switching menus, New, Duplicate or closing the window with
  unsaved changes asks to discard them. A save over a newer version shows "This menu was changed
  elsewhere" with **Reload**.
- **Left:** virtualized tree with a search box (matches and their categories); drag and drop
  (upper third before, middle inside a category, lower third after); keyboard: ↑/↓ select, →/←
  expand/collapse, Alt+↑/↓ move, Alt+→ indent into the previous category, Alt+← outdent, F2
  rename (categories: name; references: display name), Delete asks; eye button shows/hides.
  Entries that can't open in themes are greyed with the reason: *System turned off*, *No games*,
  *Collection deleted*, *Smart filter deleted*, *System not in the catalog*, *Nothing in it
  shows*. **Add category** below the tree.
- **Right:** the selected node's form — kind, target picker with search (references; keeps the
  node id; a name equal to the old target's name follows), name (the art key), display name,
  short name, filter tabs (systems), visible. No theme override field yet (D9). Below it, **Not
  in this menu**: enabled systems with games, collections and smart filters no node names, each
  with **Add** (systems go under the category named after their manufacturer when one exists,
  otherwise at the end of the selected category or the root). Nothing is added on its own (D8).
- **Preview** opens the current theme fullscreen on the unsaved menu; Back at the top level or
  To desktop returns to the editor with the edits intact. It never records the theme as last
  used and games don't start from it.

## S11 Collections

No separate app (D11): collections live in the Library (S7). The tree lists them with counts
(**+** creates one); selecting one shows its games with a toolbar: sort (manual, title, year…),
Move up / Move down, **Add games…**, Rename, Delete. In manual order rows drag into a new place
(upper half of a row = before it, lower half = after it); dragging a selected row moves the whole
selection, in order. **Add games…** searches every system (2+ characters), lists results with a
checkbox (games already in are ticked and can't be changed) and adds the ticked ones at the end.
Remove from collection is in the game's context menu.

## S12 Account

Profile (Google name/email/avatar), plan + renewal date + "Manage billing" (opens portal),
devices list with Revoke, Sign out.

## S13 Admin console screens

| Screen | Contents |
|---|---|
| Dashboard | KPI tiles (active subscribers, MRR, downloads 7d), recent signups, failed payments |
| Users | Table (email, role, plan, status, devices, last seen), filters; detail: grant comp, suspend, role, devices, audit trail |
| Plans | Table; editor: name, prices (Stripe price IDs), device limit, catalog scopes, archived |
| Catalog | Table (title, system, scope, license status, published); editor tabs: Metadata · Files (upload with progress, checksum) · Art · License (type, rights holder, permission document upload, terms) · Publish |
| Audit log | Filterable table: time, admin, action, target, diff |
| Settings | Grace period days, sign-up mode (open / allow-list / closed), allow-list emails, maintenance banner |
