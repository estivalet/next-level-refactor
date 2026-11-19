# Batch scrape job details panel — design

Date: 2026-11-19 · Status: draft, awaiting owner approval · Proposed IDs: **FR-SCR-8**, **US-C8**

## Intent

The batch scrape strip in the Library header ("Scraping 24/753 · applied 15 · review 6 · 9 from
LaunchBox") says a job exists but not what it is. A job survives restarts (US-C6), so the owner
can open the launcher days later and find a job running with no way to tell which system it
covers, what it was told to do, or what happened to each game. The owner wants to click the strip
and see the job in detail.

## Goals

- The strip names the job's scope ("Scraping Nintendo Switch 24/753 …").
- The strip says once when a job was resumed after a restart.
- Clicking the strip opens a details panel showing:
  - the scope, state (and pause reason / resume time) and start time
  - progress split by outcome, plus the game being scraped right now
  - the rules the job was started with
  - **every game the job has handled**, with its outcome, source and error, filterable by outcome
- Pause / Resume / Cancel / Show Needs review are available in the panel too.

## Non-goals

- Time remaining. The owner decided it isn't worth estimating.
- Job history (past jobs), Retry failed, and editing rules of a running job. The data model below
  makes these possible later.
- The Gemini batch (FR-SCR-7). It shares `BatchStatus` but not this panel for now (*my call*:
  keeps the change small; the panel takes a `kind` prop like `BatchProgress` so Gemini can follow).

## Anti-goals

- The panel must not slow the batch down or hit the disk or network. It reads only the library DB.
- No hand-edited config, and no new settings.

## Approaches considered

- **A. Recent activity only:** the last ~50 `scrape_status` rows in the job's systems since it
  started. No DB change, but not a full list, and manual scrapes get mixed in. *Rejected.*
- **B. Full per-job list (chosen by owner).** Every game the job handled, with filters.

**How B is built (my call, refining the option the owner picked).** `scrape_status` holds only a
game's *latest* scrape and is overwritten by a manual scrape, Gemini, or a later job. A `job_id`
column there would make games silently drop out of the job's list. So per-job results go in a
**new table `scrape_job_items`**, written at the single point where the service finishes a game
(`BatchScrapeService.advance`), in the same transaction as the job counters.

## Design

### Data (library DB, `apps/launcher/src/main/library/schema.ts`)

`scrape_job_items`:

| column | type | notes |
|---|---|---|
| job_id | int FK → scrape_jobs.id, cascade | |
| game_id | int FK → games.id, cascade | |
| outcome | enum `applied` · `review` · `notFound` · `failed` · `skipped` | `skipped` = nothing to fill (today's `advance(gameId, null)`) |
| provider | `screenscraper` · `launchbox` · null | who wrote / proposed; null for skipped |
| error | text null | error code for `failed` |
| handled_at | text (ISO) | |

The primary key is (job_id, game_id), upserted, so a game retried after a crash is not counted
twice. There is an index on (job_id, outcome, handled_at). Jobs started before the migration have
no items. The panel then says "Games handled before this update aren't listed" and still shows the
counters.

### Contract (`packages/shared`)

- `BatchJobItemSchema`: `{ gameId, title, systemId, outcome, provider, error, handledAt }`.
- `BatchJobDetailsSchema`: `{ status: BatchStatus, rules: BatchRules, scope: BatchScope,
  createdAt, updatedAt, skipped: count, resumedAt: string | null }`.
- IPC `scraper.batch.details`: input void → `BatchJobDetails | null` (null when idle).
- IPC `scraper.batch.items`: input `{ outcome?: outcome, cursor?: { handledAt, gameId },
  limit ≤ 200 }` → `{ items, next }`. Newest first, keyset-paged.
- `BatchStatus` gains `skipped` and `resumedAt`. `resumedAt` is set when a job left running or
  paused at the last quit is picked up at startup, and cleared once the panel or strip has shown
  it (*my call*: a renderer-side "seen" flag per jobId in memory is enough; no persistence).

### Strip (`BatchProgress.tsx`)

- Running text becomes "Scraping {scope} {done}/{total} · applied … · review …". `{scope}` is the
  system name (one system), "{n} systems", or "{n} selected games".
- After a restart it shows "Resumed · started {date}" for the first ~10 s or until clicked.
- The whole status text becomes a button ("Show scrape details") that opens the panel. Buttons
  inside stay as they are.

### Panel (new `features/scrape/BatchDetailsPanel.tsx`)

A right-side drawer over the Library (*my call*: same width/feel as the Health side panel; Esc
or ✕ closes; it stays open while the job runs and updates from `scraper.batch.progress`).

```
┌ Scrape · Nintendo Switch ─────────────────────── ✕ ┐
│ Running · started 17 Nov 21:04 · resumed today      │
│ ███████▓▓▓░░·································  24/753  │
│ Applied 15 (9 LaunchBox) · Review 6 · Not found 2   │
│ Failed 0 · Nothing to fill 1                        │
│ Now: Mario Kart 8 Deluxe                            │
│ [Pause] [Cancel] [Show Needs review]                │
│ ▸ Rules: only missing · box, screenshot, video ·    │
│          description, genre · regions us, eu, wor · │
│          then LaunchBox                             │
│ [All] [Applied] [Review] [Not found] [Failed]       │
│ ✓ Zelda: Tears of the Kingdom   ScreenScraper 21:40 │
│ ? Astral Chain                  LaunchBox     21:39 │
│ ✗ Some Game        SCRAPER_NETWORK            21:38 │
│ …                               (loads more on scroll)
└─────────────────────────────────────────────────────┘
```

- Clicking a game opens it in the Library (its system scope, game selected) and closes the panel.
- Paused shows the reason text plus Resume / Open Settings exactly as the strip does today.
- After the job finishes, the panel shows the final summary until a new job starts. That matches
  what the strip already does with `finished`.
- Errors are shown through the existing i18n error keys, never raw codes alone (*my call*).

## Constraints

- Contracts first: schemas in `packages/shared` before main/renderer code.
- The migration comes from `npm run db:generate -w apps/launcher` and is committed.
- Item writes share a transaction with the job counter update.
- All strings go through i18n. Keep files under 400 lines; the panel splits into header / rules / item list.
- Tests are named FR-SCR-8 / US-C8. Write them first for the repository, service and IPC handler.

## Docs to update in the change

- PRD: FR-SCR-8 "Batch job details: the strip names the job's scope and says when it resumed
  after a restart; clicking it opens a panel with the job's state, rules, current game and every
  game it handled with its outcome." (S)
- Stories: US-C8 "See what a batch scrape is doing" with the acceptance criteria above.
- Data model (`scrape_job_items`), IPC section of the architecture doc, S7 screen spec,
  CHANGELOG (Unreleased), roadmap status.

## Left to the builder

- Exact drawer styling and the outcome icons and colours (match Health and BatchProgress).
- Page size and scroll-loading mechanics.
- How "Open the game in the Library" navigates, using the existing scope-view navigation.
