# Remove Missing Games Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this
> plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** the game menu offers **Remove from library…** when every selected game is missing; after
a confirmation those games' rows are deleted (FR-LIB-14, US-C7).

**Owner decision 2026-11-09:** missing games only. A present game would come back on the next scan,
and Hide already keeps one out of lists. Relink (FR-LIB-3) stays the way to keep history when a
file was replaced.

**Architecture:**
- Every table that points at `games` cascades on delete (`foreign_keys = ON`), and the FTS
  triggers fire on the cascaded `game_metadata` delete, so deleting `games` rows is the whole job.
  `launch_log.game_id` is set to null (history rows stay, like a relink).
- `GameRepository.ts` is already over 400 lines: the write lives in a new `library/missingGames.ts`
  (`removeMissingGames(client, ids)`), and `GameRepository.removeMissing` delegates to it.
- Main re-checks `missing = 1` in the delete itself: the renderer only decides whether to show the
  item, never what may be deleted.
- Media files and the ROM folder are not touched (only `game_media` rows go).

## Global constraints

- Contract first: `library.games.remove` in `packages/shared/src/ipc/contract.ts`.
- One transaction; the systems for `library.changed` are read before the delete.
- `menus.changed` is emitted too: a collection that became empty leaves the generated menu.
- Strings in `en.json` and `pt-BR.json`.

## Tasks

- [x] **1. Repository (TDD).** `GameRepository.write.test.ts`, `describe('GameRepository.removeMissing')`:
  - `FR-LIB-14: removes missing games with their state, metadata, search entry and memberships`
  - `FR-LIB-14: never removes a present game and ignores unknown ids`
  - `FR-LIB-14: a removed game stays gone after a rescan without its file`
  Returns `{ removed: number[]; systems: string[] }`.
- [x] **2. Contract + handler (TDD).** `'library.games.remove': { input: { gameIds }, output: { removed: number } }`;
  handler emits `library.changed` with the removed ids and `menus.changed`. Test in
  `handlers.library.test.ts` plus the `LIBRARY_UNAVAILABLE` channel list.
- [x] **3. Renderer.** `useRemoveGames` in `libraryApi.ts`; `RemoveGamesDialog.tsx` (Modal, count
  and the first title, "files on disk aren't touched"); `GameContextMenu` gets an `onRemove` prop and
  shows the item (Trash2) only when every selected row is loaded and missing; `LibraryOverlays` holds
  the dialog state. Component test: item shown for missing only; confirm calls the channel.
- [x] **4. Docs.** api-spec (channel), screen spec S7 menu, CHANGELOG Unreleased, roadmap note if
  the roadmap lists post-M10 requests.
- [x] **5. Verify.** `npm run lint`, `npm run typecheck`, `npm test`.
