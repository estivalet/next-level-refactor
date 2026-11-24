# Library cleanup: file names, Duplicates and Delete later — design

Status: draft for owner approval · 2026-11-24 · proposed FR-LIB-19, US-C13

## Why

The owner's ROM folders are a mess in places, e.g. `Sega Game Gear\! Translated` holds several
translations of *Coca-Cola Kid*. They want to go through each system, find games that exist in
several versions, try them, decide which one to keep, and delete the rest **by hand in Explorer**.
Today the Library can't help: scraped titles make every version look the same ("Coca-Cola Kid" ×3)
and the file name is shown nowhere, and nothing points out where the duplicates are.

## Goals

1. See which file each game is, in the list view, without cluttering it.
2. In any system, narrow the list to games that have more than one version.
3. Mark a game **Delete later** and get a to-do list of those marks.

## Non-goals / anti-goals

- **The launcher never deletes, moves or renames ROM files.** No "delete" button, no bulk delete.
  The owner deletes in Explorer (via the existing **Open folder**); the next scan flags the game
  Missing and the existing Missing → Remove clears it. Any file deletion would make this a failure.
- No automatic "best version" pick, no hashing or ROM-set (No-Intro/DAT) checking.
- No separate Duplicates screen with groups (approach C, rejected).

## Approaches

- **A. Path line + Delete later mark.** Smallest, but in a 1,000-game system the owner still reads
  every row to find duplicates.
- **B. A + a Duplicates sidebar entry. (Chosen.)** The filter does the finding; everything else
  reuses the list, sort by title, Open folder and Missing → Remove the owner already uses.
- **C. A dedicated Duplicates screen with Keep/Delete groups.** Once the path is visible it mostly
  repeats the sorted list, and costs the most.

Owner picked B (2026-11-24) as the fit for "explore each system, delete one by one".

## Design

**1. File line in the list view.** Each row gets a second, smaller muted line with the game's path
inside its system folder (`rel_path`, e.g. `! Translated\Coca-Cola Kid [T-En by A].gg`).
`relPath` moves from `GameDetails` up to `GameRow` so the list has it. List view only; the grid is
untouched — grid users already see the full path with Copy path / Open folder in the details panel
(FR-LIB-16, `GameFileLocation`).

**2. Duplicates tab.** A new entry in the sidebar's tab block — Hidden, Missing, Needs review,
**Duplicates**, **Delete later** — with a count, like the others (new `GameTab` values
`duplicates` and `deleteLater`). A game is listed when, in the **same system**, at least one other
game that is not missing, not hidden and not collection-only matches it by either:
- the same title (case-insensitive, trimmed), or
- the same *file name key*: the file name without extension, with every `(…)` and `[…]` tag removed,
  then lower-cased with spaces collapsed — `Coca-Cola Kid (Japan) [T-En by A]` → `coca-cola kid`.

*My calls:* Duplicates is a system-scope tab: in a collection or smart filter (which can span
systems) it is not shown. The match looks across the whole system, while the list still shows only what the
current scope/filter shows (so in **Translated**, a translation whose twin is the Japanese original
in the root folder still appears). Missing and hidden games are neither listed nor counted as
twins, so deleting a file shrinks the set after the next scan. The list keeps the user's sort;
sorted by title, versions sit together. The file-name key is a SQLite function `name_key(rel_path)`
registered on the library connection (like smart filters' `max_players`), so no stored column can
drift out of date.

**3. Delete later mark.** A new boolean on `game_user_state` (`delete_later`, default false,
migration via `db:generate`), a `GameFlags.deleteLater`, and a **Delete later** toggle in the
details panel next to Favorite / Completed. Works with multi-selection the same way the existing
flags do. Rows marked Delete later show a small trash icon in the list.
The **Delete later** tab lists marked games that are **not missing** (it's a to-do list: once the
file is gone the game moves to Missing). *My call:* it includes hidden games, so hiding a game
never makes it drop off the to-do list. The mark changes nothing else — the game still launches,
shows in themes and menus.

**Strings** go through i18n (`en.json`, `pt-BR.json`).

## Docs to update in the same change

New FR-LIB-19 in the product requirements and US-C13 in the user stories; data model
(`game_user_state.delete_later`, file-name key if stored); API spec (IPC `GameTab`, `GameFlags`);
screen specification (sidebar tab order, list row, details panel); roadmap; `CHANGELOG.md`.

## Left to the builder

File-name key storage and indexing; exact icon choice (lucide); how the new tabs plug into
`tabCountsSql` and `leavesTab`; tests named with FR-LIB-19 / US-C13.
