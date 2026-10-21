# M2c Game Library Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A Game Library app on the desktop: a virtualized system tree and game list, a details
panel, missing games greyed with their expected path, global search over all systems (FTS5), metadata
editing with locked fields, favorite / hidden / rating, collections, and Scan ▾ on the existing scan
IPC. Completes M2 (release v0.2.0 afterwards).

**Architecture:**
- `library.db` gains the user-state, filters and collection tables plus an FTS5 index over titles
  kept in sync by triggers (new migrations; one is a hand-written Drizzle Kit `--custom` migration).
- Main gets two repositories next to the scan's `LibraryRepository`: `GameRepository` (list, get,
  search, metadata, flags, relink) and `CollectionRepository`. Handlers live in a new
  `libraryHandlers.ts`; mutations emit `library.changed`.
- The renderer gets `features/library/` hooks over TanStack Query. The game list fetches pages of
  200 rows only for the range the virtualizer shows, so opening a 10k-game system costs one page.
- UI follows the current NextLevelOS Game Library look (owner decision): read-only reference
  `../NextLevelOS/src/apps/GameLibrary.tsx` @ 3d530b7 for styling only, not structure.

**Tech Stack:** Existing stack (React 19, TanStack Query + Virtual, Tailwind 4, lucide, better-sqlite3
13 with FTS5, Drizzle). No new dependencies.

**Spec:**
- FR-LIB-6, FR-LIB-7 (favorite / hidden / user rating; play count and last played are only stored
  here, M3 records them), FR-LIB-8, FR-LIB-10, NFR-PERF-2, NFR-PERF-3, NFR-REL-1; US-C3, US-C4.
- Screen spec S7 Library (S11 Collections stays a separate app for M5; M2c manages collections
  inside the Library).
- Data model §4 (tables `game_filters`, `game_user_state`, `collections`, `collection_games`,
  `games_fts`); API spec §3 Library and Collections rows; architecture §4.2 (`LibraryService`, here
  split into repositories); coding standards (lists over 100 items virtualized, files ≤ 400 lines,
  components ≤ 200).
- PR #6 deferred minors that touch this area (Task 3, Task 12).
- **Owner decisions 2026-10-21:**
  - **Renames:** auto + manual. The scan treats a new file and an unmatched row of the same system
    with the same extension, size and mtime, each the only candidate for the other, as a rename
    (counted as `moved`). A missing game also offers **Relink…** to move its row onto a chosen new
    game by hand.
  - **Hidden games are excluded from global search** (US-C4: only the Hidden tab shows them).
  - **Play and Scrape are left out** of the Library until M3 / M6 make them work.

## Global Constraints

- **Branch:** `feat/m2c-game-library`.
- **Look (owner decision):** dark panels `bg-[#111115]`, `border-white/5` dividers, left panel `w-64`,
  right details panel `w-72`, emerald accents (`bg-emerald-500/10 border-emerald-500/20` selected
  row, `text-emerald-300` selected title), inputs `bg-black/40 border-white/10 rounded-lg text-xs`,
  context menu `bg-[#1a1a24] border-white/10 rounded-lg shadow-2xl`, missing rows
  `opacity-40 grayscale`, favorite star `text-amber-400 fill-amber-400`.
- **Library app:** id `library`, `titleKey: 'apps.library.title'` ("Game Library" / "Biblioteca de
  jogos"), icon `Library`, `defaultSize { width: 1200, height: 720 }`, `singleInstance: true`, listed
  before Settings.
- **Tabs:** `all` (everything except hidden; missing included, greyed), `favorites` (favorite and not
  hidden), `hidden`, `missing` (missing and not hidden).
- **Sorts:** system scope `title` (default, `sort_title` then id), `year` (nulls last, then
  `sort_title`), `rating` (`user_rating` desc, nulls last, then `sort_title`), `added` (`added_at`
  desc). Collection scope uses the collection's `sort` (`manual` = position, `title`, `year`).
- **Search:** FTS5 `games_fts(title, content='game_metadata', content_rowid='game_id', tokenize =
  "unicode61 remove_diacritics 2", prefix = '2 3')`. Query text is split on anything that isn't a
  letter or digit; each token becomes `"token"*`, joined by spaces (AND). Fewer than 2 characters
  after trimming → no query. Results exclude hidden games, rank titles starting with the text first,
  then `bm25`, then `sort_title`; default limit 50, max 200, plus `more: boolean`.
- **Locked fields:** an edit adds every field present in `changes` to `locked_fields` (a sorted JSON
  array without duplicates). `title` edits also set `sort_title = title.toLowerCase()`. A scan still
  never changes metadata.
- **Expected path** of a game: `<location.path>/<folderName>/<rel_path>` with the row's location, or
  the first ordered location when that location was removed; `folderName =
  settings.systems[id]?.folderName ?? catalog.defaultFolderName`; joined with `node:path` `join`
  (Windows separators). No location at all → the rel_path. Computed in main, only for missing rows.
- **Errors:** new code `NAME_TAKEN` → `errors.nameTaken` ("That name is already in use." / "Esse
  nome já está em uso."). Unknown game or collection ids → `NOT_FOUND`. Collection names are unique
  ignoring case (`COLLATE NOCASE`), trimmed, 1–100 chars.
- **Events:** `library.changed` becomes `{ systems: string[], gameIds?: number[] }`; every game
  mutation emits it; the renderer invalidates `['library.games']`, `['library.game', id]`,
  `['systems.list']` and search queries on it.
- **i18n:** every string in `en.json` and `pt-BR.json`, plurals with `_one` / `_other`.
- **Tests:** names carry requirement IDs; main tests use `tempLibrary()`; renderer tests use
  `installFakeBridge`. Run `npm run lint` before every push.

## Review Focus

1. **A 10k-game system opens fast and scrolls without loading everything** (NFR-PERF-2): only the
   pages under the viewport are fetched; a scroll to the end fetches the last page, not all of them.
   Pinned in Task 4 (repository bound) and Task 8 (`pagesForRange`, page hook test).
2. **Short or odd search text** (`a`, `"`, `*`, `zelda:`, `ÉCOLE`, emoji): never an FTS syntax
   error; < 2 chars returns nothing; diacritics fold. Pinned in Task 4 (`ftsQuery` cases).
3. **Edits survive later scans and renames**: an edited title stays after a rescan, a rename keeps
   the row (and its edits, favorite and collections), and a relink keeps the missing row's id.
   Pinned in Tasks 3 and 5.
4. **Hiding the selected game, or the last one on a page**: the row leaves the All tab, the selection
   moves to the next row, and the Hidden tab shows it with Unhide. Pinned in Task 10.
5. **Deleting a collection or a game that's in one**: memberships go with it (cascade), counts update,
   and a collection whose games are all missing still lists them greyed. Pinned in Task 6.

---

### Task 1: Contracts: game, search and collection schemas, channels, error code

**Files:**
- Create: `packages/shared/src/library/games.ts` (+ `games.test.ts`), `packages/shared/src/library/collections.ts` (+ `collections.test.ts`)
- Modify: `packages/shared/src/ipc/contract.ts` (+ test), `packages/shared/src/ipc/events.ts` (+ test), `packages/shared/src/errors.ts`, `packages/shared/src/index.ts`, both locale files (`errors.nameTaken`; `errors.conflict` reworded for the rebase: "Settings changed since you opened them. Your unsaved edits were kept on top of the latest version." / pt-BR equivalent — PR #6 minor)
- Docs: `docs/03-architecture/api-spec.md` §3 (exact Library and Collections channels, `NAME_TAKEN`, `library.changed` payload)

**Interfaces (Produces):**
- `GAME_TABS = ['all','favorites','hidden','missing']`, `GAME_SORTS = ['title','year','rating','added']`, `COLLECTION_SORTS = ['manual','title','year']`.
- `GameScopeSchema = z.discriminatedUnion('kind', [{ kind: 'system', systemId: string }, { kind: 'collection', collectionId: int > 0 }])` (strict objects).
- `GameListQuerySchema = z.strictObject({ scope, tab: enum.default('all'), sort: enum(GAME_SORTS).optional(), text: z.string().max(200).optional(), offset: int ≥ 0, limit: int 1..1000 })`.
- `GameRowSchema = { id: int, systemId, title, year: int|null, genre: string|null, players: string|null, favorite: bool, hidden: bool, userRating: int 1..5|null, missing: bool, expectedPath: string|null }`.
- `GameListPageSchema = { total: int ≥ 0, offset: int ≥ 0, games: GameRow[] }`.
- `GameDetailsSchema = GameRowSchema.extend({ relPath, discGroup: string|null, missingSince: string|null, addedAt, developer, publisher, description, region: string|null each, rating: number|null, filters: string[], lockedFields: string[], playCount: int, lastPlayedAt: string|null, collectionIds: int[] })`.
- `EDITABLE_FIELDS = ['title','year','developer','publisher','genre','players','description','region','filters'] as const`.
- `MetadataChangesSchema = z.strictObject({ title: trimmed 1..300, year: int 1950..2100 nullable, developer|publisher|genre|players|region: trimmed ≤ 200 nullable (empty → null), description: ≤ 20000 nullable, filters: array of /^[a-z0-9-]{1,40}$/ max 30 }).partial()` refined to at least one key.
- `GameFlagsSchema = z.strictObject({ favorite: bool, hidden: bool, userRating: int 1..5 nullable }).partial()` refined non-empty.
- `SearchResultSchema = { games: GameRow[], more: boolean }`.
- `CollectionSummarySchema = { id: int, name: string, sort: enum(COLLECTION_SORTS), games: int ≥ 0 }`; `CollectionNameSchema = z.string().trim().min(1).max(100)`.
- Contract (all object inputs strict; `gameIds` = `z.array(int > 0).min(1).max(10000)`):
  - `'library.games.list': GameListQuery → GameListPage`
  - `'library.games.get': { gameId } → GameDetails`
  - `'library.games.updateMetadata': { gameId, changes: MetadataChanges } → GameDetails`
  - `'library.games.setFlags': { gameIds, flags: GameFlags } → void`
  - `'library.games.relink': { missingGameId, replacementGameId } → GameDetails`
  - `'library.games.reveal': { gameId } → void`
  - `'library.search': { text: z.string().max(200), limit?: int 1..200 } → SearchResult`
  - `'collections.list': void → CollectionSummary[]`
  - `'collections.create': { name } → CollectionSummary`
  - `'collections.update': { id, name?, sort? } → CollectionSummary`
  - `'collections.delete': { id } → void`
  - `'collections.addGames' | 'collections.removeGames': { id, gameIds } → CollectionSummary`
  - `'collections.reorder': { id, gameId, position: int ≥ 0 } → void` (moves one member; position clamped to the end)
- `ipcEvents['library.changed'] = z.object({ systems: z.array(z.string()), gameIds: z.array(int).optional() })`.
- `ERROR_CODES.NAME_TAKEN = 'errors.nameTaken'`.

- [ ] **Step 1: Write the failing tests:**
  - `'FR-LIB-6: metadata changes trim, null out empty text and reject an empty change'`: `{ developer: '  ' }` → `null`; `{ title: '' }` fails; `{}` fails; `{ filters: ['Hack'] }` fails; `{ year: 1949 }` fails.
  - `'FR-LIB-7: flags need at least one field and ratings stay 1..5'`: `{}` fails, `{ userRating: 6 }` fails, `{ userRating: null }` parses.
  - `'FR-LIB-6: a game list query defaults to the All tab and caps the page'`: `limit: 1001` fails; tab defaults to `'all'`; an unknown scope kind fails.
  - `'FR-LIB-8: collection names are trimmed and 1..100 chars'`.
  - `'FR-LIB-10: library.changed may name the games it touched'`.
- [ ] **Step 2:** Run `npx vitest run packages/shared`. Expected: FAIL (modules missing).
- [ ] **Step 3: Implement** the schemas, contract entries, event, error code and strings.
- [ ] **Step 4:** Run `npx vitest run packages/shared` and `npm run typecheck`. Expected: shared PASS; typecheck FAILS only where the router requires handlers for the new channels — wrap them with the existing `withUnimplemented` helper in `handlers.ts` until Task 7, then typecheck passes.
- [ ] **Step 5:** Update api-spec §3.
- [ ] **Step 6: Commit:** `feat(shared): game list, search, metadata and collection contracts (FR-LIB-6..8, FR-LIB-10)`.

### Task 2: Schema: user state, filters, collections, FTS5

**Files:**
- Modify: `apps/launcher/src/main/library/schema.ts` (+ drop the redundant `games_system` index — PR #6 minor)
- Create: generated `migrations/0001_*.sql`; custom `migrations/0002_games_fts.sql` via `npx drizzle-kit generate --custom --name games_fts` (run in `apps/launcher`)
- Test: `apps/launcher/src/main/library/migrate.test.ts`, new `schema.test.ts`

**Interfaces (Produces):** Drizzle tables exactly as data model §4:
- `gameUserState`: `game_id` PK FK cascade, `favorite` bool default 0, `hidden` bool default 0, `user_rating` int null, `play_count` int default 0, `last_played_at` text null, `play_seconds` int default 0. Index `game_user_state_hidden` on `hidden`.
- `gameFilters`: `game_id` FK cascade, `filter` text; PK(`game_id`,`filter`).
- `collections`: `id` PK autoincrement, `name` NOCASE text UNIQUE, `sort` text enum default `'manual'`, `created_at` text.
- `collectionGames`: `collection_id` FK cascade, `game_id` FK cascade, `position` int; PK(`collection_id`,`game_id`); index (`collection_id`,`position`).
- Index `game_metadata_sort_title` on `sort_title`.
- `0002_games_fts.sql`: the FTS table from Global Constraints, triggers `game_metadata_ai`, `game_metadata_ad`, `game_metadata_au` (after update **of title**; delete-then-insert form for external content), and `insert into games_fts(games_fts) values('rebuild')` to index existing rows. Separate statements with `--> statement-breakpoint`; trigger bodies stay in one statement.

- [ ] **Step 1: Write the failing tests:**
  - `'FR-LIB-10: titles are indexed for search on insert, update and delete'`: insert a game via `applySystemDiff`, match it in `games_fts`; update the title in `game_metadata`, old text no longer matches and new does; deleting the `games` row (cascade) removes it.
  - `'NFR-REL-1: migrating a v1 library indexes its existing games'`: open with only migration 1, add a game, close, reopen with all → `schema_version` 3, a backup exists, the game matches in FTS.
  - `'FR-LIB-8: collection names are unique ignoring case and memberships cascade'`.
- [ ] **Step 2:** Run `npx vitest run apps/launcher/src/main/library`. Expected: FAIL.
- [ ] **Step 3:** Edit `schema.ts`, run `npm run db:generate -w apps/launcher`, check the SQL (NOCASE, cascades, index drop), then generate and write the custom FTS migration.
- [ ] **Step 4:** Run the library tests and `npm run typecheck`. Expected: PASS.
- [ ] **Step 5: Commit:** `feat(launcher): library tables for user state, filters, collections and FTS5 search (FR-LIB-7, FR-LIB-8, FR-LIB-10)`.

### Task 3: Rename detection and scan minors

**Files:**
- Modify: `apps/launcher/src/main/scan/diff.ts` (+ test), `scan/walk.ts` (+ test), `scan/workerWalker.ts`, `ipc/events.ts` (+ test)

**Interfaces:** `diffSystem` keeps its signature. `walkSystem(job, log?)` gains an optional `log: { warn(context: object, msg: string): void }`; the worker passes one that posts warnings back, and `workerWalker` forwards them to the main log.

- [ ] **Step 1: Write the failing tests:**
  - `'FR-LIB-3: a renamed file with the same extension, size and mtime keeps its id'`: existing `Game.zip` (size 10, mtime 5) not found, found `Game (USA).zip` (10, 5) → `moved`, nothing added or missing.
  - `'FR-LIB-3: a rename is not guessed when two files share size and mtime'` → both added, row missing.
  - `'FR-LIB-3: a rename to another extension is not a rename'` (`Game.zip` → `Game.7z`).
  - `'FR-LIB-3: an already missing row is restored by its renamed file'` → `moved` + `restored`.
  - `'FR-LIB-3: unreadable folders are logged, absent ones are not'`: a `readdir` error other than `ENOENT` calls `log.warn` once with the dir; a missing folder does not.
  - `'FR-LIB-3: the event sink keeps sending when one window fails'`: first target throws, second still receives, error logged.
- [ ] **Step 2:** Run `npx vitest run apps/launcher/src/main/scan apps/launcher/src/main/ipc`. Expected: FAIL.
- [ ] **Step 3: Implement.** In `diffSystem`, a second pass after the basename+size pass over what is still unmatched, keyed `ext|size|mtime` with the same "only candidate on both sides" rule. `workerWalker`'s exit handler ignores exits of a worker other than the current one (`worker === created`).
- [ ] **Step 4:** Run the tests. Expected: PASS.
- [ ] **Step 5: Commit:** `feat(launcher): detect renamed games in a scan; log unreadable folders (FR-LIB-3)`.

### Task 4: GameRepository read side: list, get, search

**Files:**
- Create in `apps/launcher/src/main/library/`: `ftsQuery.ts` (+ test), `expectedPath.ts` (+ test), `GameRepository.ts` (+ `GameRepository.test.ts`, `GameRepository.perf.test.ts`)
- Modify: `testing.ts` (`seedGames(db, systemId, count, opts?)`: bulk insert games + metadata in one transaction through prepared statements, titles from a fixed word list so searches have known hit counts)

**Interfaces (Produces):**
- `ftsQuery(text: string): string | null`.
- `expectedGamePath(input: { settings: Settings; system: SystemDefinition | undefined; systemId: string; locationId: string | null; relPath: string }): string`.
- `class GameRepository { constructor(db: LibraryDb, resolvePath: (row: { systemId: string; locationId: string | null; relPath: string }) => string) }`
  - `list(query: GameListQuery): GameListPage` — `NOT_FOUND` for an unknown collection.
  - `get(gameId: number): GameDetails` — `NOT_FOUND` when absent.
  - `search(text: string, limit = 50): SearchResult`.
  - `systemOf(gameIds: number[]): string[]` (distinct, for events).
- Read SQL joins `games` ⟕ `game_metadata` ⟕ `game_user_state` (absent state = not favorite, not hidden); `text` in `list` is the same FTS match restricted to the scope.

- [ ] **Step 1: Write the failing tests:**
  - `ftsQuery`: `'FR-LIB-10: search text becomes safe prefix tokens'` — `'zelda'` → `'"zelda"*'`; `'super  mario'` → `'"super"* "mario"*'`; `'a'`, `' '`, `'"'`, `'*'`, `'🎮'` → `null`; `'zelda:'` → `'"zelda"*'`; `'école'` stays one token.
  - `expectedGamePath`: own location; removed location → first ordered location; folder override; no locations → rel_path.
  - `'FR-LIB-7: the All tab hides hidden games; Hidden and Favorites tabs filter'`.
  - `'FR-LIB-4: missing games are listed with their expected path'`; present rows have `expectedPath: null`.
  - `'FR-LIB-6: lists sort by title, year (nulls last), rating and added'`.
  - `'FR-LIB-6: in-list text filters within the system only'`.
  - `'FR-LIB-10: search spans systems, ranks title prefixes first and skips hidden games'` (US-C3): `Zelda II` and `The Legend of Zelda` in two systems plus a hidden `Zelda Hidden` → prefix match first, hidden absent, `more` false.
  - `'FR-LIB-10: diacritics fold'`: `École` found by `ecole`.
  - Perf (`GameRepository.perf.test.ts`, `seedGames`): `'NFR-PERF-2: the first page of a 10k-game system loads in ≤ 300 ms'` and `'NFR-PERF-3: search over 200k games answers in ≤ 150 ms'` (3 queries — a 2-letter prefix, a word, two words — after one warm-up; assert the slowest). Setup timeout 60 s.
- [ ] **Step 2:** Run `npx vitest run apps/launcher/src/main/library`. Expected: FAIL.
- [ ] **Step 3: Implement** with statements prepared once (as `LibraryRepository` does). Search: `select … from games_fts join … where games_fts match ? and coalesce(hidden,0) = 0 order by (game_metadata.sort_title like ? escape '\') desc, bm25(games_fts), sort_title limit ?+1`, with the LIKE pattern built from the lowercased text with `%`/`_`/`\` escaped.
- [ ] **Step 4:** Run the tests, `npm run typecheck`, `npm run lint`. Expected: PASS. If the 200k bound fails, profile before loosening anything; the NFR is the bound.
- [ ] **Step 5: Commit:** `feat(launcher): game list, details and FTS5 global search (FR-LIB-6, FR-LIB-10, NFR-PERF-2, NFR-PERF-3)`.

### Task 5: GameRepository write side: metadata, flags, relink

**Files:**
- Modify: `apps/launcher/src/main/library/GameRepository.ts`; create `GameRepository.write.test.ts`. If the file passes 400 lines, move writes to `GameWrites.ts` and keep `GameRepository` as the façade.

**Interfaces (Produces):**
- `updateMetadata(gameId: number, changes: MetadataChanges, now: Date): GameDetails` — one transaction: update columns, replace `game_filters` when `filters` present, merge `locked_fields`, set `updated_at`.
- `setFlags(gameIds: number[], flags: GameFlags): void` — upsert `game_user_state` per id in one transaction; unknown ids → `NOT_FOUND` and nothing written.
- `relink(missingGameId: number, replacementGameId: number): GameDetails` — both in the same system, the first missing, the second not → else `VALIDATION_FAILED` with `details.reason` (`'notMissing' | 'replacementMissing' | 'otherSystem' | 'same'`). One transaction: read the replacement's file fields, delete the replacement row (cascade), give the missing row its `rel_path`, `location_id`, `size`, `mtime`, `disc_group`, set `missing = 0`, `missing_since = null`. The missing row keeps its id, metadata, flags and collections.

- [ ] **Step 1: Write the failing tests:**
  - `'FR-LIB-6: editing metadata locks the edited fields and a rescan keeps them'`: edit title + genre → `lockedFields` `['genre','title']`, `sort_title` updated, FTS finds the new title; then `applySystemDiff` with the game present → title unchanged.
  - `'FR-LIB-6: filters are replaced as a set'`.
  - `'FR-LIB-7: favorite, hidden and rating persist and can be cleared'` (US-C4): set favorite + rating 4 on two ids, clear rating with `null`, reopen the DB → values survive.
  - `'FR-LIB-7: flags on an unknown game write nothing'`.
  - `'FR-LIB-3: relink moves a missing game onto its new file and keeps its id and edits'`: missing `Game.zip` with an edited title and favorite, present `Game (USA).zip` → result has the missing row's id, the new rel_path, `missing: false`, the edited title, favorite; the replacement row is gone; a following diff of the system finds it present (no added, no missing).
  - `'FR-LIB-3: relink refuses a present game, a missing replacement and another system'`.
- [ ] **Step 2:** Run `npx vitest run apps/launcher/src/main/library`. Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4:** Run the tests, typecheck, lint. Expected: PASS.
- [ ] **Step 5: Commit:** `feat(launcher): edit metadata with locked fields, game flags and relink (FR-LIB-3, FR-LIB-6, FR-LIB-7)`.

### Task 6: CollectionRepository

**Files:**
- Create: `apps/launcher/src/main/library/CollectionRepository.ts` (+ test)
- Modify: `GameRepository.list` collection scope ordering per the collection's `sort`.

**Interfaces (Produces):** `class CollectionRepository { constructor(db: LibraryDb, clock: () => Date) }` with `list(): CollectionSummary[]` (by name, case-insensitive), `create(name)`, `update(id, { name?, sort? })`, `delete(id)`, `addGames(id, gameIds)` (appends after the max position, skips members, unknown game → `NOT_FOUND`), `removeGames(id, gameIds)` (then renumbers positions 0..n-1), `reorder(id, gameId, position)` (moves one member and renumbers 0..n-1; a non-member → `NOT_FOUND`), `membership(gameId): number[]`. Duplicate names → `NAME_TAKEN`; unknown id → `NOT_FOUND`. Every multi-row change is one transaction.

- [ ] **Step 1: Write the failing tests:**
  - `'FR-LIB-8: create, rename and delete a collection; names are unique ignoring case'`.
  - `'FR-LIB-8: games from any system are added in order and listed by position'`: add games of two systems, list with collection scope + manual sort.
  - `'FR-LIB-8: a collection orders manually, by title or by year'`: reorder, then `update({ sort: 'year' })`.
  - `'FR-LIB-8: moving a member renumbers positions; a non-member is NOT_FOUND'`.
  - `'FR-LIB-8: deleting a collection or a game removes the memberships'` (Review Focus 5): counts update; a collection with only missing games lists them with `missing: true`.
- [ ] **Step 2:** Run `npx vitest run apps/launcher/src/main/library`. Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4:** Run the tests, typecheck, lint. Expected: PASS.
- [ ] **Step 5: Commit:** `feat(launcher): collections repository (FR-LIB-8)`.

### Task 7: Wiring: library handlers, reveal, events

**Files:**
- Create: `apps/launcher/src/main/libraryHandlers.ts` (+ `libraryHandlers.test.ts`)
- Modify: `apps/launcher/src/main/handlers.ts` (spread `createLibraryHandlers(deps)`; remove the Task 1 placeholders), `apps/launcher/src/main/index.ts`

**Interfaces:**
- `MainDeps.library` becomes `{ repo; scan; games: GameRepository; collections: CollectionRepository } | null`; `MainDeps` gains `revealFile: (path: string) => void` (`shell.showItemInFolder`), `emit: EmitEvent` and `clock: () => Date`.
- `index.ts` builds `GameRepository` with a `resolvePath` that reads the current settings and catalog through `expectedGamePath`.
- `library.games.reveal`: resolves the path from the library only (never from input); a missing game reveals its expected folder's nearest existing parent, or logs and does nothing.
- After `updateMetadata`, `setFlags`, `relink`: emit `library.changed` with `systems: repo.systemOf(ids)` and `gameIds`.

- [ ] **Step 1: Write the failing tests:**
  - `'FR-LIB-6: library channels fail with LIBRARY_UNAVAILABLE when the library could not open'` (every new channel).
  - `'FR-LIB-7: setFlags emits library.changed with the systems and games'`.
  - `'FR-LIB-6: reveal opens the stored file, never a path from the renderer'`.
- [ ] **Step 2:** Run `npx vitest run apps/launcher/src/main`. Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4:** Run `npm test`, typecheck, lint. Expected: PASS.
- [ ] **Step 5: Commit:** `feat(launcher): wire library and collection IPC (FR-LIB-6..8, FR-LIB-10)`.

### Task 8: Renderer data layer

**Files:**
- Create in `apps/launcher/src/renderer/features/library/`: `libraryApi.ts`, `collectionsApi.ts`, `pages.ts` (+ test), `usePagedGames.ts` (+ test), `buildTree.ts` (+ test), `selection.ts` (+ test)

**Interfaces (Produces):**
- `PAGE_SIZE = 200`; `pagesForRange(first: number, last: number, pageSize = PAGE_SIZE): number[]`.
- `usePagedGames(query: Omit<GameListQuery, 'offset' | 'limit'>, range: { first: number; last: number }): { total: number | null; rowAt(index: number): GameRow | undefined; isError: boolean; error: unknown }` — `useQueries` over `['library.games', query, page]`; page 0 always loaded.
- `useGameDetails(id: number | null)`, `useGlobalSearch(text: string)` (debounced 120 ms, disabled under 2 chars), `useUpdateMetadata()`, `useSetFlags()`, `useRelink()`, `useRevealGame()`; `useLibraryEvents()` invalidates on `library.changed` and `scan.finished`.
- `useCollections()`, `useCreateCollection()`, `useUpdateCollection()`, `useDeleteCollection()`, `useAddToCollection()`, `useRemoveFromCollection()`, `useReorderCollection()` — each invalidates `['collections.list']` and `['library.games']`.
- `type TreeRow = { kind: 'group'; key: string; label: string; expanded: boolean } | { kind: 'system'; systemId: string; label: string; games: number; missing: number } | { kind: 'collectionsHeader' } | { kind: 'collection'; collection: CollectionSummary }`.
- `buildTree(systems: SystemSummary[], catalog: SystemDefinition[], collections: CollectionSummary[], collapsed: ReadonlySet<string>): TreeRow[]` — systems with `games > 0` grouped by `manufacturer` (missing → `"Other"` group, last), groups and systems sorted by name; the collections header and collections follow.
- `selection.ts`: `type Selection = { anchor: number | null; ids: ReadonlySet<number> }`; `select(sel, id, index, mode: 'single' | 'toggle' | 'range', idAt: (i: number) => number | undefined): Selection`.

- [ ] **Step 1: Write the failing tests:**
  - `'NFR-PERF-2: only the pages under the viewport are requested'`: `pagesForRange(0, 30)` → `[0]`; `(195, 210)` → `[0, 1]`; `(9990, 9999)` → `[49]`; then the hook test with a fake bridge: render with range 9 990..9 999 of a 10 000-game total → `library.games.list` calls only for offsets 0 and 9 800.
  - `'FR-LIB-6: the system tree groups systems with games by manufacturer'`: empty systems hidden, collapsed group hides its systems, `Other` last.
  - `'FR-LIB-8: bulk selection supports toggle and shift-range'`.
- [ ] **Step 2:** Run `npx vitest run apps/launcher/src/renderer/features/library`. Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4:** Run the tests, typecheck, lint. Expected: PASS.
- [ ] **Step 5: Commit:** `feat(launcher): library data hooks with paged game lists (FR-LIB-6, NFR-PERF-2)`.

### Task 9: Library app shell: tree, list, status bar

**Files:**
- Create in `features/library/`: `LibraryApp.tsx` (+ test), `SystemTree.tsx`, `GameList.tsx`, `GameRow.tsx`, `LibraryStatusBar.tsx`, `LibraryEmpty.tsx`
- Modify: `apps/launcher/src/renderer/apps/registry.ts` (+ `AppId` `'library'`), both locales (`apps.library.*`, `library.*`)

**Interfaces:** `LibraryApp` owns `{ scope, tab, sort, selection, focusedId }` state. `GameList({ query, selection, onSelect, onOpenMenu })` is a virtualized listbox (`role="listbox"`, `aria-multiselectable`, rows `role="option"` with `aria-selected`, 44 px rows), keyboard: ↑/↓/Home/End/PageUp/PageDown, Shift extends, Ctrl/⌘+click toggles, `ContextMenu` key / Shift+F10 opens the menu. Missing rows are greyed and their `title` attribute is `library.missingAt` with the expected path.

- [ ] **Step 1: Write the failing tests** (`LibraryApp.test.tsx`, fake bridge):
  - `'FR-LIB-6: the Library lists the first system with games and its count'`: tree shows the group + system with count, list shows rows, status bar "3 games · 1 missing".
  - `'FR-LIB-4: a missing game is greyed with its expected path'`.
  - `'FR-LIB-7: the tab filter asks for favorites, hidden or missing'`: switching the filter sends `tab` in the next `library.games.list` call.
  - `'FR-LIB-6: an empty library offers Scan'` and `'FR-LIB-6: an unavailable library offers Open data folder'`.
- [ ] **Step 2:** Run `npx vitest run apps/launcher/src/renderer/features/library`. Expected: FAIL.
- [ ] **Step 3: Implement** in the Global Constraints look.
- [ ] **Step 4:** Run the tests, typecheck, lint. Expected: PASS.
- [ ] **Step 5: Commit:** `feat(launcher): Game Library app with system tree and virtualized list (FR-LIB-6, NFR-PERF-2)`.

### Task 10: Details panel, context menu, flags, edit, relink

**Files:**
- Create in `features/library/`: `GameDetails.tsx` (+ test), `GameContextMenu.tsx`, `EditMetadataDialog.tsx` (+ test), `RelinkDialog.tsx` (+ test), `RatingStars.tsx`

**Interfaces:**
- `GameDetails({ gameId })`: title, system name, year · developer, genre, players, region, filters as chips, description, user rating stars (click same star clears), favorite toggle, **Edit details**, **Open folder**; a missing game shows "Missing since <date>", the expected path and **Relink…**.
- `GameContextMenu({ gameIds, anchor, onClose })` portaled to `document.body` (the window's backdrop-filter breaks `position: fixed`): Edit details (single), Add to collection ▸ (checkbox list + "New collection…"), Favorite / Remove favorite, Hide / Unhide, Open folder (single), Show missing reason (single, missing → opens Relink dialog with the path). Arrow keys move, Esc closes and returns focus to the list.
- `EditMetadataDialog({ gameId, onClose })`: fields per `EDITABLE_FIELDS`, filters as comma-separated slugs, validates with `MetadataChangesSchema`, sends only changed fields, locked fields marked with a lock icon and `library.edit.locked` hint; Save disabled while invalid or unchanged.
- `RelinkDialog({ game, onClose })`: search box filtering present games of the same system (via `library.games.list` with `text`, missing rows dropped), list of candidates, confirm text naming both titles: the chosen game's own details are replaced.

- [ ] **Step 1: Write the failing tests:**
  - `'FR-LIB-7: favoriting from the details panel sends setFlags'` and rating 4 → `{ userRating: 4 }`, clicking 4 again → `null`.
  - `'FR-LIB-7: hiding the selected game moves selection to the next row'` (Review Focus 4): after `setFlags` and `library.changed`, the list refetches without it and the next row is selected.
  - `'FR-LIB-6: Edit details sends only changed fields'`: change title + genre → `changes` has exactly those; an invalid year disables Save with the inline error.
  - `'FR-LIB-3: Relink picks a new game for a missing one'`: candidates exclude missing rows; confirm sends `{ missingGameId, replacementGameId }`.
  - `'FR-LIB-7: bulk hide applies to every selected game'`: two selected → one `setFlags` with both ids.
- [ ] **Step 2:** Run the library renderer tests. Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4:** Run the tests, typecheck, lint. Expected: PASS.
- [ ] **Step 5: Commit:** `feat(launcher): game details, context menu, metadata edit and relink (FR-LIB-3, FR-LIB-6, FR-LIB-7)`.

### Task 11: Collections in the Library

**Files:**
- Create in `features/library/`: `CollectionDialog.tsx` (create/rename, + test), `CollectionToolbar.tsx` (sort select, Rename, Delete with confirm, Move up / Move down for the focused game in manual sort)
- Modify: `SystemTree.tsx` (collections section with **New collection**), `GameContextMenu.tsx` (in a collection scope: Remove from collection)

- [ ] **Step 1: Write the failing tests:**
  - `'FR-LIB-8: creating a collection shows it in the tree; a taken name shows the error inline'` (`NAME_TAKEN`).
  - `'FR-LIB-8: adding selected games to a collection sends their ids'`.
  - `'FR-LIB-8: Move down reorders the manual collection'`: sends `collections.reorder` with `{ id, gameId, position: index + 1 }`; Move up/down are only shown in manual sort.
  - `'FR-LIB-8: deleting a collection asks first and returns to the first system'`.
- [ ] **Step 2:** Run the library renderer tests. Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4:** Run the tests, typecheck, lint. Expected: PASS.
- [ ] **Step 5: Commit:** `feat(launcher): collections in the Game Library (FR-LIB-8)`.

### Task 12: Global search, Scan ▾, scan panel minors

**Files:**
- Create in `features/library/`: `GlobalSearch.tsx` (+ test), `SearchResults.tsx`, `ScanMenu.tsx` (+ test)
- Modify: `scanApi.ts` (`useStartScan` takes optional `systemIds`), `ScanPanel.tsx` (+ test) and `ScanResults.tsx` (PR #6 minors: show `scan.start` errors; per-system lines show the system's total missing from `systems.list`, not only newly missing)

**Interfaces:**
- `GlobalSearch`: input "Search all games…" in the header; ≥ 2 chars replaces the list with `SearchResults` (title + system name, greyed when missing, virtualized); Esc clears and restores the previous scope and selection; selecting a result shows its details.
- `ScanMenu`: **Scan ▾** → "Scan all systems", "Scan <current system>" (when a system is selected); while running, the button shows a progress ring with `systemsDone/systemsTotal` and the menu offers **Cancel scan**; a finished scan shows the summary line (reuse the `settings.storage.scan.*` summary formatter, moved to `scanSummary.ts`); errors from `scan.start` show inline.

- [ ] **Step 1: Write the failing tests:**
  - `'FR-LIB-10: typing in global search shows results from all systems with system names'` (US-C3): typing `zel` → `library.search` called once after the debounce with `zel`; rows show system names; one char sends nothing.
  - `'FR-LIB-3: Scan ▾ scans the current system and shows progress'`: sends `{ systemIds: ['nintendo-64'] }`, emit `scan.progress` → progress label, Cancel calls `scan.cancel`.
  - `'FR-LIB-3: a failed scan.start is shown'` (Library and Settings panel).
  - `'FR-LIB-4: scan results show a system's total missing games'`.
- [ ] **Step 2:** Run the renderer tests. Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4:** Run `npm test`, typecheck, lint. Expected: PASS.
- [ ] **Step 5: Commit:** `feat(launcher): global search and Scan menu in the Game Library (FR-LIB-3, FR-LIB-10)`.

### Task 13: E2E, docs, changelog

**Files:**
- Create: `apps/launcher/e2e/library.spec.ts`
- Modify: `CHANGELOG.md` (Unreleased), `docs/01-product/roadmap.md` (M2 ☑ once merged; note M2c), `docs/02-design/screen-specifications.md` S7 (as built: tabs, Scan ▾, relink, left-out Play/Scrape, collections inside the Library), `docs/03-architecture/data-model.md` §4 (implemented tables, FTS over `title` only — `sort_title` is redundant, triggers, rename rule), `docs/04-quality/test-strategy.md` (perf tests location), `docs/01-product/02-product-requirements.md` only if status columns exist.

- [ ] **Step 1: Write `'FR-LIB-6..8, FR-LIB-10: browse, search, favorite, edit and collect'`:** temp data dir with one storage location holding `Nintendo 64/Homebrew Demo.z64` and `Nintendo 64/Homebrew Racer.z64` (empty files). Open Library → empty state → Scan ▾ → Scan all → the system appears with 2 games. Search `racer` → one result. Favorite it; set Favorites filter → 1 row. Edit details: title `Racer Deluxe` → list shows it. New collection `Picks`, add the game, open `Picks` → 1 row. Restart the app → favorite, title and collection survive.
- [ ] **Step 2:** Run `npm run test:e2e`. Expected: PASS (all specs).
- [ ] **Step 3:** Update the docs and changelog.
- [ ] **Step 4: Full gate:** `npm run lint`, `npm run typecheck`, `npm test`, `npm run test:e2e`. Keep the output for the PR.
- [ ] **Step 5: Commit:** `test(launcher): library e2e; docs: M2c status`.
