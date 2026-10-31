# Library Drill-down Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the Library's long system tree with the NextLevelOS-style flow: browse the active
menu as cards, open a system/collection/smart filter into a three-column view (tabs + filters +
genres | box-art grid or list | details), and add a Completed flag.

**Architecture:** The home reads the resolved active menu (`frontend.menu`, already hides invisible,
disabled and empty nodes) and keeps a path of node ids; the scope view reuses `useLibraryView`
(paged games, selection, overlays) with a new sidebar, a virtualized `GameGrid` beside the existing
`GameList`, and a `library.games.facets` channel for filter/genre counts. Main gains a `completed`
user-state column (library migration 0010), `recent`/`completed` tabs, filter/genre narrowing and a
box-art version on list rows.

**Tech Stack:** React 19, TanStack Query + Virtual, Tailwind, Zod contracts in `packages/shared`,
better-sqlite3 + Drizzle migrations, Vitest + Testing Library, Playwright e2e.

**Spec:** this plan's Design section (agreed with the owner 2026-10-30) + `docs/02-design/screen-specifications.md` S7, which Task 5 rewrites. Reference look: NextLevelOS `src/apps/GameLibrary.tsx` (read-only).

## Design (owner decisions)

- **D60** Completed is a per-game flag (`game_user_state.completed`), toggled from the context menu and
  the details panel, with a Completed tab. The NextLevelOS importer turns a game's `completed` tag
  into the flag (like `favorite`).
- **D61** The Library opens on the active menu (or the generated one) as cards, one level at a time,
  with Home, Back and a breadcrumb; a grid/list toggle for the cards. After the menu's own items
  come two fixed cards: **Not in menu** (systems with games the menu leaves out; only when
  non-empty) and **Collections** (every collection and smart filter, with the New collection / New
  smart filter buttons). Category cards are coloured tiles (no menu art in this PR).
- **D62** A scope view's left column: tabs All, Favorites, Recently played, Completed, then Hidden,
  Missing, Needs review; then the scope's **Filters** and **Genres** with counts; picking one narrows
  the list (one filter and one genre at a time, click again to clear). Middle: box-art grid or list,
  the choice remembered per scope. Right: details with video/screenshot, Play, facts, description.
- PR #48's tree is not merged (closed). `SystemTree`/`buildTree` are deleted.

## Global Constraints

- Branch `feat/library-drilldown` off `origin/main`; one PR; ledger `.superpowers/sdd/2026-10-30-library-drilldown/progress.md`.
- Every renderer string through i18n with both `en.json` and `pt-BR.json` keys under `library.*`.
- NFR-PERF-2: grid and list stay virtualized; `GameRepository.perf.test.ts` budgets must still pass (`CI=1` locally).
- IPC contracts are Zod in `packages/shared/src/ipc/contract.ts`; library channels fail with `LIBRARY_UNAVAILABLE` when the library is closed (like every existing `library.*` channel).
- Library migration via `npm run db:generate -w apps/launcher`, Prettier the generated files, delete `node_modules/.vitest-cache` after.
- Never edit TS/JSON through Bash heredocs with backslashes (use Write/Edit).
- View-mode memory uses `localStorage` (inside the portable data folder's userData) wrapped in try/catch; default `grid`.

## Review Focus

1. The active menu changes (edit, switch, scan) while drilled into a category that no longer exists → the view falls back to the deepest still-existing ancestor, never a blank page. (Task 3 test.)
2. A filter or genre is picked, then the tab or scope changes → the narrowing stays across tab changes (an empty result shows the usual empty list) and clears when the scope changes. (Task 4 test.)
3. Grid keyboard: ArrowRight at a row end goes to the next row's first card; ArrowDown on the last partial row goes to the last game; Shift+arrows extend the selection like the list. (Task 4 test.)
4. A game with no box art, or art that fails to load → placeholder tile with the title, same size (no jump). (Task 4 test.)
5. Games not in any menu node stay reachable: a system only in Not in menu, and hidden collections, are listed in their fixed cards. (Task 3 test.)

---

### Task 1: Completed flag and the Recently played / Completed tabs

**Files:**
- Modify: `packages/shared/src/library/games.ts` (GAME_TABS, GameRowSchema, GameFlagsSchema), `packages/shared/src/library/games.test.ts`
- Modify: `apps/launcher/src/main/library/schema.ts` (gameUserState), new `migrations/0010_*.sql`
- Modify: `apps/launcher/src/main/library/gameSql.ts` (RawRow, ROW_COLUMNS, TABS, order for `recent`), `GameRepository.ts` (setFlags), tests `GameRepository.test.ts`, `GameRepository.write.test.ts`
- Modify: `apps/launcher/src/main/import/mapGames.ts` (+ its importer write of user state), `mapGames.test.ts`
- Modify: `packages/shared/src/i18n/en.json`, `pt-BR.json` (`library.tabs.recent`, `library.tabs.completed`)

**Interfaces:**
- Produces: `GAME_TABS = ['all','favorites','recent','completed','hidden','missing','needsReview']`; `GameRow.completed: boolean`; `GameFlags.completed?: boolean`.

- [ ] **Step 1: Failing tests**
  - shared: `'D60: flags accept completed'` → `GameFlagsSchema.parse({ completed: true })` ok; `GAME_TABS` contains `'recent'` and `'completed'`.
  - `GameRepository.test.ts` `'D60: the completed tab lists completed games that are not hidden'`: 3 games, mark 1 and 2 completed, hide 2 → tab `completed` returns [1]; row 1 has `completed: true`.
  - `'D60: recently played lists played games, newest first, whatever the sort'`: games A (played 2026-01-01), B (2026-03-01), C (never) → tab `recent` with `sort: 'title'` returns [B, A].
  - `mapGames.test.ts` `'D60: a completed tag becomes the completed flag'`: legacy game with `filter: ['completed','hack']` → `completed: true`, `filters: ['hack']`.
- [ ] **Step 2: Run** `npx vitest run packages/shared/src/library apps/launcher/src/main/library/GameRepository.test.ts apps/launcher/src/main/import` → FAIL.
- [ ] **Step 3: Implement.** `completed integer not null default 0` on `game_user_state` (generate migration 0010). TABS: `recent: 'u.last_played_at is not null and coalesce(u.hidden,0)=0'`, `completed: 'coalesce(u.completed,0)=1 and coalesce(u.hidden,0)=0'`. In `listShape`, tab `recent` orders `u.last_played_at desc, g.id desc` for system/smart-filter scopes and collections alike. `setFlags` upserts `completed` like `favorite`. Importer: `COMPLETED = 'completed'` handled like `FAVORITE` (merged with `||` for duplicates) and written to user state.
- [ ] **Step 4: Run** the same tests + `CI=1 npx vitest run apps/launcher/src/main/library` → PASS.
- [ ] **Step 5: Commit** `feat(library): completed flag, recently played and completed tabs (D60)`.

### Task 2: Box art on rows, filter/genre narrowing, facets channel

**Files:**
- Modify: `packages/shared/src/library/games.ts` (GameListQuerySchema, GameRowSchema, new GameFacetsSchema), `packages/shared/src/ipc/contract.ts`
- Modify: `apps/launcher/src/main/library/gameSql.ts`, `GameRepository.ts`, `apps/launcher/src/main/libraryHandlers.ts`, tests `GameRepository.test.ts`, `handlers.library.test.ts`, `GameRepository.perf.test.ts` (one more case)

**Interfaces:**
- Produces: `GameRow.boxArt: number | null` (box-front `game_media.version`); `GameListQuery.filter?: string` (FILTER_SLUG), `GameListQuery.genre?: string` (max 200);
  `'library.games.facets': { input: { scope: GameScope, tab: GameTab }, output: GameFacets }` with
  `GameFacets = { filters: { value: string; count: number }[]; genres: { value: string; count: number }[] }`, each sorted by `value` (case-insensitive), null genres left out.

- [ ] **Step 1: Failing tests**
  - `'D62: a list narrows to one filter and one genre'`: games with filters `hack`/`proto` and genres `Action`/`Shooter` → `{ filter: 'hack' }` and `{ filter: 'hack', genre: 'Action' }` return the expected ids; `total` matches.
  - `'D62: facets count the scope and tab, sorted by name'`: G1 `{hack, Shooter}`, G2 `{brazil, genre null}`, G3 `{hack, Action}`, G4 hidden `{hack, Shooter}` → tab `all`: filters `[{brazil,1},{hack,2}]`, genres `[{Action,1},{Shooter,1}]`; tab `hidden`: filters `[{hack,1}]`, genres `[{Shooter,1}]`.
  - `'D62: rows carry the box-front version or null'`: game with a `game_media` box-front row version 123 → `boxArt: 123`; other → `null`.
  - `handlers.library.test.ts` `'D62: facets fail with LIBRARY_UNAVAILABLE when the library could not open'`.
  - perf: `'NFR-PERF-2: a narrowed page of 20k games stays in budget'` reusing the existing perf world and budget.
- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement.** `ROW_COLUMNS` adds `(select version from game_media gm where gm.game_id = g.id and gm.kind = 'box-front') as boxArt`. `listShape(query, collectionSort, hasText, smartIds, narrow: { filter: boolean; genre: boolean })` adds `exists (select 1 from game_filters f where f.game_id = g.id and f.filter = @filter)` / `m.genre = @genre` (fixed fragments, params only). `GameRepository.facets(scope, tab)` runs two grouped queries over `listShape`'s `from` (no narrowing).
- [ ] **Step 4: Run** tests + `CI=1 npx vitest run apps/launcher/src/main` → PASS.
- [ ] **Step 5: Commit** `feat(library): box art on rows, filter and genre narrowing, facets (D62)`.

### Task 3: Library home — browse the active menu

**Files:**
- Create: `apps/launcher/src/renderer/features/library/home/LibraryHome.tsx` (cards grid/list, breadcrumb, Home/Back), `home/levels.ts` (pure), `home/levels.test.ts`, `home/LibraryHome.test.tsx`
- Create: `apps/launcher/src/renderer/features/library/useActiveMenuTree.ts` (`frontend.menu` query, refreshed on `menus.changed` and `scan.finished`)
- Modify: `LibraryApp.tsx` (home ↔ scope view), `useLibraryView.ts` (no tree; scope starts null = home), `LibraryEmpty.tsx` if needed
- Delete: `SystemTree.tsx`, `buildTree.ts`, `buildTree.test.ts`, `LibrarySidebar.tsx`
- Modify: i18n `library.home.*`

**Interfaces:**
- Consumes: `MenuTree`/`MenuNode` (shared), `SystemSummary[]`, `CollectionSummary[]`, `SmartFilterSummary[]`.
- Produces (`home/levels.ts`):
  - `type HomeCard = { key: string; label: string; count: number; kind: 'category' | 'system' | 'collection' | 'smartFilter' | 'notInMenu' | 'collections'; scope?: GameScope }`
  - `levelAt(tree: MenuTree, path: readonly string[], ctx: { systems; collections; smartFilters }): { path: string[]; title: string; trail: { id: string; label: string }[]; cards: HomeCard[] }` — `path` is node ids, then `'@notInMenu'` / `'@collections'` for the fixed cards; an unknown id cuts the path there (Review Focus 1). Category count = children; system count = games; collection/smart filter = games. Root appends the two fixed cards. A system node's filter children are ignored (filters live in the scope view).
  - `LibraryHome` props: `{ level: Level; view: 'grid' | 'list'; onView(v); onOpen(card: HomeCard); onPath(path: string[]); collectionsActions: ReactNode }`.

- [ ] **Step 1: Failing tests** (`levels.test.ts`):
  - `'D61: the root lists the menu items, then Not in menu and Collections'` (fixture: categories Sega[genesis], Nintendo[snes, Handhelds[n64]]; systems with games genesis, snes, n64, homebrew) → labels `['Sega','Nintendo','Not in menu','Collections']`, counts `[1,2,1,…]`.
  - `'D61: a path opens nested categories with a trail'`: path `[nintendoId, handheldsId]` → cards `['Nintendo 64']`, trail `['Nintendo','Handhelds']`.
  - `'D61: an id that no longer exists cuts the path'`: path `[nintendoId, 'gone']` → path `[nintendoId]`.
  - `'D61: Not in menu lists systems with games the menu leaves out; Collections lists every collection and smart filter'`.
  - `'D61: Not in menu is left out when empty'`.
  - `LibraryHome.test.tsx` `'D61: opening a card drills down; Back and Home return'` and `'D61: a system card opens its games'` (fake bridge `frontend.menu`).
- [ ] **Step 2: Run** `npx vitest run src/renderer/features/library/home` (in `apps/launcher`) → FAIL.
- [ ] **Step 3: Implement.** Cards: button tiles with gradient colour by index (8-entry palette), folder icon for categories, gamepad for systems, label, "N items"/"N games", chevron; list mode = rows with the same content. Header: Home and Back buttons, breadcrumb (`trail`), view toggle (`aria-pressed`). Keyboard: Backspace or Alt+ArrowLeft = Back. `LibraryApp` keeps `path` state; opening a scope card sets `view.setScope`; the scope view's Back returns to the same `path`.
- [ ] **Step 4: Run** → PASS; `npx vitest run src/renderer/features/library` → PASS (rewrite tree-based assertions in `LibraryApp.test.tsx`, `SmartFilters.test.tsx`, `CollectionOrder.test.tsx` to open scopes through the home).
- [ ] **Step 5: Commit** `feat(library): browse the active menu as cards (D61)`.

### Task 4: Scope view — sidebar, box-art grid, list toggle

**Files:**
- Create: `ScopeSidebar.tsx` (tabs with counts where known, Filters, Genres), `GameGrid.tsx`, `GameCard.tsx`, `gridNav.ts` + `gridNav.test.ts`, `useViewMode.ts`, `facetsApi.ts`, tests `ScopeSidebar.test.tsx`, `GameGrid.test.tsx`
- Modify: `useLibraryView.ts` (narrow state `{ filter?: string; genre?: string }`, cleared on scope change; passed into `GameListParams`), `usePagedGames.ts` (params include narrowing), `LibraryApp.tsx` (three columns), `LibraryStatusBar.tsx` (drop the tab select; keep counts and sort)

**Interfaces:**
- Consumes: Task 2's `GameRow.boxArt`, `GameListQuery.filter/genre`, `library.games.facets`; Task 1's tabs.
- Produces: `gridMove(index: number, key: string, columns: number, total: number): number` (pure; ArrowLeft/Right ±1, Up/Down ±columns clamped to [0,total-1], Home/End, PageUp/PageDown ±columns*3); `GameGrid` takes `GameList`'s props plus nothing else (same selection/onRange/onOpenMenu/onActivate contract, drag reorder not supported → `LibraryApp` forces list view for a manual-order collection); `useViewMode(scopeKey: string): ['grid'|'list', (v) => void]`.

- [ ] **Step 1: Failing tests**
  - `gridNav.test.ts` `'D62: arrows wrap across rows and clamp at the ends'`: columns 4, total 10 → `gridMove(3,'ArrowRight',4,10) === 4`, `gridMove(7,'ArrowDown',4,10) === 9`, `gridMove(1,'ArrowUp',4,10) === 1`, `gridMove(9,'End',4,10) === 9`.
  - `GameGrid.test.tsx` `'D62: cards show box art or a placeholder of the same size'` (boxArt null and an `<img>` firing `error` → placeholder with title); `'D62: Shift+arrow extends the selection in the grid'`; `'D62: Enter plays, the context-menu key opens the menu'`.
  - `ScopeSidebar.test.tsx` `'D62: picking a filter narrows the list and clicking it again clears it'` (asserts the `library.games.list` call carries `filter`), `'D62: changing scope clears the narrowing'`, `'D62: genres list with counts'`.
  - `LibraryApp.test.tsx` `'D62: the view toggle is remembered per scope'` and `'D62: a manual-order collection shows the list'`.
- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement.** Grid: width from a `ResizeObserver` on the scroller, `columns = max(1, floor(width / 180))`, card aspect 3:4 + title strip; virtualize rows of cards (`count = ceil(total/columns)`), `onRange` reports game indexes of the visible rows; images `mediaUrl(id,'box-front',boxArt)` with `loading="lazy"`. Sidebar: icons (LayoutGrid, Heart, Clock, Trophy, EyeOff, AlertTriangle, Search) per tab; Filters/Genres sections with counts from `library.games.facets` (refetched with games on `library.changed`/`scan.finished`), Genre section collapsible. Status bar keeps counts and the sort select.
- [ ] **Step 4: Run** `npx vitest run src/renderer/features/library` → PASS.
- [ ] **Step 5: Commit** `feat(library): scope sidebar with filters and genres, box-art grid (D62)`.

### Task 5: Details, Completed actions, e2e and docs

**Files:**
- Modify: `DetailsArt.tsx` (video → screenshot → box-front, first present in `game.media`; video `muted loop autoplay playsInline`), `GameDetails.tsx` (facts grid: Year, Players, System, Played N×; Completed toggle), `GameContextMenu.tsx` (Mark completed / Not completed, like Favorite), tests `GameDetails.test.tsx`, `Play.test.tsx` if affected
- Modify: e2e `apps/launcher/e2e/library.spec.ts`, `import.spec.ts` (open scopes via cards: add `openScope(library, labels: string[])` to `e2e/launch.ts`), new assertions: grid/list toggle, Completed tab
- Modify: `docs/02-design/screen-specifications.md` S7 (rewrite the layout bullets per D60–D62), `docs/01-product/02-product-requirements.md` (FR-LIB-7 mentions completed), `CHANGELOG.md` `[Unreleased]`

- [ ] **Step 1: Failing tests** `'D60: the context menu and the details mark games completed'` (asserts `library.games.setFlags` with `{ completed: true }` for every selected id); `'D62: details prefer the video, then a screenshot, then the box'`.
- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement**; update e2e specs and docs.
- [ ] **Step 4: Verify** `npm run lint`, `npm run typecheck`, `CI=1 npm test`, `npm run test:e2e -w apps/launcher` (library, import, menus specs at least) → all pass.
- [ ] **Step 5: Commit** `feat(library): details media, completed actions; docs and e2e (D60–D62)`; push, open PR, `gh pr checks`, ask owner before squash-merge.
