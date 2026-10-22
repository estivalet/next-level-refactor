# M5 Menus, Collections & Import Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Menus become user data (several menus, one active, a visual Menu Editor with live
preview), smart filters become menu nodes, collections get drag reorder and an "Add games…"
picker, and the owner's NextLevelOS `public/data` folder imports with a dry-run report and can be
re-imported without duplicates.

**Architecture:**
- `packages/shared` gets the menu document, smart filter query and import report contracts, plus
  lenient Zod schemas of the legacy NextLevelOS files (`config.json`, `launchers.json`,
  `menu*.json`, `gamelists/*.json`, `themes.json`, `screenscraper.json`).
- Main gets `menus`, `menu_nodes`, `smart_filters` and `arcade_info` tables, a `MenuRepository`
  (documents with revisions), a `SmartFilterRepository` (query → SQL), and a **menu resolver**
  that turns the active menu (or the generated one while none exists) into the `MenuTree` themes
  already read. `FrontendService.games` learns smart filter nodes and duplicate-node suffixes.
- The renderer gets a **Menu Editor** app (tree ops ported from NextLevelOS), a Smart filters
  section in the Library, collection drag reorder + "Add games…", and **Settings → Data → Import
  NextLevelOS** over an `ImportService` (pure mapper → dry-run report → staged apply).
- **Four PRs**, same workflow as M4 (inline TDD → fresh Opus reviewer for the branch → fixes with
  failing-first tests → PR → CI green → owner OK → squash-merge):
  **M5a** menus core (Tasks 1–5, `feat/m5a-menus`);
  **M5b** Menu Editor (Tasks 6–9, `feat/m5b-menu-editor`);
  **M5c** smart filters UI, collections, 10k-list fixes (Tasks 10–12, `feat/m5c-smart-collections`);
  **M5d** NextLevelOS importer, release v0.5.0 (Tasks 13–19, `feat/m5d-import`).

**Tech Stack:** Existing stack (Drizzle + better-sqlite3, React 19, TanStack Query/Virtual,
`uuid` v7). Drag and drop with native HTML5 DnD + keyboard moves (as NextLevelOS); no new runtime
libraries.

**Spec:**
- FR-MENU-1..4, FR-LIB-8 (collections polish), FR-LIB-9, FR-IMP-1/2; US-B3, US-D5; test strategy
  C5 (legacy fixture import idempotent, expected counts).
- Data model §1 (UUIDv7 ids for menus/nodes), §4 (`menus`, `menu_nodes`, `smart_filters`,
  `arcade_info`, `collections`), §6 (import mapping); IA F6 (import flow), screen specs S7
  (Library), S10 (Menu Editor), S11 (Collections → Library, D11).
- Reference (read-only) NextLevelOS @ 3d530b7: `src/apps/MenuEditor/treeOps.ts`, `rows.ts`
  (+ tests) to port; `MenuEditor.tsx`, `ItemForm.tsx`, `NewMenuDialog.tsx`, `src/lib/activeMenu.ts`,
  `electron/menuFile.cjs`, `src/apps/CollectionManager.tsx`, `public/nextlevel-launcher.py`
  (per-game `config`/`shader` semantics) and the live `public/data` files as behavior reference.

## Owner decisions

Asked in one batch on 2026-10-22; answers recorded.

- **D8 Menu sync — never auto-add.** Menus change only in the Menu Editor. Enabling a system or
  creating a collection/smart filter adds nothing to any menu; the editor shows a **Not in this
  menu** list (enabled systems with games, collections, smart filters not referenced) with Add.
- **D9 Theme override — defer applying.** `menu_nodes.theme_id` exists, no editor field; FR-MENU-4
  is partial (display name, short name, filter tabs). The importer reports node `theme` values as
  unmapped.
- **D10 Smart filters — Library + 3 built-ins.** Library sidebar section **Smart filters**
  (create/edit/delete); fields: systems, favorites only, filter tags (any of), genre contains,
  year from/to, minimum players, played (any/played/never), played within N days, sort, limit.
  Seeded once: *Favorites* (favorite, sort title), *Recently played* (played, sort lastPlayed,
  limit 50), *Most played* (played, sort playCount, limit 50). Not added to any menu.
- **D11 Collections — enhance the Library.** No separate app: drag reorder in manual sort and an
  **Add games…** picker (search across systems). IA and S11 updated.
- **D12 Re-import — NextLevelOS wins.** Re-import syncs old → new: metadata fields not locked
  here, favorite/hidden, filters, launch overrides, arcade info, imported collections (contents +
  order) and imported menus are replaced; play count = max, last played = later. Menus and
  collections created in the new app are never touched. Nothing duplicates.
- **D13 Missing ROMs — import as missing.** A gamelist entry whose file the scan didn't find
  becomes a game row marked missing (metadata, flags, history kept; Missing tab); a later scan
  that finds the file revives it.
- **D14 Emulators — optional folder + detect.** The import asks for an emulators folder
  (pre-filled with `<parent of first storage location>/emulators` when it exists) and runs M3's
  detection, adding preset profiles and `defaultProfileId` only for systems that have none. The
  17-style custom `command`s are listed in the report with their text.

**Assumptions (no decision needed; say so if wrong):**
- **Generated menu stays live until saved.** While the `menus` table is empty, the active menu is
  the M4 generated tree (FR-MENU-3), so a new user who enables systems later still sees them. The
  Menu Editor opens it as an unsaved draft titled "Default"; the first save persists it. "New
  menu" offers *Copy of current · Generated from enabled systems · Empty*.
- **Filters are not stored as nodes.** Persisted node types are FR-MENU-2's four: `category`,
  `system`, `collection`, `smartFilter`. A system node's filter entries are generated from its
  games (as in M4) unless the node's **Filter tabs** is off. Imported NextLevelOS filter entries
  under a system turn its filter tabs on; a `favorite` filter entry maps to the themes' Favorites
  tab (reported as mapped).
- **Resolution hides what can't open:** invisible nodes (and subtrees), systems disabled or with
  no present games, deleted references, collections and smart filters with no present games, and
  categories left empty. The editor still shows them, greyed with the reason.
- **Collection and smart filter ids stay integers** (as collections since M2c); menus and menu
  nodes are UUIDv7.
- `scrape_status` is M6: the importer reports scrape fields as "imported in M6" (re-import then
  fills them, D12). `arcade_info` arrives now because the importer carries it.
- `systems[id].screenscraperId` (override of the catalog id) arrives in M5d with a field in
  Settings → Systems, because the importer writes it (data model §6).
- The importer never copies `screenscraper.credentials.json` (FR-SCR-3 keychain is M6) and never
  writes into the NextLevelOS folder.

## Global Constraints

- **Menu document ids:** menu and node ids are UUIDv7 (`uuid` `v7`). Resolved `MenuTree` ids:
  categories `m:<nodeId>`; references `s:<systemId>`, `c:<collectionId>`, `sf:<smartFilterId>`;
  filter children `<systemNodeId>:f:<filter>`. When a reference repeats in one menu, the 2nd, 3rd…
  occurrence (document order) get `~2`, `~3` (`s:snes~2`, `s:snes~2:f:hack`); `games()` ignores
  the suffix. The generated menu keeps its M4 ids.
- **Art key:** `MenuNode.name` (menu-art key) = node `name`; references default `name` to the
  system catalog name / collection name / smart filter name at creation. `display` =
  `displayName ?? referenced name`.
- **Limits:** menu title 1–100 chars; node `name` 1–200, `displayName`/`shortName` ≤ 200; ≤ 5,000
  nodes per menu; depth unlimited (FR-MENU-1) but the schema rejects cycles by construction (tree
  JSON). Smart filter name 1–100, unique ignoring case; `limit` 1–10,000.
- **Writes:** menu save replaces all nodes of that menu in one transaction and bumps `revision`;
  a stale `baseRevision` → `CONFLICT` (nothing written). Importer stages each run in their own
  transaction(s) (IA F6) via the atomic-write helper for settings (one settings backup per import).
- **Events:** new IPC event `menus.changed` (no payload) after any menu save/create/delete/activate
  and after collection or smart filter rename/delete/change. ThemeHost gains
  `{ type: 'menu-changed' }`; `LauncherThemeHost` emits it on `menus.changed` and `scan.finished`.
- **Perf:** `frontend.menu` for a 5,000-node menu over a 200k-game library ≤ `perfBudget(300)` ms;
  a smart filter over 200k games ≤ `perfBudget(300)` ms; import mapping of 100k gamelist entries +
  90k collection entries ≤ `perfBudget(5000)` ms; apply of the same ≤ `perfBudget(30000)` ms.
- **Files:** components ≤ 200 lines, files ≤ 400. Main tests never import renderer files.
- **i18n:** every visible string in `en.json` and `pt-BR.json` (python script, `ensure_ascii=False`,
  `newline=''`). Import report reasons are codes rendered via i18n.
- **Fixtures:** the legacy NextLevelOS fixture uses invented titles and file names only — no
  commercial game names, ROMs or BIOS.
- **Porting:** commit body says `ported from NextLevelOS <path> @ 3d530b7`.
- **Tests** carry FR/US ids; `npm run lint`, `npm run typecheck`, `npm test` before every push;
  `npm run test:e2e` for touched flows.

## Review Focus

- **The owner's real data:** 438 launchers, 2 menus (~1,900 nodes, duplicate system nodes, nodes
  without `type`, `disply` typo, filter entries with children), 432 system gamelists (98k games,
  `./`-prefixed and nested `filename`s, `played` as string or null, `lastPlayedOn` like
  `7/21/2026, 7:49:00 PM`), 587 collection gamelists (90k entries, 7k with unknown systems), a
  non-gamelist JSON in `gamelists/` → dry run completes with reasons, never throws → Tasks 14, 15
  (fixture reproduces each shape).
- **Re-import after using both apps** (a game favorited here, played in both, a collection made
  here with an imported name, a metadata field edited here) → D12 rules exactly, counts unchanged
  on a second run → Task 16.
- **Menu edited in two windows / while the front-end is open** → second save gets CONFLICT;
  the open theme reloads the menu and keeps focus on the same node id when it still exists → Tasks
  3, 4, 7.
- **References that go stale** (system disabled, collection deleted, smart filter deleted, a
  system's last game goes missing) → resolver hides the node, editor shows it greyed with the
  reason, nothing crashes → Tasks 3, 8.
- **Huge lists** (smart filter of 10k, imported collection of 8k, HyperSpin letter jumps and
  stage lookups on them) → within budgets, O(1)/memoized per move → Tasks 2, 12.

---

## M5a — menus core (`feat/m5a-menus`)

### Task 1: Menu and smart filter contracts (FR-MENU-2, FR-LIB-9)

**Files:** Create `packages/shared/src/menus/schema.ts`, `packages/shared/src/library/smartFilters.ts`
(+ tests); modify `packages/shared/src/frontend/schema.ts` (+ test), `ipc/contract.ts`,
`ipc/events.ts` (+ tests), `index.ts`.

**Interfaces — Produces:**
- `MENU_DOC_NODE_TYPES = ['category','system','collection','smartFilter']`.
- `MenuDocNodeSchema` (recursive): `{ id: uuid, type, refId: string|null, name: string,
  displayName: string|null, shortName: string|null, filterTabs: boolean (default true),
  visible: boolean (default true), children: MenuDocNode[] }`; superRefine: `category` ⇔
  `refId === null`; `system` refId = system id; `collection`/`smartFilter` refId = positive int as
  string; only categories have children; unique node ids; ≤ 5,000 nodes.
- `MenuDocumentSchema { id: uuid, title, revision: int ≥ 0, active: boolean,
  source: string|null, nodes: MenuDocNode[] }`; `MenuSummarySchema { id, title, active, revision,
  source, nodeCount }`; `MenuDraftSchema { title, nodes }`.
- `SmartFilterQuerySchema` (strict): `systems: string[]` (default `[]` = all, ≤ 500),
  `favorite?: true`, `filters?: string[]` (FILTER_SLUG, any of), `genre?: string` (≤ 100),
  `yearFrom?`, `yearTo?` (1950–2100, from ≤ to), `minPlayers?: 1..16`,
  `played: 'any'|'played'|'never'` (default `any`), `playedWithinDays?: 1..3650`,
  `sort: 'title'|'year'|'lastPlayed'|'playCount'|'added'` (default `title`),
  `limit?: 1..10000`. `SmartFilterSummarySchema { id, name, query, games }`.
- `MENU_NODE_TYPES` gains `'smartFilter'`; `MenuNode` gains `smartFilterId?: number`.
- `GameScopeSchema` gains `{ kind: 'smartFilter', smartFilterId }`.
- IPC: `menus.list → MenuSummary[]`, `menus.get {id} → MenuDocument`, `menus.draft → MenuDocument`
  (active persisted menu, or the generated one with `revision: 0, id` fresh, `title: 'Default'`
  when none), `menus.save {id, title, nodes, baseRevision} → MenuDocument`,
  `menus.generated → MenuDraft` (from enabled systems, now), `menus.create {title, nodes} →
  MenuDocument` (the editor builds copy / generated / empty drafts and sends the nodes),
  `menus.delete {id}`, `menus.setActive {id}`, `frontend.resolveMenu {draft: MenuDraft} → MenuTree`;
  `smartFilters.list|create {name, query}|update {id, name?, query?}|delete {id}`.
  Event `menus.changed: z.object({})`.

- [ ] **Step 1: Failing tests** `FR-MENU-2`: a system node with children → error; a category with
  refId → error; duplicate node id → error; 5,001 nodes → error; a collection refId `'0'` →
  error; nested categories 10 deep parse. `FR-LIB-9`: `{ yearFrom: 2000, yearTo: 1990 }` → error;
  defaults fill `systems: [], played: 'any', sort: 'title'`; unknown key → error. Contract test
  lists the new channels and event.
- [ ] **Step 2:** `npx vitest run packages/shared/src/menus packages/shared/src/library packages/shared/src/ipc` → FAIL.
- [ ] **Step 3:** implement. **Step 4:** PASS.
- [ ] **Step 5:** commit `feat(shared): menu document and smart filter contracts (FR-MENU-2, FR-LIB-9)`.

### Task 2: Library tables and smart filter repository (FR-LIB-9; D10)

**Files:** Modify `apps/launcher/src/main/library/schema.ts` (+ test); generated migration
`0005_*.sql` (delete `node_modules/.vitest-cache` after); create
`main/library/SmartFilterRepository.ts`, `smartFilterSql.ts` (+ tests, + `.perf.test.ts`);
modify `GameRepository.ts` (smartFilter scope), `CollectionRepository.ts` (no change in API).

**Interfaces — Produces:**
- Tables: `menus (id text PK, title, active int, revision int, source text UNIQUE NULL,
  created_at, updated_at)` + partial unique index `menus_one_active ON menus(active) WHERE active = 1`;
  `menu_nodes (id text PK, menu_id FK cascade, parent_id FK cascade NULL, position int, type,
  ref_id, name, display_name, short_name, theme_id, filter_tabs int, visible int)`;
  `smart_filters (id int PK, name COLLATE NOCASE UNIQUE, query json, created_at)`;
  `collections.source text NULL` (import provenance, D12).
- `smartFilterSql(query: SmartFilterQuery): { where: string; order: string; params: Record<string, unknown>; limit: number | null }`
  — joins `game_metadata m`, `game_user_state u`; `genre` = `m.genre LIKE '%'||@genre||'%'`
  (escaped); `minPlayers` via registered SQLite function `max_players(text)` (largest integer in
  the text, e.g. `'1-4'` → 4; null → 1); `playedWithinDays` against `u.last_played_at`;
  missing games excluded.
- `SmartFilterRepository { list(): SmartFilterSummary[]; create(name, query); update(id, changes);
  delete(id); gameIds(id): number[]; seedBuiltIns(names: { favorites; recent; mostPlayed }): void }`
  — seeding writes `meta.smart_filters_seeded = 1` and never runs again (deleting all doesn't
  re-seed). Names come from the UI language (`en`/`pt-BR` i18n keys `library.smart.builtin.*`).
- `GameRepository.list` accepts `scope.kind === 'smartFilter'` (tabs apply on top; sort is the
  filter's).

- [ ] **Step 1: Failing tests** `FR-LIB-9`: favorites filter returns only favorites; `played:
  'never'` returns games without state rows; `genre: 'shoot'` matches `Shoot 'em up`, and
  `genre: '%'` matches only literal `%`; `minPlayers: 2` keeps `'1-4'`, drops `'1'` and null;
  `playedWithinDays: 7` with a fixed clock; `sort: 'playCount', limit: 2` order; missing games
  never returned; seeding twice creates 3 rows once; duplicate name (other case) → CONFLICT;
  library list with smartFilter scope + `favorites` tab. Perf: 200k games, filter `played` +
  `sort lastPlayed` ≤ `perfBudget(300)`.
- [ ] **Step 2:** FAIL. **Step 3:** implement (migration via `npm run db:generate -w apps/launcher`).
  **Step 4:** PASS.
- [ ] **Step 5:** commit `feat(launcher): smart filters and menu tables (FR-LIB-9, FR-MENU-3)`.

### Task 3: Menu repository and resolver (FR-MENU-1..3)

**Files:** Create `main/menus/MenuRepository.ts`, `main/menus/resolveMenu.ts`,
`main/menus/generatedDocument.ts` (+ tests); modify `main/frontend/FrontendService.ts`
(+ test, + perf test), `main/frontend/menuTree.ts` (reuse its filter helpers).

**Interfaces:**
- Consumes: Task 1 schemas, Task 2 tables, `buildMenuTree` (M4).
- Produces:
  - `MenuRepository { list(); get(id); active(): MenuDocument | null; save(id, draft, baseRevision): MenuDocument;
    create(title, nodes): MenuDocument; delete(id); setActive(id); upsertBySource(source, title, nodes): MenuDocument }`.
    Deleting the active menu activates the most recently updated other menu (or none → generated).
    First created menu becomes active.
  - `generatedDocument(input: MenuTreeInput & { smartFilters: [] }, newId): MenuDraft` — same
    structure as `buildMenuTree` (manufacturer categories, systems, "Collections" category named
    with the current language) but as document nodes (no filter nodes; `filterTabs: true`).
  - `resolveMenu(doc: { title; nodes }, ctx: ResolveContext): MenuTree` with
    `ResolveContext { systems: Map<id, { name; shortName? }>; enabled: Set<id>; gameCounts: Map<id, n>;
    filtersBySystem: Map<id, string[]>; collections: Map<number, { name; games }>;
    smartFilters: Map<number, { name; games }> }` — rules in Assumptions + id rules in Global
    Constraints; filter children reuse M4 `filterNodes` (≥ 2 distinct filters, `official` first).
  - `FrontendService.menu()` = active persisted menu resolved, else M4 `buildMenuTree`;
    `FrontendService.resolveDraft(draft)`; `games(nodeId)` accepts `sf:<id>` and strips `~n`.

- [ ] **Step 1: Failing tests** `FR-MENU-3`: empty table → M4 generated tree (ids unchanged).
  `FR-MENU-2`: renaming a collection changes `display` of its node, id stays `c:<id>`; a deleted
  collection's node is dropped; a disabled system and a system with 0 present games are dropped;
  `visible: false` drops the subtree; an emptied category is dropped; two nodes for `snes` → ids
  `s:snes` and `s:snes~2`, `games('s:snes~2:f:hack')` = `games('s:snes:f:hack')`; `filterTabs:
  false` → no filter children; smart filter node resolves to `sf:<id>` with `smartFilterId`.
  Repository: save with stale revision → CONFLICT and nothing changes; delete active → other
  menu active; two `active = 1` impossible (index). Perf: 5,000 nodes / 200k games ≤
  `perfBudget(300)`.
- [ ] **Step 2:** FAIL. **Step 3:** implement. **Step 4:** PASS.
- [ ] **Step 5:** commit `feat(launcher): persisted menus resolved for themes (FR-MENU-1..3)`.

### Task 4: Menu IPC, events and live reload in themes (FR-MENU-1, US-D5)

**Files:** Create `main/menus/menuHandlers.ts`, `main/library/smartFilterHandlers.ts` (+ tests);
modify `main/handlers.ts`, `ipc/register.ts`, `main/index.ts` (seed built-ins after library opens),
`collections` handlers (emit `menus.changed` on rename/delete), `packages/themes/src/host/ThemeHost.ts`,
`FakeThemeHost.ts`, `engine/navReducer.ts`, `engine/ThemeEngineProvider.tsx`, `engine/useHostEvents.ts`
(+ tests), `renderer/features/frontend/LauncherThemeHost.ts` (+ test).

**Interfaces — Produces:**
- `HostEvent` gains `{ type: 'menu-changed' }`.
- Reducer action `{ type: 'menu-reloaded'; items; title }`: rebuilds the stack by walking the
  current path's node ids in the new tree; keeps the deepest level that still exists, focus on the
  same node id (or clamped index); a games level whose node vanished pops to its parent.
- Handlers emit `menus.changed` after every successful menu/smart filter write and collection
  rename/delete; `LauncherThemeHost` maps `menus.changed` and `scan.finished` → `menu-changed`.

- [ ] **Step 1: Failing tests** `US-D5`: FakeThemeHost emits `menu-changed` after the menu moves
  "Sega Saturn" under "SEGA" (renamed from "Sega") → a theme on the root keeps focus on the same
  category id and shows "SEGA"; open games level of a removed node → back to parent; handler
  test: `menus.save` emits `menus.changed`, CONFLICT emits nothing; `collections.update` rename
  emits it.
- [ ] **Step 2:** FAIL. **Step 3:** implement. **Step 4:** PASS.
- [ ] **Step 5:** commit `feat(launcher): menu IPC and live menu reload in themes (FR-MENU-1, US-D5)`.

### Task 5: Docs, PR (M5a)

- [ ] Data model §4 (implemented tables, resolver rules, id suffixes), architecture §4.4
  (`menu-changed`), CHANGELOG Unreleased, roadmap M5 ◐. `npm run lint && npm run typecheck && npm test`
  green; fresh Opus review of the branch; fixes with failing-first tests; PR; CI green; ask owner.

---

## M5b — Menu Editor (`feat/m5b-menu-editor`)

### Task 6: Tree operations (FR-MENU-1)

**Files:** Create `renderer/features/menus/treeOps.ts`, `rows.ts` (+ tests), ported and rewritten
for `MenuDocNode` (id-addressed instead of index paths where it simplifies; keep `Path` for
drop math).

**Interfaces — Produces:** `insertNode(nodes, parentId|null, index, node)`, `removeNode(nodes, id)`,
`moveNode(nodes, id, toParentId|null, toIndex) → { nodes; changed }` (refuses moving into itself/
descendants and into non-categories), `moveUp/moveDown/indent/outdent(nodes, id)` (indent = into
the previous sibling when it is a category, as last child), `updateNode(nodes, id, patch)`,
`countDescendants`, `buildRows(nodes, expanded, query) → Row[]` (row carries `depth`,
`hasChildren`, `expanded`, `hiddenByAncestor`), `dropZoneAt(offsetY, height)`, `dropTarget(...)`.

- [ ] **Step 1: Failing tests** `FR-MENU-1`: port every NextLevelOS `treeOps.test.ts` /
  `rows.test.ts` case; plus indent into a system node → no change; outdent at root → no change;
  moving a category into its own child → `changed: false`.
- [ ] **Step 2:** FAIL. **Step 3:** implement. **Step 4:** PASS.
- [ ] **Step 5:** commit `feat(launcher): menu tree operations (FR-MENU-1)` (ported from
  NextLevelOS `src/apps/MenuEditor/treeOps.ts`, `rows.ts` @ 3d530b7).

### Task 7: Menu Editor app — picker, tree, save (FR-MENU-1, FR-MENU-3)

**Files:** Create `renderer/features/menus/MenuEditorApp.tsx`, `MenuPicker.tsx`, `MenuTreeView.tsx`,
`NewMenuDialog.tsx`, `menusApi.ts`, `useMenuDraft.ts` (+ tests); modify the app registry/desktop
icons (new app `menu-editor`, icon `ListTree`-style inline SVG as other apps), i18n.

**Interfaces:**
- Consumes: Task 1 IPC, Task 6 ops.
- Produces: `useMenuDraft(menuId|null) → { doc, dirty, apply(op), undo(), save(), conflict, reload() }`
  (undo stack of 50 snapshots); `menusApi` TanStack Query hooks keyed `['menus', …]`, invalidated
  on `menus.changed`.
- UI (S10): header — menu picker (active ✓), New, Duplicate, Delete (asks), Set active, Save,
  Preview; left — virtualized tree with drag/drop (before/inside/after), keyboard: arrows move
  selection, Alt+↑/↓ move, Alt+→/← indent/outdent, F2 rename, Delete asks; search box filters rows;
  unsaved changes prompt on close/switch; CONFLICT shows "Changed elsewhere — Reload".

- [ ] **Step 1: Failing tests** `FR-MENU-1`: drag "Sega Saturn" onto "Sega" (inside) then Save →
  `menus.save` gets the moved tree with `baseRevision`; Alt+↑ moves the selected node; switching
  menus with unsaved changes asks; CONFLICT → banner + Reload re-fetches. `FR-MENU-3`: with no
  menus the editor shows the generated draft titled "Default" and Save calls `menus.create`
  with the draft nodes, then it is active; New → "Generated" uses `menus.generated`; New →
  "Empty" creates and selects an empty menu.
- [ ] **Step 2:** FAIL. **Step 3:** implement. **Step 4:** PASS.
- [ ] **Step 5:** commit `feat(launcher): Menu Editor app (FR-MENU-1, FR-MENU-3)`.

### Task 8: Node form, Not-in-menu list, stale references (FR-MENU-2, FR-MENU-4; D8, D9)

**Files:** Create `renderer/features/menus/NodeForm.tsx`, `NotInMenu.tsx`, `nodeStatus.ts` (+ tests).

**Interfaces — Produces:** `nodeStatus(node, refs) → 'ok' | 'systemDisabled' | 'noGames' |
'missingRef' | 'empty'` (same rules as `resolveMenu`, from `systems.list`, `collections.list`,
`smartFilters.list`); `NotInMenu` lists enabled systems with games, collections and smart filters
no node references, each with **Add** (inserted at the end of the selected category or root;
system nodes go under the category whose name is the system's manufacturer when one exists).
Form: type (new nodes only), target picker (system/collection/smart filter, searchable), name
(art key), display name, short name, filter tabs (systems), visible. No theme field (D9).

- [ ] **Step 1: Failing tests** `FR-MENU-2`: a node pointing at a deleted collection shows greyed
  with "Collection deleted"; changing the target of a system node keeps its id; `FR-MENU-4`:
  editing display name updates the row label; `D8`: an enabled system not in the menu appears in
  Not in this menu and Add puts it under "Nintendo".
- [ ] **Step 2:** FAIL. **Step 3:** implement. **Step 4:** PASS.
- [ ] **Step 5:** commit `feat(launcher): menu node form and references (FR-MENU-2, FR-MENU-4)`.

### Task 9: Live preview, e2e, docs, PR (FR-MENU-1, US-D5)

**Files:** Modify `renderer/features/frontend/FrontendLayer.tsx`, `useFrontend.ts`,
`useLauncherThemeHost.ts`, `LauncherThemeHost.ts` (+ tests); create `apps/launcher/test/e2e/menus.spec.ts`;
docs.

**Interfaces — Produces:** `frontend.show({ previewDraft?: MenuDraft })`: the layer opens the
current theme with a host whose `getMenu()` calls `frontend.resolveMenu({ draft })`; leaving the
front-end returns to the editor with the draft intact; preview never writes `themes.lastUsed`.

- [ ] **Step 1: Failing tests** `US-D5`: preview shows the unsaved rename; exiting returns to the
  editor, still dirty; no `frontend.themeOpened` call. E2E: scan fixture games → Menu Editor →
  drag a system under another category, rename the category, Save → open front-end → new
  structure; Library unaffected (same game count).
- [ ] **Step 2:** FAIL. **Step 3:** implement. **Step 4:** PASS (`npm run test:e2e`).
- [ ] **Step 5:** docs (S10 as built, IA apps list, CHANGELOG) and commit
  `feat(launcher): menu live preview and e2e (FR-MENU-1, US-D5)`; review → fixes → PR → CI → ask owner.

---

## M5c — smart filters UI, collections, 10k fixes (`feat/m5c-smart-collections`)

### Task 10: Smart filters in the Library (FR-LIB-9; D10)

**Files:** Create `renderer/features/library/SmartFilterDialog.tsx`, `smartFiltersApi.ts`,
`smartFilterForm.ts` (+ tests); modify `buildTree.ts` (+ test), `SystemTree.tsx`, `LibraryApp.tsx`,
`useLibraryView.ts`, i18n.

**Interfaces — Produces:** tree section **Smart filters** (after Collections, with **+**), each row
with count; selecting shows its games (smartFilter scope; status bar tabs work); context menu
Edit…, Delete (asks; warns when a menu uses it: "Used in N menus"). Form ↔ query via
`toQuery(form) / fromQuery(query)`; systems multi-select from enabled systems; Save disabled
with field messages when invalid.

- [ ] **Step 1: Failing tests** `FR-LIB-9`: built-ins listed with counts; create "Shooters"
  (genre `shoot`) → appears and lists matching games; invalid year range shows the message and
  disables Save; delete asks and names the menus count.
- [ ] **Step 2:** FAIL. **Step 3:** implement. **Step 4:** PASS.
- [ ] **Step 5:** commit `feat(launcher): smart filters in the Library (FR-LIB-9)`.

### Task 11: Collections — drag reorder and Add games… (FR-LIB-8; D11)

**Files:** Modify `main/library/CollectionRepository.ts` (+ test), collections IPC
(`collections.move {id, gameId, toIndex}`), `renderer/features/library/GameList.tsx`,
`CollectionToolbar.tsx`; create `AddGamesDialog.tsx` (+ test); docs S11/IA.

**Interfaces — Produces:** `CollectionRepository.move(id, gameId, toIndex): void` (dense positions
kept, one transaction; clamps); dragging rows in a manual-sort collection calls it (multi-select
drag moves the block in order); **Add games…** opens a search picker (global search, ≥ 2 chars,
multi-select, already-in rows checked and disabled) → `collections.addGames`.

- [ ] **Step 1: Failing tests** `FR-LIB-8`: `move` from 0 to 3 in a 5-game collection → positions
  dense and order right; toIndex 99 clamps; drag in title sort is disabled; Add games… adds two
  search results and disables one already in.
- [ ] **Step 2:** FAIL. **Step 3:** implement. **Step 4:** PASS.
- [ ] **Step 5:** commit `feat(launcher): collection drag reorder and Add games (FR-LIB-8)`.

### Task 12: 10k-list lookups, e2e, docs, PR (NFR-PERF; M4d deferred)

**Files:** Modify `packages/themes/src/hyperspin/letterJump.ts`, HyperSpin stage and Showcase
settled-game lookup (+ tests); `e2e/library.spec.ts`.

**Interfaces — Produces:** letter keys memoized per games array (`WeakMap<ThemeGame[], string[]>`);
settled game found through a `Map<id, index>` built once per list.

- [ ] **Step 1: Failing tests** `FR-THM-3`: on a 10k-game list, 100 letter jumps call the title
  normalizer ≤ 10k times total (spy); stage lookup by id is O(1) (no `map(String)` over the list
  per settle — spy on the builder). E2E: create a smart filter and add it to the menu from the
  editor's Not in this menu → front-end shows it.
- [ ] **Step 2:** FAIL. **Step 3:** implement. **Step 4:** PASS.
- [ ] **Step 5:** docs (S7 smart filters + collections as built, data model) and commit
  `perf(themes): memoized letter jumps and id lookups for 10k lists`; review → fixes → PR → CI → ask owner.

---

## M5d — NextLevelOS importer, v0.5.0 (`feat/m5d-import`)

### Task 13: Legacy file schemas and fixture (FR-IMP-1)

**Files:** Create `packages/shared/src/import/legacy.ts`, `report.ts` (+ tests);
`apps/launcher/test/fixtures/nextlevelos/data/` (`config.json`, `launchers.json`, `menu.json`,
`menu-arcade.json`, `themes.json`, `screenscraper.json`, `gamelists/*.json`, one non-gamelist JSON)
+ `fixtures/nextlevelos/roms/` (tiny invented files) and `expected.json` (counts).

**Interfaces — Produces:**
- Lenient `passthrough` schemas: `LegacyConfigSchema` (`storage[{name,path,priority}]`,
  `scanExtensions?`, `assets?`, `themesPath?`, `menu?`, other keys kept for reporting),
  `LegacyLaunchersSchema` (record of `{ command, rompath: string[], romext?: string[]|string,
  emulators?, gameArt? }`), `LegacyMenuSchema` (`{ title, items: LegacyMenuItem[] }`, item:
  `name`, `display?`, `disply?`, `type?`, `shortname?`, `filter?`, `theme?`, `visible?`, `items?`),
  `LegacyGamelistSchema` (`{ games: LegacyGame[] }`, game: `filename`, `system?`, `title?`, `year?`
  (string|number), `desc?`, `players?`, `publisher?`, `developer?`, `genre?`, `category?`,
  `filter?: string[]`, `hidden?`, `played?: string|number|null`, `lastPlayedOn?`, `core?`,
  `config?`, `shader?`, `launch_args?`, `emulator?`, `rom?`, `parent?`, `driver?`, `manufacturer?`,
  `folder?`, `rompath?`, rest passthrough), `LegacyThemesSchema`, `LegacyScreenscraperSchema`.
- `ImportReportSchema`: `{ source, counts: { systems, menus, menuNodes, gamelists, games,
  collections, collectionEntries }, mapped: ImportItem[], unmapped: ImportItem[],
  willReplace: ImportItem[] }` with `ImportItem { area: 'storage'|'system'|'emulator'|'menu'|
  'game'|'collection'|'theme'|'scraper'|'config', key: string, reason: ImportReason, detail?: string,
  count?: number }` and `IMPORT_REASONS` (i18n `import.reason.<code>`): `unknownSystem`,
  `noGamelist`, `notAGamelist`, `customCommand`, `untypedEntry`, `themeOverride`, `folderEntry`,
  `unknownCollectionSystem`, `duplicateEntry`, `nameConflict`, `hookSetting`, `dropped`,
  `scrapeInM6`, `perGameEmulator`, `invalidFile`, `favoriteFilterTab`.

- [ ] **Step 1: Failing tests** `FR-IMP-1`: every fixture file parses; `played: null` and `'20'`
  both accepted; a gamelist without `games` fails `LegacyGamelistSchema` (caller reports
  `notAGamelist`); `romext: 'zip'` accepted; unknown keys kept.
- [ ] **Step 2:** FAIL. **Step 3:** implement + fixture (reproduce each Review Focus shape:
  duplicate system node, untyped leaf, `disply`, filter entries under a system and with children,
  `theme: 'grid'`, `./` and nested filenames, Disc 1/2 entries, collection entry with unknown
  system, menu collection without gamelist, custom command). **Step 4:** PASS.
- [ ] **Step 5:** commit `feat(shared): NextLevelOS legacy file schemas and import report (FR-IMP-1)`.

### Task 14: Import mapper — settings, systems, emulators (FR-IMP-1/2; D14)

**Files:** Create `main/import/readLegacy.ts`, `mapSettings.ts`, `matchSystem.ts` (+ tests); move
`renderer/features/settings/emulators/fromPreset.ts` → `packages/shared/src/settings/fromPreset.ts`
(+ test; renderer imports it from shared).

**Interfaces — Produces:**
- `readLegacy(folder: string): Promise<{ files: LegacyFiles; problems: ImportItem[] }>` — reads
  only, never writes; missing optional files are fine; `gamelists/` read with bounded concurrency.
- `matchSystem(name, catalog): string | null` — exact name, then aliases, then case/punctuation-
  insensitive slug; `null` → `unknownSystem`.
- `mapSettings(files, catalog, current: Settings): { next: Settings; items: ImportItem[] }` —
  storage merged by normalized path (existing kept, new appended in legacy priority order);
  systems with a gamelist or a menu node → `enabled: true`, `folderName` when the `rompath`
  basename differs from `defaultFolderName`, `extensions` from `romext` when they differ from the
  catalog; `assetsPath`/`themesPath`; `themes.entries[id].art` from `themes.json` with `gameArt`
  keys mapped name → id (unknown → `unknownSystem`) and `activeDefault`; `screenscraperId` where it
  differs; `wsl.*`, `squashfs.exe`, `overlay.*`, `extraction.*` → `hookSetting`; `test.*` →
  `dropped`; custom (non-runner) commands → `customCommand` with the command as `detail`.
- `addDetectedProfiles(settings, detected: DetectedEmulator[], presets, newId): Settings` — adds
  emulators/profiles via `fromPreset` and `defaultProfileId` only where a system has none (D14).
- Adds `systems[id].screenscraperId?: int > 0` to `SystemSettingsSchema` + field in Settings →
  Systems (+ test).

- [ ] **Step 1: Failing tests** `FR-IMP-1`: fixture → 3 storage locations in priority order; an
  existing location with the same path (other slashes/case) isn't duplicated; `Amstrad GX4000`
  with a custom rompath gets `folderName`; `gameArt: {'Nintendo 64': [...]}` → key `nintendo-64`;
  `squashfs.exe` reported `hookSetting`; custom command reported with its text; detection adds a
  profile and sets `defaultProfileId` only for a system without one. `FR-IMP-2`: `readLegacy`
  on a read-only copy succeeds (no writes: fs spy).
- [ ] **Step 2:** FAIL. **Step 3:** implement. **Step 4:** PASS.
- [ ] **Step 5:** commit `feat(launcher): NextLevelOS settings and systems mapping (FR-IMP-1)`.

### Task 15: Import mapper — games, collections, menus, dry run (FR-IMP-1/2, US-B3)

**Files:** Create `main/import/mapGames.ts`, `mapCollections.ts`, `mapMenus.ts`, `dryRun.ts`
(+ tests, + `mapGames.perf.test.ts`).

**Interfaces — Produces:**
- `normalizeRelPath(filename)`: strips leading `./`, `\` → `/`, trims; `''` → invalid.
- `mapGames(files, systemIds) → { entries: GameImport[]; items }` with `GameImport { systemId,
  relPath, discGroup: string|null (normalizeDiscName of a Disc-tagged stem), metadata: { title?,
  year?, developer?, publisher?, genre?, players?, description? }, filters: string[] (minus
  'favorite'), favorite, hidden, playCount, lastPlayedAt: string|null (ISO; `M/D/YYYY, h:mm:ss AM`
  parsed as local time), override: { core?, extraArgs: string[] } | null, arcade: {...}|null }`;
  `config` → `['--appendconfig', path]`, `shader` → `['--set-shader', path]`, `launch_args` split
  on whitespace respecting quotes — confirm each against `nextlevel-launcher.py` before coding;
  `emulator`/`alt_*`/`mame_media` → `perGameEmulator` (counted); `folder` entries → `folderEntry`;
  duplicate `(system, relPath)` → merged (OR flags, max plays, later date) + `duplicateEntry`.
- `mapCollections(files, systemIds, menuCollectionNames) → { collections: { name; entries:
  { systemId; relPath }[] }[]; items }` — a gamelist is a collection when its name isn't a
  launcher key; entries keep file order; unknown systems → `unknownCollectionSystem` (counted).
- `mapMenus(files, systemIds, collectionNames, newId) → { menus: { source; title; nodes;
  active }[]; items }` — untyped node with items → category; filter entries under a system →
  parent `filterTabs: true` (`favorite` → `favoriteFilterTab`), filter entries with items →
  category; `type: system` → system node (unknown → `unknownSystem`, dropped); `type: collection`
  → collection node by name (no gamelist → `noGamelist`, dropped); untyped leaf → `untypedEntry`;
  `theme` → `themeOverride`; `disply` accepted as `display` (display differing from name →
  `displayName`). `source = 'nextlevelos:<file>'`; active = `config.menu` or `menu.json`.
- `dryRun(folder, deps) → ImportReport` — runs the mappers plus a read-only walk (`planScan` +
  the scan walker over the would-be settings, no DB writes) to count per system: entries with a
  file, entries that will be missing (D13), files without an entry (new games); fills
  `willReplace` for D12 (imported collections/menus that exist, collection name conflicts with
  ones made here → `nameConflict`, imported as `<name> (NextLevelOS)`).

- [ ] **Step 1: Failing tests** `FR-IMP-2`, `US-B3`: fixture dry run equals `expected.json`
  (counts and every unmapped reason); Disc 2 entry gets the group name; `lastPlayedOn` parses;
  duplicate entries merge; dry run writes nothing (library and settings unchanged). Perf: 100k +
  90k synthetic entries mapped ≤ `perfBudget(5000)`.
- [ ] **Step 2:** FAIL. **Step 3:** implement. **Step 4:** PASS.
- [ ] **Step 5:** commit `feat(launcher): NextLevelOS games, collections and menus mapping with dry run (FR-IMP-1/2)`.

### Task 16: ImportService — staged apply, idempotent (FR-IMP-1, US-B3; D12, D13)

**Files:** Modify library schema (+ migration `0006_*`: `arcade_info (game_id PK FK cascade, rom,
parent, driver, manufacturer)`); create `main/library/ImportRepository.ts`,
`main/import/ImportService.ts`, `main/import/importHandlers.ts` (+ tests, + perf test); IPC
`import.dryRun {folder, emulatorsFolder?} → ImportReport`, `import.apply {folder, emulatorsFolder?,
reportToken} → ImportSummary`, event `import.progress { stage, done, total }`.

**Interfaces — Produces:**
- `ImportService.apply(folder, opts)` stages (IA F6), each reported through `import.progress`:
  1. `settings` — `SettingsService.update` with `mapSettings` (+ detection, D14): one backup.
  2. `scan` — `ScanService.start(importedSystemIds)` then `whenIdle()`; a scan already running →
     `BUSY` before any write.
  3. `games` — `ImportRepository.upsertGames(entries, now)` in batches of 2,000 per transaction:
     match by `(systemId, relPath)` (NOCASE), else by `(systemId, discGroup)`, else insert a
     missing row (`size 0, mtime 0, missing 1, missing_since now`); apply D12: unlocked metadata
     fields replaced, filters replaced, favorite/hidden replaced, `play_count = max`,
     `last_played_at = later`, launch override replaced (`profile_id` kept), `arcade_info` replaced.
  4. `collections` — by `source = 'nextlevelos:<name>'` (create, or replace contents + order,
     sort manual); name taken by a non-imported collection → `<name> (NextLevelOS)`.
  5. `menus` — `MenuRepository.upsertBySource` for each legacy menu (collection refIds resolved
     to the imported ids); set active per `config.menu`.
  then emits `library.changed` (all imported systems) and `menus.changed`.
- `reportToken` = hash of the files' size+mtime from the dry run; apply refuses
  (`CONFLICT`) when the folder changed since the dry run.
- `ImportSummary { games: { matched, inserted, missing }, collections, menus, settingsBackupId,
  durationMs }`.

- [ ] **Step 1: Failing tests** `US-B3`, test strategy C5: apply fixture → counts equal
  `expected.json`; menu tree, favorites, hidden, collections and play history match; apply again →
  same counts, no duplicates. `D12`: a field edited here (locked) survives; favorite changed in
  the fixture wins; play count 3 here vs 5 legacy → 5, 7 here vs 5 → 7; a collection created here
  with an imported name → imported one gets the suffix, the user's is untouched. `D13`: entry
  without a file → missing row; a later scan finding the file revives that row (same id, still
  favorite). Folder changed after dry run → CONFLICT, nothing written. Perf: 100k + 90k apply ≤
  `perfBudget(30000)`.
- [ ] **Step 2:** FAIL. **Step 3:** implement. **Step 4:** PASS.
- [ ] **Step 5:** commit `feat(launcher): NextLevelOS import apply, idempotent (FR-IMP-1, US-B3)`.

### Task 17: Import UI in Settings → Data (FR-IMP-2, US-B3)

**Files:** Create `renderer/features/settings/import/ImportPanel.tsx`, `ImportReportView.tsx`,
`importApi.ts` (+ tests); modify `DataSection.tsx`, art-index query key (Settings themes page:
key includes `assetsPath` + `themesPath` — M4d deferred staleness, since import changes them), i18n.

**Interfaces — Produces:** Data → **Import NextLevelOS**: choose folder (`app.pickFolder`) →
optional emulators folder (pre-filled guess, D14) → **Dry run** → report: counts, per-area
mapped/unmapped tables with translated reasons and counts, "Will replace" list → **Import** (asks)
→ progress per stage → summary with "Open Library" / "Open Menu Editor". Re-run allowed.

- [ ] **Step 1: Failing tests** `FR-IMP-2`: dry run renders unmapped reasons in pt-BR too;
  Import disabled until a dry run of the same folder exists; progress shows stage names; CONFLICT
  says "The folder changed — run the dry run again". Art index refetches after `storage.assetsPath`
  changes (query key test).
- [ ] **Step 2:** FAIL. **Step 3:** implement. **Step 4:** PASS.
- [ ] **Step 5:** commit `feat(launcher): Import NextLevelOS in Settings (FR-IMP-2, US-B3)`.

### Task 18: E2E and owner dry run (FR-IMP-1/2)

**Files:** Create `apps/launcher/test/e2e/import.spec.ts`.

- [ ] **Step 1:** e2e: Settings → Data → Import NextLevelOS with the fixture (picker stubbed via
  `NEXTLEVEL_E2E_PICK_FILE`-style env for folders) → dry run report → Import → Library shows the
  games, favorites and a collection; front-end shows the imported menu; second import → same
  counts. Run `npm run test:e2e` → PASS.
- [ ] **Step 2:** Read-only realism check: run `dryRun` on `c:\lestivalet\NextLevelOS\public\data`
  from a throwaway script with a temp userData (never writes there), record counts/timings and
  any thrown error in the ledger; fix crashes with a fixture case first. Owner runs the real
  import from the UI (milestone demo "owner's library migrated").
- [ ] **Step 3:** commit `test(launcher): import e2e (FR-IMP-1/2)`.

### Task 19: Release v0.5.0

- [ ] Docs: data model §4/§6 as built (arcade_info, collections.source, screenscraperId, mapping
  table updated with every reason), IA F6, S7/S10/S11, PRD statuses (FR-MENU-4 partial, D9),
  roadmap M5 ☑ with sub-PRs, CHANGELOG 0.5.0. Review → fixes → PR → CI green → owner OK →
  squash-merge → main push run green → tag `v0.5.0` on the merge commit → `gh release create
  v0.5.0` with the CHANGELOG notes.
