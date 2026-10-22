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

Each theme is specified by its own doc in `packages/themes/<id>/README.md`, ported from the
current themes. Common requirements:

- Levels: menu levels (categories/systems) → game list → (optional) details panel.
- Always-available inputs: back, home, theme menu, key/button help (`?` / gamepad *View*), in-list search, favorite, play.
- Game list tabs: All · Favorites · Hidden, plus the system's filter tabs when enabled.
- Status: offline badge, download-in-progress badge, clock.
- Empty system → "No games yet — Scan / Browse catalog".

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
  - Context menu as built: Edit details…, Add to / Remove from favorites, Hide / Unhide, Add to
    collection…, Remove from collection (in a collection), Open folder, Show missing reason…
    (opens Relink). **Play, Play with… and Scrape… are left out until M3 / M6** (owner decision
    2026-10-21). Add to collection opens a dialog listing the collections.
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
- **Backups**: table (time, what changed, size) with Restore and Export.

## S10 Menu Editor

Tree on the left (drag/drop + keyboard move up/down/indent/outdent), node form on the right
(type, target system/collection/filter picker, display name, short name, theme override, visible).
Menu picker at the top (active ✓, new, duplicate, delete, set active). Live preview button opens
the current theme on the edited menu without saving.

## S11 Collections

List of collections with counts; detail shows ordered games with drag reorder, sort-by, remove,
and "Add games…" (search picker across systems).

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
