# Systems museum — design

Date: 2026-11-15 · Owner request (PS5 hero screenshots; "a museum" of every system) ·
Requirements: new `FR-MUS-1…5` (to add) · Decision: D67 (to add) · Project

## Intent and why

The owner wants every system to carry rich, editable metadata (story, release year, launch
price, hardware, models, top games), "like a museum". Two reasons:

1. **To browse it**: on the couch with a controller, inside a theme, as a page per system.
2. **To curate it**: at the desk, in a dedicated launcher window, every field editable.

It also unblocks the PS5 theme redesign (the first screenshot), whose hero shows
`Manufacturer · Year` and whose shelf shows `SHORT  Full name`. Today the themes cannot read a
system's manufacturer, and no release year exists anywhere for catalog systems.

## Goals

- A **museum entry** per system (catalog and custom), seeded from the owner's scraped data and
  shipped with the launcher.
- A **Museum** desktop app (shell window) to browse and edit every field of every entry, and to
  reset an entry to the shipped version.
- A **museum page in the themes**, opened from a focused system, readable with a controller.
- **Top games**: a curated list of titles per system. Titles the owner has in the library are
  marked and can be launched from the museum page.
- Themes can read an entry through `ThemeHost`, so the PS5 hero can show manufacturer and year.

## Non-goals

- Central management in the admin console / API and syncing entries to other users (approach B,
  rejected for now; the entry schema should not stand in its way).
- Downloading model images locally. Images stay remote URLs and show when online.
- Per-language text. One text per field; the owner edits it into Portuguese where they want.
- A top-games list derived from play time or favorites.
- The PS5 hero redesign itself. It is the next change and consumes this data (see Order).

## Anti-goals

- Hand-edited JSON for the owner. Every field is edited in the Museum app (CLAUDE.md rule).
- Any runtime dependency on `E:\NextLevel\assets\system-info` or `../NextLevelOS`. The import
  is a one-off script whose output is committed.
- Losing an owner's edit when a release ships a better seed.

## Constraints

- Contracts first: the entry schema, IPC channels and ThemeHost call are Zod schemas in
  `packages/shared` before code uses them.
- `packages/themes` stays free of Node/Electron. It reads entries only through `ThemeHost`.
- Multi-row DB changes in transactions; library migration committed
  (`npm run db:generate -w apps/launcher`).
- Files under 400 lines: the seed is one file per system, the Museum app is split by section.
- All UI strings through i18n (en and pt-BR).
- No commercial ROMs, BIOS files or links to them, in seed text or anywhere else.

## Approaches

Where the data lives (decided with the owner):

- **A. Bundled seed + local edits (picked).** Seed committed in `packages/system-catalog`,
  edits saved on the owner's machine. Smallest, offline, fits how systems work today.
- **B. Admin console + sync to every launcher.** One edit reaches all users. Rejected for now:
  API tables, admin screens, sync and licensing review make it several times the work.

Where local edits are saved (decided with the owner):

- **1. Library database (picked).** A row per edited system holding the whole entry as
  validated JSON, merged over the seed in main. Covered by existing library backups and
  transactions; "reset" deletes the row.
- **2. One JSON file per system in the data folder.** Rejected: a second store with its own
  backup story.
- **3. Settings file.** Rejected: long text would bloat a file meant for small options.

## Design

### Data: the museum entry

Schema `SystemInfoSchema` in `packages/shared/src/systems/info.ts`. Every field optional except
`systemId`; strings trimmed; empty means "unknown".

- **Overview**: `fullName`, `manufacturer`, `country`, `releaseYear`, `discontinuedYear`,
  `generation`, `unitsSold` (text, e.g. "61.91 million"). The type is the system definition's
  existing `kind` (console, handheld, arcade, computer, pinball, engine, other), not a second
  field (planning correction).
- **Story**: `description`, `history`, `legacy` (multi-paragraph text).
- **Hardware**: `cpu`, `ram`, `graphics`, `sound`, `media`, `display` (text).
- **Models**: list of `{ name, releaseYear, launchPrice (text, e.g. "£399", "US$199"), cpu, ram,
  notes, imageUrl }`.
- **Related**: `predecessor`, `successor` (text), `peripherals` (list of text).
- **Top games**: ordered list of `{ title, year?, gameId? }`. `gameId` pins a library game.
- **Sources**: list of `{ name, url? }` crediting where the text came from (see Attribution).

### Attribution (owner decision, 2026-11-15)

The descriptions are kept and shipped. Most come from Wikipedia (CC BY-SA, which requires credit
and a link to the source), the rest from the LaunchBox Games Database. So:

- The import sets `sources` per entry: `Wikipedia (CC BY-SA 4.0)` (licence URL) when the story
  text came from the scraped JSON, preceded by `Wikipedia` (article URL) when the file's
  `references` name one; `LaunchBox Games Database` (site URL) when it came from the XML; both when
  both were used.
- The museum page and the Museum app show a "Sources" line at the end of the entry. The Museum
  app links a source when its `url` is https; the theme's museum page shows names only, since a
  link would open a browser and leave kiosk mode (FR-SET-6). The owner can edit sources like any
  other field.
- `docs/` gets a short note that seed text is CC BY-SA where it came from Wikipedia.

### Seed import (one-off)

- Script `packages/system-catalog/scripts/importSystemInfo.ts`, run by hand with the source
  folder as an argument. Reads the per-system JSONs and `00_lb_metadata.xml`.
- Maps each source file to a catalog system id by name, then aliases, then the LaunchBox
  platform name already on the definition. Normalizes the varying keys (`release_year`,
  `releaseDate`, `initial_release_year`, `models`/`modelos`, `notable_games`, …) into the schema;
  fills gaps from the LaunchBox XML (release date → year, manufacturer, specs, notes →
  description when missing).
- Writes one file, `packages/system-catalog/data/system-info.json` (`{ source, entries: [...] }`
  sorted by system id, pretty-printed), validated by the schema, and a report of unmatched
  files, unparseable files (4 today), and dropped keys. One file like `systems.json`, because a
  JSON import per system cannot be bundled (planning correction; data files are not under the
  400-line code rule).
- Pure mapping/normalizing logic is unit-tested with small synthetic fixtures (no scraped text
  in tests).
- `packages/system-catalog` exports the seed entries (`systemInfoSeed(systemId)`).

### The Showcase theme's `system-info` art files

Showcase already reads a description from `system-info/<name>.json` in the art folders
(`useSystemInfo`), which is where the owner's scraped files sit today. After this change
`useSystemInfo` asks `ThemeHost.getSystemInfo` first for a node with a `systemId`, and falls
back to the art file for nodes without a museum description (categories, collections). The art
files keep working; nothing is removed (planning correction).

### Storage of edits

- Library table `system_info` (`system_id` PK, `entry` JSON text, `updated_at`).
- Main merges: an edited row **replaces** the seed entry for that system (whole entry, not
  per-field). Reset deletes the row. A new release's seed shows only for unedited systems.
- Custom systems (FR-EMU-11) already have manufacturer, release year and description in their
  settings. Their museum entry starts from those values as its seed; edits in the Museum app go
  to `system_info` like any other system. The custom-system dialog keeps its fields.

### IPC and ThemeHost

- `systems.info.list` → `{ systemId, name, kind, manufacturer, releaseYear, edited }[]` for
  every enabled-or-not catalog and custom system.
- `systems.info.get` (`{ systemId }`) → `{ entry, edited }` (merged).
- `systems.info.save` (`{ systemId, entry }`) → the saved entry; validated in main.
- `systems.info.reset` (`{ systemId }`) → the seed entry.
- Event `systems.infoChanged` (`{ systemId }`) after save/reset.
- `ThemeHost.getSystemInfo(systemId)` → entry or null; top games come back with
  `owned: { gameId } | null` resolved in main (pinned `gameId` if present, else a normalized
  title match against that system's present games, first match wins).

### Museum app (launcher shell window)

- New app `museum` in `apps/launcher/src/renderer/apps/registry.ts`, single instance.
- Left: searchable list of systems (name, manufacturer, year, "edited" dot), filter by kind.
- Right: the entry in sections (Overview, Story, Hardware, Models, Related, Top games), each
  editable in place; Save / Discard; "Reset to original" with confirm when `edited`.
- Models and top games are editable lists (add, remove, reorder). A top game can be linked to a
  library game through a picker limited to that system; linked/owned games show a badge.
- Model images render from their URL; a broken or offline image shows a placeholder.

### Museum page in the themes

- A shared component in `packages/themes/src/components/` (no theme-specific styling beyond
  CSS variables), opened by a new intent `open-info` on a focused system node, closed with Back.
  A new input action `info` (keyboard `I`; no default gamepad button, since every face button
  is taken) maps to it; it can be bound in Settings → Input like every action.
- Layout: logo, `Manufacturer · Year · Country`, description; then Hardware, Models (with
  image and launch price), Top games. Scrolls with the d-pad; an owned top game is focusable and
  Enter launches it.
- First wired into the PS5 theme: the `info` key, and a "…" button next to Explore. On the PS5
  home, Down from the shelf focuses Explore, Right then focuses "…", Select activates, Up goes
  back to the shelf (as on a PS5, and how a controller reaches the page with no extra button).
  Other themes can add the key later.

## Order

1. Schema + seed import + committed seed.
2. Library table, merge, IPC.
3. Museum app (browse + edit).
4. ThemeHost call + museum page in themes (PS5 first).
5. Next change: PS5 hero redesign (short name badge + full name next to the selected tile,
   logo nudged right, `Manufacturer · Year` under it, total games and favorites on the right).

## Docs to update with the build

New `FR-MUS-*` section in product requirements and stories (Epic for Systems museum), screen
spec for the Museum app and the theme page, data model (`system_info`), IPC contract in the
architecture doc, decision D67 in the roadmap, `CHANGELOG.md` Unreleased.

## Calls made (not discussed with the owner)

- Field list above, normalized from what most scraped files agree on.
- Whole-entry override (not per field); reset deletes it.
- Custom systems seed their museum entry from their existing settings fields.
- Top-game matching: pinned `gameId`, else normalized title within the system.
- Museum page is a shared themes component, first wired into PS5.
- Images stay remote URLs.

## Left to the builder

Exact title normalization, list virtualization if needed, component split, keymap key choice,
i18n strings, test names (`FR-MUS-n: …`).
