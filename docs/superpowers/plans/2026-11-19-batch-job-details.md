# Batch Scrape Job Details Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The batch scrape strip names its scope and says when it resumed after a restart. Clicking it opens a side panel with the job's state, rules, current game and every game it handled.

**Architecture:** A new library table `scrape_job_items` gets one row per game handled. It is written in `BatchScrapeService.advance` in the same transaction as the job counters. Two read-only IPC channels (`scraper.batch.details`, `scraper.batch.items`) feed a new renderer drawer, `BatchDetailsPanel`, opened from `BatchProgress`.

**Tech Stack:** TypeScript ESM, Zod (`packages/shared`), Drizzle + better-sqlite3 (library DB), Electron typed IPC, React + TanStack Query, Vitest + Testing Library, react-i18next.

**Spec:** `docs/superpowers/specs/2026-11-19-batch-job-details-design.md`

## Global Constraints

- Branch `feat/batch-job-details` off `main`. Conventional Commits with scopes `shared`, `launcher` and `docs`, ending with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Contracts first: every new schema lives in `packages/shared` before main or renderer code uses it.
- Requirement IDs: **FR-SCR-8** and **US-C8**. Every new test name starts with one of them.
- Tests first for the repository, service and handlers. Never commit failing or skipped tests.
- All user-visible strings go through `t('…')`, with keys in both `packages/shared/src/i18n/en.json` and `pt-BR.json` (`locales.test.ts` enforces parity).
- No file over 400 lines. `BatchScrapeService.ts` is already ~450, so new logic goes in new files (`jobItems.ts`, `batchDetails.ts`), not into the service body.
- No new `any`, and no lint disables without a comment.
- Gemini batch (FR-SCR-7) is out of scope. `GeminiBatchService` must still compile unchanged, so new `BatchStatus` fields are `.optional()`.
- No time-remaining estimate (owner decision).

## Review Focus

1. **A job started before this update.** `scrape_job_items` is empty for its earlier games. The panel must show the counters plus "Games handled before this update aren't listed" (when `listed < done`), never an empty list with no explanation. *(Task 5 test)*
2. **A selection-scope job** (`systemIds: null`). The strip must say "Scraping selected games …", not crash or show a blank name. *(Task 4 test)*
3. **Paging while the job writes new rows.** Keyset paging on `(handled_at desc, game_id desc)` must never return a game twice across pages. *(Task 2 test)*
4. **A cancelled or finished job.** The panel still opens and shows the final counts and list. `details()` works for any job held in memory. *(Task 3 test)*
5. **A game deleted mid-job.** Its item disappears through the cascade, and the counters stay as they were. The list query must not break on the missing join. *(Task 2 test)*

---

### Task 1: Contracts

**Files:**
- Modify: `packages/shared/src/scraper/batch.ts`
- Modify: `packages/shared/src/ipc/contract.ts:325-335`
- Test: `packages/shared/src/scraper/batch.test.ts`
- Also: commit the approved spec `docs/superpowers/specs/2026-11-19-batch-job-details-design.md` in this task's first commit.

**Interfaces:**
- Produces (all exported from `@nextlevel/shared`):
  - `BATCH_ITEM_OUTCOMES = ['applied','review','notFound','failed','skipped'] as const`, `type BatchItemOutcome`
  - `BatchJobItemSchema = z.object({ gameId: int>0, title: string, systemId: string, outcome: enum(BATCH_ITEM_OUTCOMES), provider: enum(['screenscraper','launchbox']).nullable(), error: string.nullable(), handledAt: string })`, `type BatchJobItem`
  - `BatchItemsInputSchema = z.strictObject({ outcome: enum(BATCH_ITEM_OUTCOMES).optional(), cursor: z.strictObject({ handledAt: string, gameId: int>0 }).optional(), limit: int 1..200 default 100 })`
  - `BatchItemsPageSchema = z.object({ items: z.array(BatchJobItemSchema), next: cursor-shape.nullable() })`
  - `BatchJobDetailsSchema = z.object({ status: BatchStatusSchema, scope: BatchScopeSchema, rules: BatchRulesSchema, startedAt: string, listed: count })`. `listed` = rows in `scrape_job_items` for the job.
  - `BatchStatusSchema` gains `startedAt: z.string().optional()` and `resumedAt: z.string().nullable().optional()`.
  - IPC: `'scraper.batch.details': { input: z.void(), output: BatchJobDetailsSchema.nullable() }`, `'scraper.batch.items': { input: BatchItemsInputSchema, output: BatchItemsPageSchema }`

- [ ] **Step 1: Create the branch and commit the spec**

```bash
git checkout -b feat/batch-job-details
git add docs/superpowers/specs/2026-11-19-batch-job-details-design.md docs/superpowers/plans/2026-11-19-batch-job-details.md
git commit -m "docs: batch scrape job details design and plan (FR-SCR-8)"
```

- [ ] **Step 2: Write failing tests in `batch.test.ts`**

```ts
it('FR-SCR-8: BatchItemsInput defaults limit to 100 and caps it at 200', () => {
  expect(BatchItemsInputSchema.parse({})).toEqual({ limit: 100 });
  expect(() => BatchItemsInputSchema.parse({ limit: 201 })).toThrow();
});
it('FR-SCR-8: a job item accepts skipped with no provider', () => {
  const item = { gameId: 1, title: 'A', systemId: 'switch', outcome: 'skipped', provider: null, error: null, handledAt: '2026-11-19T10:00:00.000Z' };
  expect(BatchJobItemSchema.parse(item)).toEqual(item);
});
it('FR-SCR-8: IDLE_BATCH still parses without startedAt/resumedAt', () => {
  expect(BatchStatusSchema.parse(IDLE_BATCH)).toEqual(IDLE_BATCH);
});
```

- [ ] **Step 3: Run it.** `npx vitest run packages/shared/src/scraper/batch.test.ts`. Expected: FAIL (`BatchItemsInputSchema` is not exported).
- [ ] **Step 4: Add the schemas and the two contract entries above.** Doc comments on the contract entries: details = "The current job with its rules and scope (FR-SCR-8); null when idle", items = "Games the current job handled, newest first, keyset-paged (FR-SCR-8)".
- [ ] **Step 5: Run the test.** Expected: PASS. Then run `npm run typecheck`. Expected: errors only in `apps/launcher/src/main/scraper/batch/batchHandlers.ts` (missing the two handlers). Leave them; Task 3 fixes them. Don't commit a broken typecheck: add both handlers as temporary `() => null` / `() => ({ items: [], next: null })` stubs so the commit typechecks.
- [ ] **Step 6: Commit.** `feat(shared): batch job details and items contracts (FR-SCR-8)`

---

### Task 2: `scrape_job_items` table and repository

**Files:**
- Modify: `apps/launcher/src/main/library/schema.ts` (after `scrapeJobs`)
- Create: migration via `npm run db:generate -w apps/launcher` (`0020_*.sql` + meta)
- Create: `apps/launcher/src/main/scraper/batch/jobItems.ts`
- Modify: `apps/launcher/src/main/scraper/batch/jobStore.ts` (read `created_at`)
- Test: `apps/launcher/src/main/scraper/batch/jobItems.test.ts` (use the same in-memory library setup as `BatchScrapeService.test.ts`)

**Interfaces:**
- Consumes: `BatchItemOutcome`, `BatchJobItem`, `BatchItemsInput` (Task 1).
- Produces:
  - Drizzle table `scrapeJobItems`: `job_id` int notNull FK → `scrape_jobs.id` on delete cascade; `game_id` int notNull FK → `games.id` on delete cascade; `outcome` text enum `BATCH_ITEM_OUTCOMES` notNull; `provider` text nullable; `error` text nullable; `handled_at` text notNull. Primary key (`job_id`, `game_id`). Index `scrape_job_items_list` on (`job_id`, `outcome`, `handled_at`).
  - `class JobItems { constructor(db: LibraryDb); record(jobId: number, item: { gameId: number; outcome: BatchItemOutcome; provider: 'screenscraper' | 'launchbox' | null; error: string | null; handledAt: string }): void; page(jobId: number, input: BatchItemsInput): { items: BatchJobItem[]; next: { handledAt: string; gameId: number } | null }; count(jobId: number): number }`
  - `Job` gains `createdAt: string`, selected in `COLUMNS` as `created_at as createdAt`.

- [ ] **Step 1: Write failing tests**

```ts
describe('JobItems (FR-SCR-8)', () => {
  it('FR-SCR-8: record upserts per (job, game) and count counts rows', () => { /* record game 1 twice (review then applied) → count 1, page shows applied */ });
  it('FR-SCR-8: page is newest first, filters by outcome and joins title/systemId', () => { /* 3 items, outcome 'failed' filter → only the failed one with its error and title */ });
  it('FR-SCR-8: keyset paging never repeats a game, even with equal handledAt', () => {
    // 5 items, 3 sharing the same handledAt; limit 2 → follow `next` to the end:
    // collected gameIds have length 5 and no duplicates; last page next === null
  });
  it('FR-SCR-8: a deleted game drops out of the list through the cascade', () => { /* delete games row → count 0, page empty */ });
});
```

- [ ] **Step 2: Run it.** `npx vitest run apps/launcher/src/main/scraper/batch/jobItems.test.ts`. Expected: FAIL (the module does not exist).
- [ ] **Step 3: Add the Drizzle table, then run `npm run db:generate -w apps/launcher`.** Expected: a new `migrations/0020_*.sql` that creates `scrape_job_items` and its index.
- [ ] **Step 4: Implement `JobItems`.** Use the `ON CONFLICT (job_id, game_id) DO UPDATE` upsert, like `ScrapeRepository.set`. `page` joins `games` for `title`/`system_id`, orders by `handled_at desc, game_id desc`, keyset `where (handled_at, game_id) < (@handledAt, @gameId)`, fetches `limit + 1` to compute `next`. Add `createdAt` to `JobStore`.
- [ ] **Step 5: Run the tests.** Expected: PASS. Run `npm run typecheck`. Expected: clean.
- [ ] **Step 6: Commit** the schema, migration, repository and test. Message: `feat(launcher): scrape_job_items records each game a batch handles (FR-SCR-8)`

---

### Task 3: Service records items, resume flag, details and items handlers

**Files:**
- Modify: `apps/launcher/src/main/scraper/batch/BatchScrapeService.ts` (`advance`, `handle`, `onError`, `restore`, `status`)
- Create: `apps/launcher/src/main/scraper/batch/batchDetails.ts` (builds `BatchJobDetails` so the service doesn't grow)
- Modify: `apps/launcher/src/main/scraper/batch/batchHandlers.ts` (replace the Task 1 stubs)
- Test: `apps/launcher/src/main/scraper/batch/BatchScrapeService.details.test.ts`, `batchHandlers.test.ts`

**Interfaces:**
- Consumes: `JobItems` and `Job.createdAt` (Task 2); the contracts (Task 1).
- Produces:
  - `advance(gameId: number, tally: Tally | null, source?: { provider: 'screenscraper' | 'launchbox' | null; error: string | null })`. It writes `JobItems.record` (outcome = `tally ?? 'skipped'`) and `store.save` inside one `db.$client.transaction(...)()`.
  - `BatchScrapeService.details(): BatchJobDetails | null` and `BatchScrapeService.items(input: BatchItemsInput): BatchItemsPage`. `items` returns `{ items: [], next: null }` when there's no job.
  - `status()` adds `startedAt: job.createdAt` and `resumedAt`. `resumedAt` is the clock time captured in `restore()` when it picked up a job; it is null for a job begun this session.
  - `createBatchHandlers` deps pick adds `'details' | 'items'`. Handlers: `'scraper.batch.details': () => deps.batch().details()`, `'scraper.batch.items': (input) => deps.batch().items(input)`.

Provider and error per path in `handle`/`onError`:
- ScreenScraper applied: provider `screenscraper`.
- LaunchBox filled (`filled === 'applied'`): provider `launchbox`.
- Review from LaunchBox (`filled === 'review'` after notFound): provider `launchbox`.
- Review or notFound from ScreenScraper: provider `screenscraper`.
- Failed from `unsaved`: error `'MEDIA_WRITE'`. Failed from `result.game.scrape.status === 'failed'`: `result.game.scrape.error`.
- Failed in `onError`: the error `code`. Skipped (`advance(gameId, null)`): provider `null`.

- [ ] **Step 1: Write failing tests.** Reuse the fakes in `BatchScrapeService.test.ts` and `.launchbox.test.ts`; extract a shared `testDeps.ts` helper if both need it.

```ts
describe('BatchScrapeService details (FR-SCR-8)', () => {
  it('FR-SCR-8: every handled game gets an item with outcome and provider', async () => {
    // games: 1 applied (screenscraper), 2 review, 3 notFound, 4 needs nothing → skipped
    // items(): outcomes {1:'applied',2:'review',3:'notFound',4:'skipped'}; provider of 4 is null
  });
  it('FR-SCR-8: a LaunchBox fill is recorded with provider launchbox', async () => { /* … */ });
  it('FR-SCR-8: an unexpected error is recorded failed with its code', async () => { /* item.error === 'INTERNAL' */ });
  it('FR-SCR-8: details() returns scope, rules, startedAt and listed; null when idle', async () => {});
  it('FR-SCR-8: details() still answers for a cancelled job', async () => { /* cancel → details().status.state === 'finished', listed > 0 */ });
  it('US-C8: restore() marks the job resumed; begin() does not', async () => {
    // restore a running row → status().resumedAt === clock ISO; new service.begin → resumedAt null
  });
  it('FR-SCR-8: a quota pause writes no item for the retried game', async () => { /* item count === done */ });
});
```

Add to `batchHandlers.test.ts`: `'FR-SCR-8: details and items are routed to the service'`.

- [ ] **Step 2: Run them.** `npx vitest run apps/launcher/src/main/scraper/batch`. Expected: the new tests FAIL.
- [ ] **Step 3: Implement as specified in Interfaces.** Wire `JobItems` into the service constructor (`new JobItems(deps.db)`), and add `details`/`items` to the service type `startLibrary.ts` passes to the handlers (`handlers.ts`) if it narrows it.
- [ ] **Step 4: Run them.** Expected: all `apps/launcher/src/main/scraper/batch` tests PASS. Run `npm run typecheck`. Expected: clean.
- [ ] **Step 5: Commit.** `feat(launcher): batch records per-game results and serves job details (FR-SCR-8)`

---

### Task 4: Renderer hooks and the strip

**Files:**
- Modify: `apps/launcher/src/renderer/features/scrape/batchApi.ts`
- Modify: `apps/launcher/src/renderer/features/scrape/BatchProgress.tsx`
- Modify: `packages/shared/src/i18n/en.json`, `pt-BR.json` (`library.batch.*`)
- Test: `apps/launcher/src/renderer/features/scrape/BatchProgress.test.tsx`

**Interfaces:**
- Consumes: IPC `scraper.batch.details` / `scraper.batch.items`; `BatchStatus.startedAt` / `resumedAt` (Task 3).
- Produces:
  - `useBatchDetails(enabled: boolean)`: `useQuery` keyed `['scraper.batch.details', jobId]`.
  - `useBatchItems(outcome: BatchItemOutcome | undefined, enabled: boolean)`: `useInfiniteQuery` keyed `['scraper.batch.items', jobId, outcome ?? 'all']`, `getNextPageParam: (page) => page.next ?? undefined`.
  - `useBatchStatus` additionally invalidates `['scraper.batch.items']` and `['scraper.batch.details']` on each `scraper.batch.progress` event. Only active (enabled) queries refetch.
  - `BatchProgress` new prop `onOpenDetails?: () => void`. When set, the status text is a `<button>` with accessible name `t('library.batch.openDetails')` = "Show scrape details" wrapping the visible text. Pause, Cancel and the other buttons stay outside it.
  - `scopeLabel(status: BatchStatus, nameOf: (id: string) => string, t): string` in `features/scrape/batchScope.ts`: one system → its name; several → `library.batch.scopeSystems` "{{count}} systems"; `systemIds === null` → `library.batch.scopeSelection` "selected games".

Copy (en; translate the same keys in pt-BR):
- `running`: "Scraping {{scope}} {{done}}/{{total}} · applied {{applied}} · review {{review}}"
- `resumed`: "Resumed · started {{date}}". Shown before the running text while `resumedAt` is set and the user hasn't clicked or dismissed it in this session. Track that with a module-level `Set<jobId>` in `BatchProgress`. *My call (spec):* show it until clicked instead of a 10-second timer, because a timer flashes by when the Library opens later.
- `openDetails`: "Show scrape details"
- `scopeSystems_one/_other`, `scopeSelection`

Gemini keeps its own `library.geminiBatch.running` text, so the scope label is scrape-only.

- [ ] **Step 1: Update the existing BatchProgress tests' expected strings to the scoped text**, e.g. `'Scraping Super Nintendo 5/5 · applied 2 · review 1'` (add a `snes` entry to the fake system catalog in `setup`). Then add:

```ts
it('US-C8: the strip names the system it scrapes', async () => { /* 'Scraping Super Nintendo 3/10 · applied 2 · review 1' */ });
it('US-C8: a selection job reads "selected games"', async () => { /* systemIds: null → 'Scraping selected games 3/10 …' */ });
it('US-C8: a job resumed after a restart says so with its start date', async () => { /* resumedAt + startedAt → text /^Resumed · started / */ });
it('US-C8: clicking the status text opens the details', async () => { /* click 'Show scrape details' → onOpenDetails called once */ });
```

- [ ] **Step 2: Run them.** `npx vitest run apps/launcher/src/renderer/features/scrape/BatchProgress.test.tsx`. Expected: FAIL.
- [ ] **Step 3: Implement the hooks, `scopeLabel`, the strip changes and the i18n keys.** System names come from `useSystemCatalog()` (`features/settings/settingsApi.ts`), with `?? id` as the fallback, as in `ScanPanel`.
- [ ] **Step 4: Run the scrape feature tests** (`npx vitest run apps/launcher/src/renderer/features/scrape`) plus `packages/shared/src/i18n/locales.test.ts`. Expected: PASS. Update other tests that assert the old running text (`ScrapeMenu.test.tsx`, `LibraryBatch.test.tsx`) to the scoped text.
- [ ] **Step 5: Commit.** `feat(launcher): batch strip names its scope and opens details (FR-SCR-8)`

---

### Task 5: The details panel

**Files:**
- Create: `apps/launcher/src/renderer/features/scrape/details/BatchDetailsPanel.tsx` (drawer shell, header, progress, actions)
- Create: `.../details/BatchRulesSummary.tsx` (collapsible rules line)
- Create: `.../details/BatchItemList.tsx` (filter chips and infinite list)
- Modify: `apps/launcher/src/renderer/features/scrape/ScrapeMenu.tsx` (holds `detailsOpen` state, passes `onOpenDetails` to the scrape `BatchProgress`, renders the panel)
- Modify: `apps/launcher/src/renderer/features/scrape/BatchProgress.tsx`: extract the paused-reason text and the Pause/Resume/Cancel/Open Settings buttons into `BatchControls.tsx` so the panel reuses them, not copies them.
- Modify: `apps/launcher/src/renderer/features/library/LibraryApp.tsx` (`onOpenGame` for ScrapeMenu)
- Modify: i18n `library.batch.details.*`
- Test: `.../details/BatchDetailsPanel.test.tsx`

**Interfaces:**
- Consumes: `useBatchStatus`, `useBatchDetails`, `useBatchItems`, `scopeLabel` (Task 4).
- Produces: `BatchDetailsPanel({ onClose, onShowReview, onOpenGame }: { onClose: () => void; onShowReview?: (systemIds: string[] | null) => void; onOpenGame: (game: { gameId: number; title: string }) => void })`. `ScrapeMenu` gains the prop `onOpenGame`.

Layout and behavior (from the spec's sketch):
- `role="dialog"`, `aria-label` = "Scrape · {scope}". Right-side drawer styled like the Health `aside` (`w-96 border-l border-white/5 bg-[#111115]`), absolutely positioned over the Library body. Esc and the ✕ button call `onClose`.
- Header line: state (Running / Paused: {reason text} / Finished) · "started {date time}" · "resumed {date time}" when `resumedAt` is set.
- A `<progress value={done} max={total}>`, plus count text: "Applied {applied} ({launchbox} LaunchBox) · Review {review} · Not found {notFound} · Failed {failed} · Nothing to fill {skipped}". `skipped = max(0, done − applied − review − notFound − failed)`, computed in the renderer.
- "Now: {current.title}" while running.
- `BatchControls`, plus **Show Needs review** when `review > 0` (calls `onShowReview(status.systemIds)` and `onClose`).
- `BatchRulesSummary`: a `<details>` element labelled "Rules". Inside: only missing yes/no; art kinds and fields (existing art-kind and field i18n labels from the rules dialog); regions; "then LaunchBox" when on.
- `BatchItemList`: chips All / Applied / Review / Not found / Failed / Nothing to fill (`aria-pressed`). Rows show title, the outcome as text (not colour alone), source (ScreenScraper / LaunchBox), the error via `errorMessageKey`-style lookup falling back to the code, and the time. When the last row is visible (IntersectionObserver), it loads the next page. Clicking a row calls `onOpenGame` and `onClose`.
- Notice when `details.listed < status.done`: "Games handled before this update aren't listed."
- `LibraryApp` `onOpenGame`: `setSearchText(game.title); setSearchPick(game.gameId)`. This reuses global search, which lists the game across systems and shows its details. *(My call: the Library has no "open game by id" navigation; search-pick is the existing path.)*

- [ ] **Step 1: Write failing tests** with `installFakeBridge` (`scraper.batch.status`, `.details`, `.items`) and `renderInShell`:

```ts
describe('BatchDetailsPanel (FR-SCR-8, US-C8)', () => {
  it('US-C8: shows scope, start time, counts including Nothing to fill, and the current game', async () => {});
  it('US-C8: lists handled games newest first with outcome and source', async () => {});
  it('US-C8: the Failed chip asks items with outcome failed and shows the error', async () => { /* bridge call input.outcome === 'failed' */ });
  it('US-C8: a job older than this update says earlier games are not listed', async () => { /* listed 0, done 24 */ });
  it('US-C8: rules summary lists art kinds, regions and then LaunchBox', async () => {});
  it('US-C8: Esc closes; clicking a game opens it and closes', async () => {});
  it('US-C8: Pause in the panel pauses the job', async () => { /* calls scraper.batch.pause once */ });
});
```

- [ ] **Step 2: Run them.** `npx vitest run apps/launcher/src/renderer/features/scrape/details`. Expected: FAIL.
- [ ] **Step 3: Implement the panel, the `BatchControls` extraction, the ScrapeMenu/LibraryApp wiring and the i18n keys.**
- [ ] **Step 4: Run** `npx vitest run apps/launcher/src/renderer` and the i18n parity test. Expected: PASS. The existing `BatchProgress`/`ScrapeMenu` tests must still pass after the `BatchControls` extraction.
- [ ] **Step 5: Commit.** `feat(launcher): batch scrape details panel (FR-SCR-8, US-C8)`

---

### Task 6: Docs and full verification

**Files:**
- `docs/01-product/02-product-requirements.md`: add the FR-SCR-8 row after FR-SCR-7, with the spec's wording, priority S.
- `docs/01-product/03-user-stories.md`: add **US-C8 See what a batch scrape is doing · FR-SCR-8** after US-C7, with acceptance criteria: the strip names the scope; it says Resumed with the start date after a restart; clicking opens the panel with state, start time, rules, current game, counts and the per-game list with filters; Pause/Resume/Cancel/Show Needs review work there; jobs from before the update show counts with a note.
- `docs/03-architecture/data-model.md`: `scrape_job_items`.
- `docs/03-architecture/05-architecture.md`: the IPC channels `scraper.batch.details` and `scraper.batch.items` (wherever `scraper.batch.*` is listed).
- `docs/02-design/screen-specifications.md` S7: a bullet on the strip and the panel, with the spec's sketch.
- `CHANGELOG.md` (Unreleased) and the roadmap status line for FR-SCR-8.

- [ ] **Step 1: Write the doc changes above.**
- [ ] **Step 2: Run** `npm run lint`, `npm run typecheck` and `npm test`. Expected: all three exit 0. Keep the output for the PR description.
- [ ] **Step 3: Launch** `npm run dev`. With a batch job active, check the strip text, the click-through, the live list growing and Esc closing the panel. Report what was seen; if it couldn't be run, say so.
- [ ] **Step 4: Commit.** `docs: batch scrape job details (FR-SCR-8, US-C8)`
