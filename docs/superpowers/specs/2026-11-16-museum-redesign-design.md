# Systems museum redesign: design

Date: 2026-11-16 · Owner request (screenshot of the Museum app + a Claro TV+ home screen) ·
Requirements: new `FR-MUS-6…9` and story `US-G3` (to add) · Builds on
[2026-11-15-systems-museum-design.md](2026-11-15-systems-museum-design.md) · Project

## Intent and why

The Museum app works but reads like a plain form. The owner wants three things:

1. **To use it as their own reference while emulating.** Some systems are hard to emulate, and
   they want personal notes for each system, plus which emulators are set up to launch it.
2. **To make it a place to look at, not just a form.** Each system shows its hardware photo
   first, plus a gallery of related images the owner adds. The window should look like a TV
   home screen (the Claro TV+ reference): a left menu with icons and a highlighted pill, a large
   hero image, and a **Home** entry above the systems.
3. **To fix the floating Save/Discard bar.** Today it is `sticky` inside the scrolling
   `<article>`, which has `p-5`, so fields scroll by visibly under the bar. The actions belong
   in a bar pinned to the bottom of the window.

## Goals

- Pin Save / Discard / Reset to the bottom of the Museum window, outside the scrolling area.
- A **Notes** free-text field per system: the owner's own words, and **not part of the museum
  entry**, so Reset (restore the shipped entry) never deletes it.
- An **Emulators** section: the emulator profiles from Settings that list the system, grouped by
  emulator. Read-only; nothing new is stored. A system can have several emulators.
- A **hardware image** at the top of every system page, from the menu art folder.
- An **image gallery** per system: the owner adds image files, which are copied into the
  launcher's data folder. They can be ordered, captioned and removed.
- A **new layout**: a left menu in the Claro style with a **Home** item first, then search,
  filter and the systems. The right side is a hero with the hardware image plus the sections.
- A **Home page**: a featured system hero, a "Recently changed" row, a "Has notes" row, and
  counts.

## Non-goals

- Theme pages (the couch `MuseumPage` in `packages/themes`) do not show notes, emulators or the
  gallery in this change. The theme contract (`ThemeSystemInfoSchema`, `ThemeHost`) is unchanged.
- No editing of emulators or profiles from the Museum: Settings → Emulators stays the only
  place.
- No web image URLs in the gallery (model photos keep their existing URL + cache path).
- No change to the shipped seed data or importer.
- No backup/export of notes or gallery images. They live in `library.db` and `<dataDir>`,
  which, like the rest of the library, have no backup today (only `settings.json` does,
  FR-SET-3).

## Anti-goals

- A gallery image that disappears because the owner moved or renamed the original file. That
  is why images are copied (owner's choice, below).
- Reset wiping the owner's notes or gallery.
- Any hand-edited JSON. Everything is edited in the app.
- Layout that only works at the default 1200×760 window: the menu and hero must hold up when
  the window is resized smaller (down to the shell's minimum window size).

## Constraints

- CLAUDE.md rules apply: Zod contracts in `packages/shared` first; typed IPC via
  `window.nextlevel`; atomic writes for files; transactions for multi-row changes; i18n for
  every string (en + pt-BR); files under 400 lines; tests named with FR/US IDs; docs updated in
  the same change (requirements, user stories, data model, screen spec, architecture where IPC
  or the `nextlevel://` scheme grows, CHANGELOG Unreleased).
- The renderer never sees raw disk paths. Images reach `<img>` only through `nextlevel://` URLs
  that main resolves inside a known root (the existing pattern in `packages/shared/src/frontend/urls.ts`
  and `apps/launcher/src/main/protocol/`).
- Library schema changes go in `apps/launcher/src/main/library/schema.ts`, with a committed
  migration (`npm run db:generate -w apps/launcher`).

## Approaches

**Gallery storage** (the one real "how" choice; the owner picked 1):

1. **Copy picked files into the launcher's data folder** (chosen). Robust to the originals
   moving. Costs disk space. (Nothing in the launcher backs up `<dataDir>` or `library.db`
   today; backup stays out of scope, see Non-goals.)
2. Keep links to the original files. No copying, but images silently break when a file or
   drive letter changes.
3. Web image URLs through the existing remote-image cache. Can't hold the owner's own photos
   or scans.

**Emulators section** (owner's choice): show what is actually set up, derived from
`settings.emulators` + emulator profiles whose `systems` include the system id. The rejected
alternative was a separate hand-maintained list in the Museum. Its free-text value (e.g.
"avoid X") is covered by Notes.

**Notes storage** (my call): a separate per-system record, not a field on `SystemInfoSchema`.
A field on the entry would be wiped by Reset (`SystemInfoRepository.reset` deletes the whole
edited row). It would also make a note-only edit mark the entry as "edited" and freeze it
against future seed updates.

## Design

### Data

New per-system "personal" record, separate from the museum entry:

- Shared schema (`packages/shared/src/systems/personal.ts`, my naming):
  - `SystemGalleryImageSchema`: `{ file: string (generated file name, no path separators),
    caption?: string (trimmed, ≤ 200) }`
  - `SystemPersonalSchema`: `{ systemId, notes?: string (trimmed, ≤ 20000), gallery:
    SystemGalleryImage[] (≤ 50, default []) }`
- Library table `system_personal (system_id PK, data TEXT JSON, updated_at)`, the same shape as
  `system_info`. A missing row reads as empty notes and an empty gallery.
- `SystemInfoSummarySchema` gains `hasNotes: boolean` and `changedAt: string | null` (the later
  of `system_info.updated_at` and `system_personal.updated_at`) for the Home rows.
- Two meanings, kept apart on purpose (my call). **"Edited"** (the existing `edited` flag, the
  blue dot, the "edited" count) means the museum entry differs from the shipped one, i.e. a
  `system_info` row exists, as today. **"Changed"** means anything the owner touched, entry or
  notes/gallery: it drives `changedAt`, the Home row, now called **"Recently changed"**, and the
  featured system. The Home counts show "edited" and "with notes", both well defined.

### Image files

- Folder: `<dataDir>/museum/<systemId>/`. File name: `<uuid>.<ext>`, with the extension
  lowercased from the original.
- Accepted: `png, jpg, jpeg, webp, gif`. Max 20 MB per file (my call). Rejected files return a
  typed error, shown inline.
- Adding: renderer calls `systems.personal.addImages({ systemId })`. Main opens a multi-select
  file dialog (image filter), copies each file in (temp name + rename, using the atomic-write
  helper if it supports streams/binary, else copy-to-temp + rename), and returns the new
  `SystemGalleryImage[]` (file names only). The e2e override follows the existing
  `NEXTLEVEL_E2E_PICK_FILE` pattern.
- Serving: new `nextlevel://museum-image/<systemId>/<file>` kind in `urls.ts`. Main resolves it
  only inside `<dataDir>/museum/<systemId>/`, validating both segments (system id regex,
  generated-file-name regex, no `..`).
- Cleanup (my call): main deletes files in a system's folder that its **stored** gallery doesn't
  reference: (a) after `systems.personal.save`, and (b) on
  `systems.personal.cleanup({ systemId })`, which the renderer calls when an edit is
  discarded (Discard button, or confirming discard on switching system / going Home). So
  images added and then discarded don't pile up. If cleanup fails, the error is logged and
  ignored; it never blocks the UI.

### Editing flow

- One Edit mode covers the entry **and** the personal record. Save validates both, then writes
  the entry (only if it changed: a notes-only change must not create a `system_info` row) and
  the personal record. Discard reverts both drafts.
- Reset restores the shipped entry only. Its confirm text says notes and images are kept.
- "Unsaved changes" (the existing dirty check that guards switching systems) covers both
  drafts, and also covers going to Home.

### IPC (added to `systemInfoContract` or a sibling contract)

- `systems.personal.get({ systemId })` → `SystemPersonal`
- `systems.personal.save({ systemId, personal })` → `SystemPersonal`. Also runs the cleanup and
  emits `systems.infoChanged` so the list/Home refresh.
- `systems.personal.addImages({ systemId })` → `SystemGalleryImage[]` (empty if cancelled)
- `systems.personal.cleanup({ systemId })` → void (see Image files)
- The emulator list needs no new IPC: the renderer already reads settings (`useSettings()`).
  Profiles whose `systems` include the id, grouped by `emulatorId` → emulator name + version,
  profile names under it. If none: an empty state with a hint pointing to Settings → Emulators.

### Layout

```
┌──────────────────────┬──────────────────────────────────────────────┐
│ [⌂] Home             │  ┌──── hardware image (hero) ─────────────┐   │
│ [search          ]   │  │                                        │   │
│ [All types     ▾]    │  │ Acorn BBC Micro                        │   │
│ ───────────────────  │  │ Acorn Computers Ltd. · 1981     [Edit] │   │
│ (▣) AAE              │  └────────────────────────────────────────┘   │
│ (▣) Aamber Pegasus   │  Notes · Emulators · Overview · Story ·       │
│ ((▣) Acorn BBC Micro)│  Hardware · Models · Gallery · Related ·      │
│ (▣) Acorn Electron   │  Top games · Sources   (scrolls)              │
│  …                   ├──────────────────────────────────────────────┤
│                      │ [Save] [Discard]                     [Reset] │ ← edit mode only
└──────────────────────┴──────────────────────────────────────────────┘
```

- **Left menu:** the Home item with an icon, then search and the type filter, then systems.
  Each system row has a small hardware thumbnail (`loading="lazy"`, placeholder icon on error).
  The selected item gets a filled, rounded pill like the Claro "Assistir TV" item, and the Home
  item gets the same pill when Home is shown. The edited dot stays.
- **System page:** the article becomes a flex column. The hero is fixed at the top and does not
  scroll (my call). The middle scrolls. In edit mode the action bar is a non-scrolling footer.
  The hero shows the hardware image (`object-contain` over a dark gradient, max height about
  40% of the pane), the name, `manufacturer · year`, and the Edit button. A missing image or
  unset `assetsPath` shows a neutral placeholder with the system initial.
- **Hardware image source:** `assets` art root, `art/hardware/<system display name>.png`, using
  the same path helper themes use (`hardwarePaths` in `packages/themes/src/engine/themeArt.ts`;
  copy or move the helper into `packages/shared` if the launcher can't import it). It goes
  through the existing `nextlevel://` art URL. Themes key on the menu node name, but the
  Museum lists every system, including ones in no menu, so it keys on the system's display
  name (`SystemInfoSummary.name`). Checked against the owner's folder on 2026-11-16: 276 of 447
  catalog system names have a file. The rest (e.g. Arduboy, Chip8) have no image and show the
  placeholder. No menu-node fallback (my call: keeps the Museum independent of menus).
- **Section order (my call):** Notes and Emulators first, because they're what the owner uses
  while playing. Then Overview, Story, Hardware, Models, Gallery, Related, Top games, Sources.
  In read mode, empty Notes and Gallery show a one-line empty state.
- **Gallery read mode:** a grid of thumbnails with captions. Clicking one opens a simple viewer
  with the existing modal pattern: large image, caption, previous/next, Esc to close. **Edit
  mode:** "Add images" button, then rows with thumbnail, caption input, and the existing
  move-up/down/remove `RowControls`.
- **Home:** the hero shows a featured system, the most recently changed one (`changedAt`); if
  none, the first system alphabetically. Below it, a "Recently changed" card row (up to 12, by
  `changedAt` desc) and a "Has notes" card row. Each
  card shows the hardware image + name, and clicking it opens that system. A line of counts:
  systems, edited, with notes. Rows with no items are hidden. Home is the default view when
  the app opens (no system selected).
- **Visual style:** keep the current dark palette and Tailwind. Make the pill and active states
  bolder, use larger type for the hero name, and use rounded cards for Home. No new UI library.

## What's left to the builder

- Exact component split (keep files < 400 lines; `EntryView.tsx` and `EntryForm.tsx` will need
  splitting).
- Whether personal IPC lives in `systemInfoContract.ts` or a new contract file.
- Thumbnail sizes, spacing, and exact colors within the existing palette.
- Test layout, following the existing `MuseumApp.test.tsx` / `EntryForm.test.tsx` patterns, with
  FR-MUS-6…9 / US-G3 in test names.

## Requirements to add (docs/01-product)

- **FR-MUS-6** Each system has personal notes, edited in the Museum app and stored apart from
  the museum entry. Reset never clears them.
- **FR-MUS-7** The Museum shows the emulators set up to launch a system: every emulator profile
  that lists it, grouped by emulator. Read-only.
- **FR-MUS-8** A system page shows its hardware image from the menu art folder, and a gallery
  of images the owner adds. Added images are copied into the launcher's data folder and can be
  captioned, ordered and removed.
- **FR-MUS-9** The Museum window has a left menu with Home first, a hero header per system, a
  Home page (featured system, recently changed, has notes), and edit actions in a bar pinned to
  the bottom of the window.
- **US-G3** "Keep my own emulation notes and pictures for a system": FR-MUS-6…9.
