# Gemini Fill Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Gemini fills a game's missing details (single game and batch, Review or Auto-update)
through a free API key, with a Selenium website tool as a fallback; unknown stays unknown.

**Architecture:**
- A `GeminiClient` (plain REST `fetch`, no SDK) sends structured-output requests;
  `checks.ts` turns every raw answer into a checked `GeminiAnswer` (anything doubtful becomes
  unknown).
- A `GeminiService` asks for one game, keeps the answer in `gemini_answers` (so Needs review
  reopens it without a request), and applies through the existing `writeScrape` with provider
  `gemini`.
- A `GeminiBatchService` reuses `nextGame`/`countGames` and a source-aware `JobStore` on
  `scrape_jobs`. Its answers come from the client (route `api`) or from the Python tool's
  `results.jsonl` (route `web`); both go through the same checks and apply code.

**Tech Stack:** Electron main (Node 24), better-sqlite3 + Drizzle migrations, React 19 + TanStack
Query, zod, vitest, Playwright; Python 3 + Selenium + pytest for `tools/gemini-web/`.

**Spec:** `docs/superpowers/specs/2026-11-03-gemini-fill-design.md` (section numbers below refer
to it).

## Global Constraints

- **Unknown stays unknown:** a field is only shown or saved when it passed `checkAnswer` (§6).
- **Title is never written by a batch** and is never ticked at first (§5, D19).
- **Only empty, unlocked fields** are asked in a batch or ticked at first in the dialog.
- **Fields:** `description`, `year`, `developer`, `publisher`, `genre`, `players`; plus the
  `title` suggestion. Never `rating`, never art.
- **No money:** no billing UI; a daily quota refusal pauses (`gemini-quota`), it never retries in
  a loop.
- **D50:** everything is written under `<data>\gemini\` (job folders) or `library.db`; the
  tool's driver lives in `tools/gemini-web/` or the data folder, never `~/.wdm`.
- The API key lives only in the secret store (`gemini.apiKey`); never in settings, logs, tests or
  the tool's request file.
- No test touches the network or a real browser.
- Answer checks (§6), exact: year 4 digits, 1950 ≤ year ≤ current year; players
  `^\d{1,2}(-\d{1,2})?$`, max 16; developer/publisher/genre ≤ 100 chars; description 1–600
  chars; fillers (`unknown`, `n/a`, `na`, `none`, `?`, `-`, `tbd`, case-insensitive) = unknown;
  a description that starts like a refusal (`I'm sorry`, `I cannot`, `I don't have`,
  `As an AI`) = unknown.
- Temperature 0. Batch request size `GEMINI_BATCH_SIZE = 10` games.
- Quota reset: the next midnight in `America/Los_Angeles` (Google's free daily reset).
- Spawn the tool with an argv array and `shell: false`.
- Never run Prettier on `docs/*.md`.
- Workflow: three PRs — **(a)** Tasks 1–5, **(b)** Tasks 6–7, **(c)** Tasks 8–10; lint +
  typecheck + `CI=1 npm test` (+ `pytest tools/gemini-web` for (c)) before each PR; one fresh
  reviewer per PR when the owner asks for one.

## Review Focus

1. **A batch answer that names no game, the wrong id, or the same id twice.** Expected: only
   answers whose `gameId` is in the request are used, the first one wins, and a game with no
   answer counts `notFound` (not applied, not failed). Test in Task 6.
2. **The reply wraps its JSON in prose or code fences** (always on the website route, sometimes
   with grounding on). Expected: `parseReply` finds the JSON; unparsable text fails that request
   (`failed` for its games), never crashes the batch. Test in Task 2.
3. **The user fills a field between "ask" and "apply"** (stored answer in Needs review, or the
   dialog open). Expected: the dialog shows the new current value and doesn't tick it; a batch
   Auto-update re-reads the game and writes only fields still empty. Test in Task 4.
4. **Quota runs out halfway through a batch request.** Expected: those games are not advanced
   (cursor unchanged), the job pauses `gemini-quota` with `resumeAt` = next LA midnight, and a
   restart before then waits instead of asking. Test in Task 6.
5. **The website tool can't start or dies** (no Python, bad path, Firefox open, crash after 3
   games). Expected: the job pauses `webTool` with the tool's stderr tail logged; the 3 answered
   games are applied; the next start of the launcher picks up a left-over job folder. Test in
   Task 9.

---

## PR (a): key, client, checks, single game

### Task 1: Shared contracts

**Files:**
- Modify: `packages/shared/src/scraper/schema.ts` (`SCRAPE_PROVIDERS` += `'gemini'`;
  `ScraperSettingsSchema` += `gemini`)
- Create: `packages/shared/src/scraper/gemini.ts`
- Create: `packages/shared/src/ipc/geminiContract.ts` (merged into the contract like
  `launchboxContract.ts`)
- Modify: `packages/shared/src/errors.ts`, `packages/shared/src/index.ts`,
  `packages/shared/src/i18n/en.json`, `pt-BR.json` (error messages)
- Test: `packages/shared/src/scraper/gemini.test.ts`

**Interfaces:**
- Produces (all in `gemini.ts`):
  - `GEMINI_FIELDS = ['description','year','developer','publisher','genre','players'] as const`,
    `type GeminiField`.
  - `GeminiFieldAnswerSchema = { known: boolean, value: string | number | null }` (value null
    when not known).
  - `GeminiSourceSchema = { title: string, url: string (https only) }`.
  - `GeminiAnswerSchema = { gameId, route: 'api'|'web', fields: Partial<Record<GeminiField,
    GeminiFieldAnswer>>, title: string | null, sources: GeminiSource[], askedAt: string }`.
  - `GeminiSettingsSchema` inside `ScraperSettingsSchema.gemini` with defaults
    `{ model: GEMINI_DEFAULT_MODEL, grounding: true, webTool: { python: '', firefoxProfile: '',
    driver: '' } }`; `GEMINI_DEFAULT_MODEL` = the free-tier Flash model id the builder confirms in
    AI Studio at build time (record the date in a comment).
  - `GeminiDialogViewSchema = { answer: GeminiAnswer, preview: ScrapePreview }` (preview `art`
    is `{}`; `fields[f].scraped` is the checked value or null).
  - `GeminiKeyStatusSchema = { available: boolean, set: boolean }`.
  - `GeminiBatchRulesSchema = { fields: GeminiField[] (min 1), mode: 'review'|'auto',
    route: 'api'|'web' }`.
  - Web-tool files: `GeminiWebRequestSchema = { jobId, fields, language, games: Array<{ gameId,
    system, title, file, known: Partial<Record<GeminiField,string|number>> }> }`,
    `GeminiWebResultLineSchema = { gameId, reply: string }` (the raw reply; checks run in main).
- IPC (`geminiContract.ts`): `gemini.key.status` → `GeminiKeyStatus`; `gemini.key.set`
  `{ apiKey: string | null }` → `GeminiKeyStatus`; `gemini.test` → `{ ok: true }`;
  `gemini.ask` `{ gameId, allFields?: boolean }` → `GeminiDialogView`; `gemini.stored`
  `{ gameId }` → `GeminiDialogView | null`; `gemini.apply` `{ gameId, fields: ScrapeField[] }`
  → `ScrapeApplyResult` (`title` allowed here only); `gemini.dismiss` `{ gameId }` → void.
- Error codes: `GEMINI_NO_KEY`, `GEMINI_KEY_REJECTED`, `GEMINI_QUOTA`, `GEMINI_NETWORK`,
  `GEMINI_BAD_REPLY`, `GEMINI_NO_ANSWER` (stored answer missing at apply).

- [ ] **Step 1: Write the failing tests** `FR-SCR-7: …` in `gemini.test.ts`: settings parse `{}`
  to the defaults above; `GeminiBatchRulesSchema` rejects `fields: []` and `'rating'`/`'title'`;
  `GeminiSourceSchema` rejects `http://` and `javascript:`; `ScrapeProviderSchema.parse('gemini')`
  passes; `gemini.apply` input rejects `rating`.
- [ ] **Step 2: Run** `npx vitest run packages/shared/src/scraper/gemini.test.ts` → FAIL.
- [ ] **Step 3: Implement** the schemas, contract, error codes and their en/pt-BR messages.
- [ ] **Step 4: Run** the test → PASS; `npm run typecheck` → clean (fix any exhaustive switch on
  `ScrapeProvider`, e.g. `scrapeKey`).
- [ ] **Step 5: Commit** `feat(shared): Gemini fill contracts (FR-SCR-7)`.

### Task 2: Prompt, reply parsing and checks

**Files:**
- Create: `apps/launcher/src/main/gemini/prompt.ts`, `apps/launcher/src/main/gemini/checks.ts`
- Test: `apps/launcher/src/main/gemini/prompt.test.ts`, `apps/launcher/src/main/gemini/checks.test.ts`

**Interfaces:**
- Produces:
  - `interface PromptGame { gameId: number; system: string; title: string; file: string;
    known: Partial<Record<GeminiField, string | number>> }`
  - `buildPrompt(games: PromptGame[], fields: GeminiField[], language: string): string`
  - `responseSchema(fields: GeminiField[]): object` (Gemini `responseSchema`: an array of
    `{ gameId: integer, title: {known, value}, <field>: {known, value} }`)
  - `parseReply(text: string): unknown[] | null` (strips code fences/prose, first JSON array)
  - `checkAnswer(raw: unknown, game: { gameId: number; title: string }, fields: GeminiField[],
    now: Date): Pick<GeminiAnswer, 'fields' | 'title'>`

- [ ] **Step 1: Write the failing tests:**
  - `buildPrompt` contains the system, title, file name and known values of each game, the line
    `never guess; a wrong value is worse than none`, the language name, and asks only `fields`.
  - `parseReply('```json\n[{"gameId":1}]\n```')` → `[{gameId:1}]`; prose before/after → same;
    `'no json here'` → `null`.
  - `checkAnswer`: each Global Constraints rule as a table test (`1949`, `2099`, `"19xx"`,
    `"1-2"` ok, `"17"`, `"one"`, `"N/A"`, `"Unknown"`, a 601-char description, `"I'm sorry, …"`)
    → `{ known: false, value: null }`; good values pass through trimmed; `known: true` with a
    null value → unknown; a field not in `fields` is dropped; title suggestion equal to the
    current title ignoring case/punctuation → `null`.
- [ ] **Step 2: Run** `npx vitest run apps/launcher/src/main/gemini` → FAIL.
- [ ] **Step 3: Implement** both files (pure, no I/O).
- [ ] **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `feat(launcher): Gemini prompt and answer checks (FR-SCR-7)`.

### Task 3: Gemini client

**Files:**
- Create: `apps/launcher/src/main/gemini/GeminiClient.ts`
- Modify: `apps/launcher/src/main/secrets/SecretStore.ts` (`SecretKey` += `'gemini.apiKey'`)
- Test: `apps/launcher/src/main/gemini/GeminiClient.test.ts`

**Interfaces:**
- Consumes: `buildPrompt`, `responseSchema`, `parseReply` (Task 2).
- Produces:
  - `GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta'`
  - `class GeminiClient { constructor(deps: { fetch: typeof fetch; key: () => Promise<string |
    null>; settings: () => GeminiSettings; baseUrl?: string; sleep: (ms) => Promise<void> });
    ask(games: PromptGame[], fields: GeminiField[], language: string): Promise<{ items:
    unknown[]; sources: GeminiSource[] }>; test(): Promise<void> }`
  - Throws `AppErrorException` with: no key → `GEMINI_NO_KEY`; 400 `API_KEY_INVALID` / 401 /
    403 → `GEMINI_KEY_REJECTED`; 429 whose details name a per-day quota → `GEMINI_QUOTA`;
    fetch rejecting → `GEMINI_NETWORK`; unparsable → `GEMINI_BAD_REPLY`.

- [ ] **Step 1: Write the failing tests** with a fake `fetch`:
  - the request goes to `${baseUrl}/models/${model}:generateContent`, key in the
    `x-goog-api-key` header (never the URL), `temperature: 0`;
  - grounding off → `responseMimeType: 'application/json'` + `responseSchema`; grounding on →
    `tools: [{ google_search: {} }]` and the reply parsed with `parseReply` (structured output and
    Search may not combine on the chosen model; the builder confirms and keeps whichever works);
  - grounding metadata `groundingChunks[].web` → `sources` (https only, deduplicated);
  - 429 with `retryDelay: "7s"` and a per-minute quota → sleeps 7 000 ms, retries once, then
    succeeds; per-day quota → `GEMINI_QUOTA` without retry;
  - each error mapping above.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement.** **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `feat(launcher): Gemini API client (FR-SCR-7)`.

### Task 4: Gemini service, stored answers, handlers

**Files:**
- Modify: `apps/launcher/src/main/library/schema.ts` (table `gemini_answers`: `game_id` PK FK
  cascade, `answer` text JSON, `asked_at` text) + `npm run db:generate -w apps/launcher`
  (migration 0014), then delete `node_modules/.vitest-cache`
- Create: `apps/launcher/src/main/gemini/AnswerStore.ts`, `GeminiService.ts`,
  `geminiHandlers.ts`
- Modify: `apps/launcher/src/main/startLibrary.ts`, `handlers.ts` (wire), dev-only env
  `NEXTLEVEL_GEMINI_URL` → `baseUrl` (like `launchboxDev`)
- Test: `GeminiService.test.ts`, `geminiHandlers.test.ts`

**Interfaces:**
- Consumes: `GeminiClient`, `checkAnswer`, `writeScrape` (`apps/launcher/src/main/scraper/writeScrape.ts`).
- Produces:
  - `class AnswerStore { get(gameId): GeminiAnswer | null; set(answer): void; delete(gameId):
    void }`
  - `class GeminiService { ask(gameId, allFields?): Promise<GeminiDialogView>; stored(gameId):
    GeminiDialogView | null; apply(gameId, fields: ScrapeField[], opts?: { batch: boolean }):
    Promise<ScrapeApplyResult>; dismiss(gameId): void; record(answer: GeminiAnswer, mode:
    'review'|'auto', fields: GeminiField[]): Promise<'applied'|'review'|'notFound'> }`
  - The description language passed to `buildPrompt` = the first entry of
    `settings.scraper.languagePriority`, else the app language, else English (spec §6).
  - `record` is what the batch (both routes) calls: stores the answer; `auto` applies only
    fields that are still empty and unlocked now (never title) and, when
    `settings.gemini.grounding` was on for this answer and `sources` is empty, sends it to review
    instead; no known field → `notFound`.
  - Scrape status: review → `{ provider: 'gemini', status: 'review' }`; apply → `writeScrape`
    with `provider: 'gemini'`, `providerGameId: null`-safe (pass `0` only if the column demands
    it; prefer making `providerGameId` optional in `WriteScrapeInput`), `kinds: []`.

- [ ] **Step 1: Write the failing tests** (`FR-SCR-7: …`, fake client):
  - `ask` sends only empty unlocked fields (+ title), stores the answer, returns a preview whose
    unknown fields have `scraped: null`;
  - `ask(…, true)` sends all six;
  - `stored` returns the saved answer without calling the client;
  - `apply` writes ticked fields, keeps D19 locks, deletes the stored answer, status
    `scraped`/`gemini`; `apply` without a stored answer → `GEMINI_NO_ANSWER`;
  - **Review Focus 3:** answer stored with year 1991, the user then sets year 1990, `record(…,
    'auto')` leaves 1990; `stored` shows current 1990;
  - `record` auto with grounding on and no sources → review; title never written by `record`;
  - `dismiss` deletes the answer and clears a gemini review status.
- [ ] **Step 2: Run** `npx vitest run apps/launcher/src/main/gemini` → FAIL.
- [ ] **Step 3: Implement**, wire into `startLibrary.ts` and the handler map; key handlers
  mirror `credentialHandlers.ts`.
- [ ] **Step 4: Run** → PASS; `npx vitest run apps/launcher/src/main/handlers` → PASS.
- [ ] **Step 5: Commit** `feat(launcher): Gemini service and stored answers (FR-SCR-7)`.

### Task 5: Settings section, dialog, menu entry

**Files:**
- Create: `apps/launcher/src/renderer/features/settings/scraper/GeminiPanel.tsx`,
  `geminiApi.ts`
- Create: `apps/launcher/src/renderer/features/scrape/GeminiDialog.tsx`
- Modify: `ScraperSection.tsx` (panel), `LibraryOverlays.tsx` (menu key `fillGemini`, label
  `library.menu.fillGemini` = "Fill details with Gemini…"), Needs review opening (a `gemini`
  review opens `GeminiDialog` with `gemini.stored`), `providerText.ts` (`library.scrape.gm.*`:
  `title` "Fill details with Gemini: {{title}}", `notAvailable` "Gemini doesn't know",
  `asking` "Asking Gemini…"), `DetailsArt.tsx` ("Scraped <date> from Gemini"), en/pt-BR
- Test: `GeminiPanel.test.tsx`, `GeminiDialog.test.tsx`

**Interfaces:**
- Consumes: the IPC of Task 1; `PreviewTable` with `provider="gemini"` (art section hidden when
  `art` is `{}`).

- [ ] **Step 1: Write the failing tests:**
  - panel: key "Not set" → type + Save calls `gemini.key.set`; Test shows OK / "Key rejected" /
    "Daily limit reached"; help text links `https://aistudio.google.com/apikey` and says not to
    add billing; model select; grounding toggle; web tool paths (Python, Firefox profile,
    driver) saved through settings;
  - dialog: no key → message + "Open Settings"; answers render; unknown rows disabled with
    "Gemini doesn't know"; empty fields with an answer ticked, filled ones and the title
    unticked; **Ask about all fields** re-asks with `allFields: true`; sources listed as links;
    Apply sends ticked fields; quota error shows "try again tomorrow, or use the Gemini website
    tool";
  - opening from Needs review uses `gemini.stored`, never `gemini.ask`; **Dismiss** calls
    `gemini.dismiss`.
- [ ] **Step 2: Run** `npx vitest run apps/launcher/src/renderer/features/settings apps/launcher/src/renderer/features/scrape` → FAIL.
- [ ] **Step 3: Implement.** **Step 4: Run** → PASS.
- [ ] **Step 5:** lint, typecheck, `CI=1 npm test` → green. **Commit**
  `feat(launcher): Fill details with Gemini dialog and Settings (FR-SCR-7)`, push, open PR (a).

## PR (b): batch

### Task 6: Gemini batch service

**Files:**
- Modify: `apps/launcher/src/main/library/schema.ts` (`scrape_jobs.source` text not null default
  `'scrape'`) + migration 0015, clear the vitest cache
- Modify: `apps/launcher/src/main/scraper/batch/jobStore.ts` (constructor takes
  `source: 'scrape' | 'gemini'`; every query filters on it; rules parsed by the source's schema)
- Modify: `packages/shared/src/scraper/batch.ts` (`BATCH_PAUSE_REASONS` += `'gemini-quota'`,
  `'webTool'`); `geminiContract.ts` += `gemini.batch.start` `{ scope: BatchScope, rules:
  GeminiBatchRules }`, `.pause`, `.resume`, `.cancel`, `.status` → `BatchStatus`; event
  `gemini.batch.progress`
- Create: `apps/launcher/src/main/gemini/GeminiBatchService.ts`, `quotaReset.ts`
- Test: `GeminiBatchService.test.ts`, `quotaReset.test.ts`, existing `BatchScrapeService*.test.ts`
  stay green

**Interfaces:**
- Consumes: `nextGame`/`countGames` with `{ onlyMissing: true, kinds: [], fields:
  rules.fields, regions: ['wor'], launchbox: false }`; `GeminiService.record`; `GeminiClient.ask`.
- Produces: `class GeminiBatchService { start(scope, rules); pause(); resume(); cancel();
  status(): BatchStatus; restore(): void; dispose(): void }`;
  `nextQuotaReset(now: Date): Date` (next 00:00 America/Los_Angeles);
  an answer source seam `interface AnswerSource { next(games: PromptGame[]): Promise<Map<number,
  string | unknown>> }` so Task 9 plugs in the web tool.
- The `scrape` batch and the `gemini` batch can run at the same time (separate `JobStore`
  sources).

- [ ] **Step 1: Write the failing tests:**
  - takes up to 10 games after the cursor, one request, records each; counts
    applied/review/notFound;
  - **Review Focus 1:** reply without game 2, with an unknown id 99 and game 3 twice → game 2
    `notFound`, 99 ignored, first game-3 answer used;
  - **Review Focus 4:** `GEMINI_QUOTA` → cursor unchanged, paused `gemini-quota`, `resumeAt` =
    `nextQuotaReset`; `restore()` before then schedules, after then runs;
  - `GEMINI_NETWORK` → paused `network`; `GEMINI_BAD_REPLY` → the request's games `failed`, the
    batch goes on;
  - a scrape job and a gemini job active together don't see each other's rows;
  - `nextQuotaReset` across a DST change.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement.** **Step 4: Run**
  `npx vitest run apps/launcher/src/main/gemini apps/launcher/src/main/scraper` → PASS.
- [ ] **Step 5: Commit** `feat(launcher): Gemini batch (FR-SCR-7)`.

### Task 7: Batch dialog and progress

**Files:**
- Create: `apps/launcher/src/renderer/features/scrape/GeminiBatchDialog.tsx`, `geminiBatchApi.ts`
- Modify: `ScrapeMenu.tsx` (entries "Fill <system> details with Gemini…" and "Fill n selected
  games with Gemini…"), `BatchProgress.tsx` (a second progress line for the gemini job; pause
  texts for `gemini-quota` "Gemini's free daily limit is used up; it resumes tomorrow, or switch
  to the Gemini website tool" and `webTool`), `LibraryOverlays.tsx`, en/pt-BR
- Test: `GeminiBatchDialog.test.tsx`, `BatchProgress.test.tsx`

- [ ] **Step 1: Write the failing tests:** dialog defaults all six fields, mode **Review**,
  route **Gemini API**; Auto-update shows "Answers are saved without review"; route **Gemini
  website tool** shows "the website gives no sources" and "close Firefox first", and is disabled
  with a Settings link while the tool paths are empty; Start calls `gemini.batch.start`; no key +
  API route → Start disabled with "Add a Gemini key in Settings"; progress shows both jobs.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement.** **Step 4: Run** → PASS.
- [ ] **Step 5:** lint, typecheck, `CI=1 npm test`. **Commit**
  `feat(launcher): Gemini batch dialog and progress (FR-SCR-7)`, push, open PR (b).

## PR (c): website tool, docs

### Task 8: `tools/gemini-web` (Python)

**Files:**
- Create: `tools/gemini-web/gemini_web.py`, `browser.py`, `requirements.txt` (selenium pinned),
  `README.md`, `test_gemini_web.py`
- Reference: `c:\lestivalet\next-level\dashboard\scrapers\gemini_scraper.py` (port the Selenium
  parts: profile, input selectors, stop-button wait, stable text read; note the source in the
  commit)

**Interfaces:**
- CLI: `python gemini_web.py --request <job>\request.json --profile <firefox profile>
  [--driver <geckodriver.exe>]`. Exit 0 = done; 2 = bad arguments/request; 3 = Firefox/driver
  could not start (message on stderr); 4 = login needed.
- Reads `GeminiWebRequestSchema` JSON; sends batches of 10 with the same rules as `buildPrompt`
  (a Python copy; the test pins the "never guess" line and the gameId echo); appends one
  `GeminiWebResultLineSchema` line per game to `results.jsonl` (flush after each line); writes
  `done.json` `{ "answered": n }` at the end.
- Driver: `--driver` if given, else `geckodriver.exe` next to the script; never
  `webdriver_manager`.

- [ ] **Step 1: Write the failing pytest tests** with `browser.py` mocked: request parsing
  (bad file → exit 2), batching by 10, prompt rules, one result line per game in the reply
  (raw reply text kept), resume skips gameIds already in `results.jsonl`, `done.json` written.
- [ ] **Step 2: Run** `python -m pytest tools/gemini-web -q` → FAIL.
- [ ] **Step 3: Implement.** **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `feat(tools): Gemini website tool (FR-SCR-7)` (ported from
  next-level/dashboard scrapers/gemini_scraper.py).

### Task 9: Launcher hand-off to the tool

**Files:**
- Create: `apps/launcher/src/main/gemini/WebToolSource.ts` (an `AnswerSource`)
- Modify: `GeminiBatchService.ts` (route `web` uses it), `startLibrary.ts` (left-over job pickup
  at start)
- Test: `WebToolSource.test.ts` (fake child process)

**Interfaces:**
- Produces: `class WebToolSource implements AnswerSource { constructor(deps: { spawn; dataDir;
  settings: () => GeminiSettings; log }) }`. Writes `<data>\gemini\jobs\<jobId>\request.json`
  (atomic write) with the whole remaining scope once, spawns
  `[python, toolPath, '--request', file, '--profile', profile, ...driver]` (`shell: false`),
  tails `results.jsonl` (each new line parsed with `GeminiWebResultLineSchema`, the reply checked
  by `parseReply` + `checkAnswer`), and deletes the folder after `done.json` and the last apply.
- Tool path: `tools/gemini-web/gemini_web.py` resolved from the app folder in dev; packaged
  builds use `<app>\tools\gemini-web\` only if present.

- [ ] **Step 1: Write the failing tests:** request file content (no API key in it); argv exact,
  `shell: false`; three lines then exit 0 → three games recorded, folder removed;
  **Review Focus 5:** exit 3 after one line → that game recorded, job paused `webTool`, stderr
  tail logged; spawn ENOENT (no Python) → paused `webTool`; a left-over folder with
  `results.jsonl` at start → its lines recorded once, then the folder removed; empty Settings
  paths → `start` refused with a clear message.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement.** **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `feat(launcher): Gemini website tool hand-off (FR-SCR-7)`.

### Task 10: Docs and e2e

**Files:**
- Create: `apps/launcher/e2e/gemini.spec.ts` (fake Gemini server via `NEXTLEVEL_GEMINI_URL`,
  key set through Settings in the test)
- Modify: `docs/01-product/02-product-requirements.md` (FR-SCR-7 row, spec §9 text),
  `docs/02-design/scraping-guide.md` (key without billing, what Gemini fills and never fills,
  Review vs Auto-update, the website tool and its setup), `docs/02-design/screen-specifications.md`,
  `docs/03-architecture/data-model.md` (`gemini.apiKey`, `gemini_answers`, `scrape_jobs.source`,
  `<data>\gemini\jobs\`), `CHANGELOG.md` (Added)

- [ ] **Step 1: Write the e2e:** a game with an empty year → Fill details with Gemini… → year
  1991 ticked, "Gemini doesn't know" on developer → Apply → details show 1991.
- [ ] **Step 2: Run** `npm run test:e2e -w apps/launcher -- gemini` → PASS.
- [ ] **Step 3: Write the docs.**
- [ ] **Step 4:** lint, typecheck, `CI=1 npm test`, `python -m pytest tools/gemini-web -q`.
  **Commit** `docs: Gemini fill (FR-SCR-7)`, push, open PR (c).
