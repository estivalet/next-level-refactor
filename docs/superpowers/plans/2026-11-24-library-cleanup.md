# Library cleanup (file names, Duplicates, Delete later) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Help the owner clean messy ROM folders: show each game's file in the list view, add a
system-scope **Duplicates** tab and a **Delete later** mark with its own tab. The launcher never
touches files.

**Architecture:** Two new `GameTab` values (`duplicates`, `deleteLater`) plug into the existing
tab SQL (`gameSql.ts` `TABS`), counts (`tabCountsSql`) and sidebar. `deleteLater` is a new
`game_user_state` boolean written through the existing `setGamesFlags`. Duplicate detection is one
uncorrelated window-function subquery over the scope's system, using a new SQLite function
`name_key(rel_path)` registered on the library connection.

**Tech Stack:** TypeScript ESM, Zod, Drizzle + better-sqlite3, React + TanStack Query, i18next,
Vitest, lucide-react.

**Spec:** `docs/superpowers/specs/2026-11-24-library-cleanup-design.md`

## Global Constraints

- The launcher never deletes, moves or renames ROM files. No delete action anywhere in this work.
- Requirement IDs: **FR-LIB-19**, story **US-C13**; every new test name carries one of them.
- Contracts first: schema changes in `packages/shared` before the code using them.
- All user-visible strings through `t('…')`, in both `en.json` and `pt-BR.json`.
- Run tests with `node scripts/vitest.mjs run <path>` from the repo root. After
  `npm run db:generate -w apps/launcher`, delete `node_modules/.vitest-cache` and
  `apps/launcher/node_modules/.vitest-cache` before running tests.
- Files stay under 400 lines (`GameRepository.ts` is at 376: put new SQL in `gameSql.ts` /
  `duplicates.ts`, not in the repository).
- Commit style: `feat(launcher): … (FR-LIB-19, US-C13)`; work on branch `feat/library-cleanup`.

## Review Focus

1. **Hiding or deleting one of two versions:** its twin must leave Duplicates too (the set is
   recomputed from non-hidden, non-missing games) — Task 3 test "twin leaves when the other is hidden/missing".
2. **Collection / smart filter scopes:** the duplicates fragment must not reference `@systemId`
   there (unbound parameter crash in `tabCountsSql`) — Task 3 test on collection facets.
3. **Big systems:** facets now compute Duplicates for a 10k-game system on every list open; it must
   stay inside NFR-PERF-2's 300 ms — Task 3 perf case.
4. **Delete later on a hidden game:** stays in the Delete later tab, and hiding from that tab must
   not move focus as if the row left — Task 2 SQL test + Task 4 `leavesTab` test.
5. **File names with odd tags:** `name_key` on names that are only tags (`(Japan).gg`), nested
   folders, or no extension must not return an empty key that groups unrelated games — Task 3 unit test.

---

### Task 1: Contracts and strings

**Files:**
- Modify: `packages/shared/src/library/games.ts`
- Modify: `packages/shared/src/i18n/en.json`, `packages/shared/src/i18n/pt-BR.json`
- Test: `packages/shared/src/library/games.test.ts` (create if absent; else add cases)

**Interfaces:**
- Produces: `GAME_TABS` = `[...existing, 'duplicates', 'deleteLater']` (appended in that order);
  `GameRowSchema` gains `relPath: z.string()` and `deleteLater: z.boolean()` (`relPath` removed from
  the `GameDetailsSchema.extend` since it now inherits it); `GameFlagsSchema` gains
  `deleteLater: z.boolean()` (still `.partial()` + non-empty refine).
- i18n keys (en / pt-BR):
  `library.tabs.duplicates` "Duplicates" / "Duplicados";
  `library.tabs.deleteLater` "Delete later" / "Excluir depois";
  `library.details.deleteLater` "Delete later" / "Excluir depois";
  `library.menu.deleteLater` "Mark Delete later" / "Marcar para excluir depois";
  `library.menu.keep` "Unmark Delete later" / "Desmarcar excluir depois";
  `library.deleteLaterMark` "Marked Delete later" / "Marcado para excluir depois" (row icon label).

- [ ] **Step 1: Write failing tests** — `FR-LIB-19: GameFlags accepts deleteLater`
  (`GameFlagsSchema.parse({ deleteLater: true })` succeeds; `{}` still fails);
  `FR-LIB-19: GameListQuery accepts the duplicates and deleteLater tabs`.
- [ ] **Step 2: Run** `node scripts/vitest.mjs run packages/shared/src/library` — expect FAIL.
- [ ] **Step 3: Implement** the schema changes and i18n keys above; extend the `GAME_TABS` doc
  comment with one line each for Duplicates and Delete later.
- [ ] **Step 4: Run** the same tests — PASS. Then `npm run typecheck`: it will report every
  `GameRow` fixture missing `relPath` / `deleteLater` and the `TABS` record missing keys — fixtures
  are fixed here (add `relPath`, `deleteLater: false`; renderer `testing.ts` already sets `relPath`),
  the `TABS` / `toRow` errors are Task 2's.
- [ ] **Step 5: Commit** `feat(shared): duplicates and delete-later contracts (FR-LIB-19)`.

### Task 2: Delete later storage, flag and tab

**Files:**
- Modify: `apps/launcher/src/main/library/schema.ts` (`gameUserState`)
- Create: migration via `npm run db:generate -w apps/launcher` (commit the generated `0022_*.sql` + meta)
- Modify: `apps/launcher/src/main/library/userStateWrites.ts` (`FLAG_COLUMNS`, params)
- Modify: `apps/launcher/src/main/library/gameSql.ts` (`RawRow`, `ROW_COLUMNS`, `TABS`, `toRow`)
- Test: `apps/launcher/src/main/library/GameRepository.write.test.ts`, `GameRepository.test.ts`

**Interfaces:**
- Consumes: Task 1 contracts.
- Produces: column `game_user_state.delete_later` (`integer('delete_later', { mode: 'boolean' }).notNull().default(false)`);
  `RawRow.deleteLater: number`, `RawRow.relPath` already present; `toRow` sets
  `relPath: raw.relPath` and `deleteLater: raw.deleteLater === 1`;
  `TABS.deleteLater = 'coalesce(u.delete_later, 0) = 1 and g.missing = 0'` (hidden games included).
  `TABS.duplicates` is a placeholder `'0 = 1'` here; Task 3 replaces it.

- [ ] **Step 1: Write failing tests**
  - `FR-LIB-19: setFlags marks and unmarks Delete later` — `setFlags([a, b], { deleteLater: true })`
    then `list({ tab: 'deleteLater' })` returns a and b with `deleteLater: true`; unmark b → only a.
  - `US-C13: Delete later keeps hidden games and drops missing ones` — a marked + hidden game is
    listed; a marked game flagged missing is not; facets `tabs.deleteLater` matches the list total.
  - `FR-LIB-19: list rows carry relPath` — a seeded `! Translated/Coca-Cola Kid [T-En by A].gg`
    row comes back with that exact `relPath`.
- [ ] **Step 2: Run** `node scripts/vitest.mjs run apps/launcher/src/main/library/GameRepository` — FAIL.
- [ ] **Step 3: Add the column**, run `npm run db:generate -w apps/launcher`, clear both
  `.vitest-cache` folders.
- [ ] **Step 4: Implement** the `userStateWrites.ts` and `gameSql.ts` changes above
  (`ROW_COLUMNS` adds `coalesce(u.delete_later, 0) as deleteLater`).
- [ ] **Step 5: Run** the tests — PASS; `npm run typecheck` clean for `apps/launcher/src/main`.
- [ ] **Step 6: Commit** `feat(launcher): Delete later mark (FR-LIB-19, US-C13)`.

### Task 3: Duplicates tab

**Files:**
- Create: `apps/launcher/src/main/library/duplicates.ts`
- Modify: `apps/launcher/src/main/library/openLibrary.ts` (register the function)
- Modify: `apps/launcher/src/main/library/gameSql.ts` (scope-aware tab fragment)
- Test: `apps/launcher/src/main/library/duplicates.test.ts`, `GameRepository.test.ts`,
  `GameRepository.perf.test.ts`

**Interfaces:**
- Produces: `export function nameKey(relPath: unknown): string | null` and
  `export function registerDuplicateFunctions(client: Database.Database): void` (registers
  `name_key`, `deterministic: true`) in `duplicates.ts`; `openLibrary` calls it next to
  `registerSmartFilterFunctions`.
- Produces: `export function tabSql(tab: GameTab, scope: GameScope): string` in `gameSql.ts`,
  used by both `tabCountsSql` and `listShape` instead of indexing `TABS` directly. For
  `duplicates` it returns `'0 = 1'` unless `scope.kind === 'system'`; every other tab returns `TABS[tab]`.

`nameKey` rule: take the file name after the last `/`, drop the extension, remove every `(…)` and
`[…]` group, collapse whitespace, trim, lower-case. Empty result → `null` (SQL `NULL` never groups).

Duplicates fragment for a system scope (window functions; the subquery is uncorrelated, so it runs
once per query):

```sql
g.id in (select id from (
  select g2.id as id,
    count(*) over (partition by lower(trim(m2.title))) as byTitle,
    case when name_key(g2.rel_path) is null then 1
      else count(*) over (partition by name_key(g2.rel_path)) end as byFile
  from games g2 join game_metadata m2 on m2.game_id = g2.id
  left join game_user_state u2 on u2.game_id = g2.id
  where g2.system_id = @systemId and g2.collection_only = 0 and g2.missing = 0
    and coalesce(u2.hidden, 0) = 0
) where byTitle > 1 or byFile > 1)
```

- [ ] **Step 1: Write failing tests**
  - `duplicates.test.ts` — `FR-LIB-19: nameKey strips folders, extension and tags`:
    `'! Translated/Coca-Cola Kid (Japan) [T-En by A].gg'` → `'coca-cola kid'`;
    `'Coca-Cola Kid  [T-En by Mr. Z v1.1].gg'` → `'coca-cola kid'`; `'(Japan).gg'` → `null`;
    `'README'` → `'readme'`; non-string → `null`.
  - `GameRepository.test.ts`, system `gamegear`, games: three Coca-Cola Kid files with different
    tags and titles `Coca-Cola Kid` (×2) and `Coca-Cola Kid (J)` (×1, matched only by file key);
    `Buster Ball` (single); a `Head Buster` pair in another system `nes` (other system, not counted).
    - `FR-LIB-19: Duplicates lists every version matched by title or file name` → the three
      Coca-Cola Kid ids; facets `tabs.duplicates` = 3.
    - `US-C13: a twin leaves Duplicates when the other version is hidden or missing` — a 2-game
      set; hide one → tab empty; unhide, mark the other missing → tab empty.
    - `FR-LIB-19: Duplicates matches across folders but lists only the narrowed scope` — with
      `filter: 'translated'` (folder filter on `! Translated`) only the translated version is listed
      though its twin sits in the system root.
    - `FR-LIB-19: Duplicates is empty in a collection scope` — collection facets return
      `tabs.duplicates` = 0 without throwing.
  - `GameRepository.perf.test.ts` — extend the NFR-PERF-2 facets case to also time
    `games.list({ scope, tab: 'duplicates', offset: 0, limit: 200 })` within `perfBudget(300)`.
- [ ] **Step 2: Run** `node scripts/vitest.mjs run apps/launcher/src/main/library` — FAIL.
- [ ] **Step 3: Implement** `duplicates.ts`, the registration and `tabSql`.
- [ ] **Step 4: Run** the library tests including perf — PASS.
- [ ] **Step 5: Commit** `feat(launcher): Duplicates tab (FR-LIB-19, US-C13)`.

### Task 4: Library UI

**Files:**
- Modify: `apps/launcher/src/renderer/features/library/GameRow.tsx`, `GameList.tsx` (`ROW_HEIGHT` 44 → 54)
- Modify: `ScopeSidebar.tsx` (`MORE_TABS`; new prop `scopeKind`)
- Modify: `GameDetails.tsx` (toggle), `GameContextMenu.tsx` (menu item)
- Modify: `scopeFacts.ts` (`leavesTab`)
- Modify: the `ScopeSidebar` caller (pass `scopeKind`)
- Test: `scopeFacts.test.ts`, `ScopeView.test.tsx`, `GameDetails.test.tsx`

**Interfaces:**
- Consumes: Task 1 contracts and i18n keys.
- `MORE_TABS` becomes `hidden, missing, needsReview, duplicates (CopyCheck — lucide "Copy" if absent), deleteLater (Trash2)`;
  `duplicates` is skipped when `scopeKind !== 'system'`.
- `leavesTab(tab, flags)`: on `deleteLater`, `flags.deleteLater === false` leaves and a `hidden`
  change does not; other tabs unchanged.
- Row: under the title, a second line `game.relPath.replaceAll('/', '\\')`, `truncate text-[11px]
  text-slate-500`, title and path in a `flex-1 min-w-0 flex-col` block; when `game.deleteLater`, a
  `Trash2` `h-3 w-3 text-rose-400` with `aria-label={t('library.deleteLaterMark')}` after the star.
- Details: a third `ACTION` button after Completed, `aria-pressed={game.deleteLater}`, `Trash2`
  icon rose when pressed, label `library.details.deleteLater`, same mutate + `onFlags` pattern.
- Context menu: after `hide`, item `deleteLater` (`allDeleteLater` computed like `allCompleted`),
  label `library.menu.keep` when all marked else `library.menu.deleteLater`, runs
  `flag({ deleteLater: !allDeleteLater })`.

- [ ] **Step 1: Write failing tests**
  - `scopeFacts.test.ts` — `US-C13: hiding a game keeps it in Delete later; unmarking leaves`.
  - `ScopeView.test.tsx` — `FR-LIB-19: the list row shows the game's file under its title`
    (`'! Translated\\Coca-Cola Kid [T-En by A].gg'` visible); `FR-LIB-19: the sidebar shows
    Duplicates and Delete later with counts in a system` and `…no Duplicates in a collection`.
  - `GameDetails.test.tsx` — `US-C13: Delete later toggles the mark` (click → `setFlags` called with
    `{ gameIds: [id], flags: { deleteLater: true } }`, button `aria-pressed` reflects the row).
- [ ] **Step 2: Run** `node scripts/vitest.mjs run apps/launcher/src/renderer/features/library` — FAIL.
- [ ] **Step 3: Implement** the UI above.
- [ ] **Step 4: Run** the renderer tests — PASS.
- [ ] **Step 5: Look at it:** `npm run dev`, open Sega Game Gear in list view, check the path line
  fits the row, Duplicates/Delete later counts, toggle from panel and context menu (multi-select).
- [ ] **Step 6: Commit** `feat(launcher): file line, Duplicates and Delete later in the Library (FR-LIB-19, US-C13)`.

### Task 5: Docs and full verification

**Files:**
- Modify: `docs/01-product/02-product-requirements.md` (FR-LIB-19 row after FR-LIB-18, priority S,
  "owner request 2026-11-24": file line in list view, system Duplicates tab by title or file name
  without tags, Delete later mark and tab; the launcher never deletes files)
- Modify: `docs/01-product/03-user-stories.md` (US-C13 with acceptance criteria mirroring the tests)
- Modify: `docs/03-architecture/data-model.md` (`game_user_state.delete_later`, `name_key` function)
- Modify: `docs/03-architecture/api-spec.md` (`GameTab`, `GameRow.relPath`/`deleteLater`, `GameFlags.deleteLater`)
- Modify: `docs/02-design/screen-specifications.md` (sidebar order line ~218, list row, details buttons, context menu)
- Modify: `docs/01-product/roadmap.md`, `CHANGELOG.md` (Unreleased → Added)

- [ ] **Step 1: Update the docs** above.
- [ ] **Step 2: Run** `npm run lint`, `npm run typecheck`, `npm test` — all pass; keep the output
  for the PR.
- [ ] **Step 3: Commit** `docs: library cleanup (FR-LIB-19, US-C13)`.
