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
- As built (M7b): the reasons shown are cancelled, browser timeout, not authorized, PC signed out (revoked), "Connect to the internet to continue" (offline past the grace), can't reach NextLevel, and a generic failure — each with **Try again**. The maintenance banner (D28) shows above the card. A device-limit step lists the account's devices with **Remove and continue** (US-A4); Cancel signs out. A suspended account sees "This account is suspended" with Sign out only (FR-AUTH-7).

## S3 Subscribe

- Contents: user avatar/email, plan cards (name, price month/year, device limit, what the catalog includes), "Sign out".
- Actions: Choose plan → opens browser checkout; "I've already paid" → refresh.
- States: waiting-for-payment (polling indicator), payment-failed (from `past_due`), suspended (no plans, contact text).
- M7 (billing off, D21): a placeholder — "Subscriptions aren't open yet", the account's email, Sign out.
- As built (M8c, US-A2): "Choose a plan" with a Monthly/Yearly toggle (Monthly first) and one card per plan on sale: name, price for the period in the UI locale's currency format, "Devices: N", scope names, **Choose** (the first choosable one has focus). A plan without a price for the period says "Monthly only" / "Yearly only" and can't be chosen. Choose opens Stripe Checkout in the browser; the screen shows "Waiting for your payment…" with a progress bar, **I've already paid** (checks now) and **Choose another plan**, while main checks every 3 s for up to 2 minutes; the launcher unlocks as soon as the payment is seen. Errors (billing unavailable, offline) show under the cards. Sign out is always there. With billing off it stays the M7 notice. A payment-failed subscription is in its grace, so it reaches the launcher; the Account app says so.

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
    Collections with **+** (New collection), then **Smart filters** with **+** (since M5c), each
    with its count of present games.
  - **Smart filters (M5c, FR-LIB-9, D10):** selecting one lists its games (status bar tabs
    work) under a toolbar with **Edit…** and **Delete** (asks; "Used in N menus" when menus show
    it, they lose that entry). New/Edit dialog: name, systems (none ticked = all; enabled systems
    listed), favorites only, filter tags (any of, comma separated), genre contains, year from/to,
    minimum players, played (any/played/never), played in the last N days, sort (title, year, last
    played, most played, recently added), at most N games. A field's message shows once it was
    edited; Save stays off while anything is invalid; a taken name shows inline. The three
    built-ins (Favorites, Recently played, Most played) are ordinary, editable filters. Smart
    filters reach a menu only through the Menu Editor (D8).
  - Middle: virtualized multi-select list (click, Ctrl/⌘-click, Shift-click, arrows, Home/End,
    PageUp/PageDown; ContextMenu key or Shift+F10 opens the menu). A collection adds a toolbar:
    sort (manual / title / year), Move up / Move down (manual), Add games… (since M5c), Rename,
    Delete (asks first). In manual order rows also drag into a new place (see S11).
  - Right: details (box art from the media index since M6b, title, system, scrape status,
    facts, filters, description), Favorite, 1–5 stars (choosing the same star clears), Edit
    details, Open folder; a missing game shows since when, the expected path and **Relink…**.
    The scrape status line reads "Scraped <date>", "Needs review", "Not found on
    ScreenScraper" or "Last scrape failed"; a game never scraped shows none.
  - Status bar: "N games · N missing", Filter (All, Favorites, Hidden, Missing), Sort (title,
    year, rating, recently added) for systems, and what is shown.
  - Context menu as built: Play (M3), Edit details…, Scrape… (M6b, one game), Add to / Remove
    from favorites, Hide / Unhide, Add to collection…, Remove from collection (in a
    collection), Launch options… (M3), Open folder, Show missing reason… (opens Relink).
    **Play with… is left out** (owner decision 2026-10-21). Add to collection opens a dialog
    listing the collections.
  - **Scrape… (M6b, FR-SCR-1, FR-SCR-5, US-C5, D19):** "Scrape: <title>" searches on open —
    by ROM hash first (files under 512 MiB, not .m3u/.cue/.gdi; never for missing games),
    then by title with relaxed variants — and preselects the best candidate (thumbnail,
    name, year · region, similarity %, "Exact match" for a hash hit). The **Search title**
    box searches again by title, skipping the cache. Below, the preview lists every art kind
    ("Already have a local file" / "Missing locally" / "Not on ScreenScraper", disabled)
    and every field (current value struck through, scraped value). Ticked at first: missing
    art and empty fields; **Overwrite existing** ticks everything available. Title and
    fields the user edited (lock icon, "Edited by you…") are never ticked for the user;
    ticking one writes it and it stays locked. **Apply** writes the art where Settings →
    Storage says (next to the ROMs, `<system folder>/media/<kind>/<rom stem>.png|.jpg|.mp4`,
    or the central folder; D17) and the fields, then closes; kinds that fail are listed ("Video: could not be saved in the media folder")
    and the dialog stays open. A system without a ScreenScraper id shows a system picker
    (**Save system**, **Reload list**) and searches again. Errors (credentials, quota,
    network) show translated. Esc or **Close** closes; late answers are ignored.
  - **Scrape ▾ and batch scrape (M6d, FR-SCR-2, US-C6, D18):** in the header next to Scan ▾:
    **Scrape <system>…** (system scope) and **Scrape n selected games…** (2+ selected; also in
    the context menu of a multi-selection). The rules dialog "Scrape <what>" starts from
    Settings → Scraper: **Only missing art and fields** (on), art kinds, fields (never title),
    region order; **Start** is disabled with no kind and no field; a refusal (system without
    a ScreenScraper id, a job already there, a scan running) shows in the dialog. While a job
    runs, Scrape ▾ gives way to "Scraping n/m · applied a · review r" with **Pause** and
    **Cancel scraping**; paused: the reason ("Daily quota reached — resumes at <time>",
    network, account → **Open Settings** on Scraper, media folder, error) with **Resume** and
    **Cancel scraping**; finished: "Scraped N games · applied · review · not found · failed"
    and **Show Needs review**. The job lives in main: the header reads it when the Library
    opens and follows `scraper.batch.progress`.
  - **Needs review (M6d):** a fifth Filter entry lists games whose last scrape is `review`;
    the status bar adds "N needs review" for a system; scraping one from Scrape… takes it
    off the list.
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
- **Storage → Where scraped art goes** (M6c, FR-SCR-4): **Next to the ROMs** (default:
  `<location>/<system folder>/media/<kind>/<rom stem>`) or **One central folder** (picks a folder;
  `<central>/<system id>/<kind>/<rom stem>`, absolute path required) with **Browse…**. The scan
  reads the central folder first, then the per-ROM folders for kinds the central one lacks; a
  missing central folder is no art, not a failed scan. After a change: "Rescan to update art…" and
  **Scan all** (disabled until saved or while a scan runs).
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
- **Scraper** (M6a, FR-SCR-2, FR-SCR-3, US-D6, D15): **ScreenScraper account** — user name and
  password, and a collapsed **Developer credentials** group (developer id and password, marked
  **Required** while missing). Fields are always empty; a stored value shows "Saved" as its
  placeholder, and an empty field means unchanged. **Save credentials** (enabled once something
  is typed) writes to the Windows credential store and says "Credentials saved."; **Test** sends
  one request and shows "Signed in as X · N of M requests today" (or "Connected without an
  account…") or the translated error; **Remove credentials** asks inline, then clears all four.
  When Windows can't encrypt, the page says so and saving is off. Below, **Scraping** (settings
  file, Save bar): region priority and language priority (ordered lists; no region disables
  Save), and checkboxes for the batch art kinds and batch fields (no title, D19).
- **Data & logs → Import NextLevelOS** (M5d, FR-IMP-1/2, US-B3): data folder (folder picker,
  shown as a path), emulators folder (pre-filled, editable, optional), **Dry run** and
  **Import…** (enabled only after a dry run of exactly these folders). The report lists counts
  (systems to enable, menus, entries, collections; entries with a file, kept as missing, new
  files) and three collapsible lists by area — not imported or changed (open), will replace,
  imported — each row with its key, translated reason, count and detail. Import asks first,
  shows `<stage>: n of total`, then a summary with Open Library / Open Menu Editor. CONFLICT says
  "The folder changed — run the dry run again."
- **Systems → system editor → ScreenScraper system id** (M5d): empty uses the catalog id
  (shown as the placeholder); Reset clears it with the folder and extensions.
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

As built (M7b, D24): profile; "Default plan — billing not enabled" (admins: Administrator); last check time (or "Offline — access until …") with **Refresh**; devices (this PC marked, Revoke on the others; offline: "Can't reach NextLevel"); a note when Windows couldn't store the sign-in. With sign-in off (development, D25) it says so. As built (M8c): the plan line follows the subscription — "Basic · Monthly · Renews on 12 Nov 2026", "… · Ends on …" after cancelling in the Portal, "Payment failed — update your payment details" (an alert) for a failed payment, "Basic · Complimentary · until …" or "until revoked" for a grant; Stripe subscriptions get **Manage billing** (the Stripe Customer Portal in the browser). With billing off it is the M7 line.

## S13 Admin console screens

| Screen | Contents |
|---|---|
| Dashboard | KPI tiles (active subscribers, MRR, downloads 7d), recent signups, failed payments |
| Users | Table (email, role, plan, status, devices, last seen), filters; detail: grant comp, suspend, role, devices, audit trail |
| Plans | Table; editor: name, prices (Stripe price IDs), device limit, catalog scopes, archived |
| Catalog | Table (title, system, scope, license status, published); editor tabs: Metadata · Files (upload with progress, checksum) · Art · License (type, rights holder, permission document upload, terms) · Publish |
| Audit log | Filterable table: time, admin, action, target, diff |
| Settings | Grace period days, sign-up mode (open / allow-list / closed), allow-list emails, maintenance banner |

As built in M7c (D27): a sidebar (Users, Audit log, Settings, language, Sign out) and a sign-in page
(**Sign in with Google**; "This account isn't an admin" / "Sign-in was cancelled" on return).
**Users**: search (after a 300 ms pause), status filter, columns email · role · plan · status ·
devices · last seen, Load more. **User detail**: role select, Suspend (dialog, reason required) /
Unsuspend, devices with a confirmed Revoke, the audit trail; refusals for the last admin and for
your own account are explained. **Audit log**: admin-id and target-id filters, only the changed keys
shown. **Settings**: grace days (1–90), who can sign in (radio), allow-list (one email per line, bad
lines named), banner with a 280 counter; Save is enabled only when something changed. Dashboard
(D38) and Catalog come in M9.

As built in M8d (FR-ADM-2, US-F4): sidebar gains **Plans** and **Catalog scopes**. **Plans**: name
(link) with an Archived badge, slug, prices ("R$ 19,90 / month · … / year"), devices, scopes,
subscribers; **New plan**. **Plan editor**: slug (fixed after creation), name, device limit (1–20),
scope checkboxes, monthly and yearly Stripe price ids (the stored amount under each), Archived
(existing plans); Save only when something changed. Server refusals show on their field: a price
that is not the right interval, not active, unknown, already on another plan, in another currency
(on Yearly), or no billing provider; a taken slug; archiving Default. **Catalog scopes**: each scope
edits its name and description in place (Save per row); a New scope row adds one (taken slug
explained).
**Users** gains Access (All, Active, Payment failed, No access, Complimentary) and Plan filters;
the Plan column is the plan of each user's entitlement. **User detail** gains Subscription: the
current one ("Stripe · Basic · Active · renews …" with the Stripe subscription id as copyable
text, or "Complimentary · … · until …/until revoked" with **Revoke grant**, confirmed) and the
history (source, plan, status, end, created, granted by, note). **Grant complimentary access**
opens a dialog: plan (archived plans left out), optional last day (access ends at the end of that
day, UTC), note (required, ≤ 500); "This user pays through Stripe — they must cancel first" and
the other refusals show in the dialog.

As built in M9d (FR-ADM-3, US-F1, C10): sidebar gains **Catalog**. **Catalog**: search (title or
slug, 300 ms pause), status and scope filters, columns title (link) · system · scope · license
(No license, Not verified, Not started, Verified, Expired) · status · version, Load more; **New
item**: slug (fixed after creation), title, system, scope (a taken slug is explained on its
field); it then opens the editor. **Item editor** (`#/catalog/<id>/<tab>`): title, system ·
slug · version and a status badge over five tabs. *Metadata*: title, description, year,
players, developer, publisher, genre, scope; Save sends only what changed. *Files*: table
(file, role, size, SHA-256, **Replace…**, **Remove**); role + **Upload a file**; a progress bar
with its percentage, then "<name> uploaded: <size> · SHA-256 <hash>"; a name the system can't
use is explained before anything is sent ("…must end in .nes, … or .zip"); on a published
item Replace (or uploading a file with an existing name) and Remove ask first (the version goes
up, players see Update available); removing its last game file is explained. *Art*: one row
per art kind (stored size and version, or None) with Upload/Remove. *License*: type, rights
holder, contact, terms, territories (country codes), starts/expires on (UTC days); a note that
saving replaces the license (evidence and verification start over), and on a published item a
warning plus a confirmation that it unpublishes it. Evidence: the uploaded file as a download
link, **Upload evidence** (off once verified), **Mark verified** disabled with "Upload the
evidence first." until there is evidence, then "Verified by <email> on <time>". *Publish*:
When it leaves the catalog — Keep / Remove radios, none picked until the admin picks one,
saved at once; **Starter set** checkbox; "Status: …"; "Before publishing" lists every
blocker and **Publish** stays disabled until it is empty; **Unpublish** asks first.
