# LaunchBox Scraper Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** LaunchBox Games Database as a second scraper that complements ScreenScraper, for a
single game and as a batch fill step, from its public database download indexed locally.

**Architecture:**
- `Metadata.zip` is downloaded into `<data>\launchbox\`, then stream-parsed in a worker thread
  into `launchbox.db` (SQLite), built into a temp file and swapped in.
- A `LaunchBoxScrapeService` mirrors `ScrapeService`'s `search / preview / apply / thumbnail`.
  Both write through one extracted `writeScrape` helper (media writer, media index, metadata,
  scrape status).
- The batch engine runs a LaunchBox step after the ScreenScraper step of each game.

**Tech Stack:** Electron main (Node 24), better-sqlite3, `fflate` (new dependency: streaming
unzip, pure JS), React 19 + TanStack Query, zod, vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-11-02-launchbox-scraper-design.md` (read it first; section
numbers below refer to it).

## Global Constraints

- Every file this feature writes lives under `<data>\launchbox\` (D50 portable rule). No
  `os.tmpdir()`, no AppData.
- Never write `title` from LaunchBox in a batch (D19). Locked fields are never ticked for the
  user.
- The LaunchBox batch step fills **only what is missing**, whatever the batch's *Only missing*.
- Auto-apply in batch: a single candidate with similarity ≥ 90 (`AUTO_APPLY_SIMILARITY`).
  Anything else → review; none → leave the ScreenScraper outcome.
- No test touches the network. Fixtures only (`apps/launcher/test/fixtures/launchbox/`).
- Source URLs: `https://gamesdb.launchbox-app.com/Metadata.zip`;
  images `https://images.launchbox-app.com/<FileName>`.
- Polite image downloads: at most 2 per second per service (500 ms gap).
- Library rating is 0–5 with one decimal: LaunchBox `CommunityRating` is rounded to one decimal.
- Never run Prettier on `docs/*.md` (docs tables aren't Prettier-formatted).
- Workflow:
  - three PRs: **(a)** Tasks 1–5, **(b)** Tasks 6–9, **(c)** Tasks 10–11;
  - lint + typecheck + `CI=1 npm test` before each PR;
  - one fresh reviewer per PR.

## Review Focus

1. **Refresh while the index is in use.** A scrape dialog is open, or a batch is running, when
   Refresh finishes. Windows can't replace an open SQLite file.
   - Expected: Refresh is refused while a batch runs (`LAUNCHBOX_BUSY`).
   - Otherwise the service closes its connection, swaps, and reopens; an open dialog's next
     search uses the new index.
   - Test in Task 5.
2. **Download stops halfway** (offline, disk full, app closed).
   - Expected: the previous index keeps working, the status shows the error, and the next
     Refresh resumes the `.part`.
   - Test in Task 5.
3. **Titles that differ only in punctuation or tags.** For example, the file
   `Dracula - Undead Awakening (USA).nds` should match LaunchBox `Dracula: Undead Awakening`
   at ≥ 90.
   - Test in Task 7.
4. **An image URL that answers 404 or a non-image.**
   - Expected: that kind fails `download`; the other kinds and fields still apply.
   - Test in Task 8.
5. **A huge platform** (Arcade or Windows, about 50k games).
   - Expected: a search ranks within 300 ms (`perfBudget(300)`), because names are loaded once
     per platform and cached until the index changes.
   - Test in Task 7.

---

## PR (a): index and settings

### Task 1: Shared contracts

**Files:**
- Modify: `packages/shared/src/catalog/schema.ts` (`scraper`)
- Modify: `packages/shared/src/settings/schema.ts` (`SystemSettingsSchema`)
- Modify: `packages/shared/src/scraper/schema.ts`, `packages/shared/src/scraper/apply.ts`
- Create: `packages/shared/src/scraper/launchbox.ts`
- Modify: `packages/shared/src/ipc/contract.ts`, `packages/shared/src/ipc/events.ts` (where
  events live), `packages/shared/src/errors.ts`
- Modify: `packages/shared/src/i18n/en.json`, `pt-BR.json` (error messages only)
- Test: `packages/shared/src/scraper/launchbox.test.ts`, `packages/shared/src/settings/schema.test.ts`

**Interfaces (produces):**
- `SCRAPE_PROVIDERS = ['screenscraper', 'launchbox'] as const`; `ScrapeProvider`;
  `ScrapeProviderSchema`.
- `ScrapeSearchInputSchema`, `ScrapePreviewInputSchema` and `ScrapeApplyInputSchema` gain
  `provider: ScrapeProviderSchema.default('screenscraper')`.
- `ScrapeStatusSchema` gains `provider: ScrapeProviderSchema`.
- `SystemDefinitionSchema.scraper` gains `launchboxPlatform: z.string().min(1).optional()`.
- `SystemSettingsSchema` gains `launchboxPlatform: z.string().min(1).max(120).optional()`.
- `LaunchBoxStatusSchema = z.object({ state: z.enum(['missing', 'downloading', 'building', 'ready', 'failed']), builtAt: z.string().nullable(), games: count, progress: z.number().min(0).max(1).nullable(), error: z.string().nullable() })`.
- IPC channels:
  - `'launchbox.status'`: `{ input: z.void(), output: LaunchBoxStatusSchema }`
  - `'launchbox.refresh'`: `{ input: z.void(), output: LaunchBoxStatusSchema }`
  - `'launchbox.cancel'`: `{ input: z.void(), output: LaunchBoxStatusSchema }`
  - `'launchbox.platforms'`: `{ input: z.void(), output: z.array(z.string()) }`
  - `'launchbox.setPlatform'`: `{ input: z.strictObject({ systemId: z.string().min(1), platform: z.string().min(1).max(120) }), output: z.void() }`
- Event: `'launchbox.status'` with payload `LaunchBoxStatus`.
- Error codes: `LAUNCHBOX_INDEX_MISSING`, `NO_LAUNCHBOX_PLATFORM`, `LAUNCHBOX_BUSY`,
  `LAUNCHBOX_DOWNLOAD`.

- [ ] **Step 1: Write the failing tests**

```ts
it('FR-SCR-6: scrape inputs default to ScreenScraper', () => {
  expect(ScrapeSearchInputSchema.parse({ gameId: 1 }).provider).toBe('screenscraper');
  expect(ScrapeApplyInputSchema.parse({ gameId: 1, providerGameId: 2, kinds: [], fields: [], provider: 'launchbox' }).provider).toBe('launchbox');
});
it('FR-SCR-6: a system may name its LaunchBox platform', () => {
  expect(SettingsSchema.safeParse({ schemaVersion: 2, systems: { snes: { launchboxPlatform: 'Super Nintendo Entertainment System' } } }).success).toBe(true);
  expect(SettingsSchema.safeParse({ schemaVersion: 2, systems: { snes: { launchboxPlatform: '' } } }).success).toBe(false);
});
```

- [ ] **Step 2: Run** `npx vitest run packages/shared`. Expected: FAIL (`provider` undefined).
- [ ] **Step 3: Implement the schemas and channels above.**
  - Existing callers keep compiling because `provider` has a default.
  - Fix any exhaustive test fixtures that list `ScrapeStatus` (add `provider: 'screenscraper'`).
- [ ] **Step 4: Run** `npx vitest run packages/shared && npm run typecheck`. Expected: PASS,
  except launcher handler compile errors for the new channels. Stub those handlers to reject
  `LAUNCHBOX_INDEX_MISSING` in `apps/launcher/src/main/launchbox/launchboxHandlers.ts` (Task 5
  fills them in).
- [ ] **Step 5: Commit** `feat(shared): LaunchBox contracts (FR-SCR-6)`.

### Task 2: Catalog LaunchBox platform names

**Files:**
- Create: `packages/system-catalog/scripts/launchboxPlatforms.ts` (pure matcher)
- Create: `packages/system-catalog/scripts/launchbox-map.ts` (CLI)
- Modify: `packages/system-catalog/scripts/seed.ts` (carry over existing `launchboxPlatform`
  values)
- Modify: `packages/system-catalog/data/systems.json` (generated)
- Test: `packages/system-catalog/scripts/launchboxPlatforms.test.ts`

**Interfaces (produces):**
- `parsePlatforms(xml: string): Array<{ name: string; alternates: string[] }>`
- `matchPlatform(system: { name: string; aliases?: string[]; defaultFolderName: string; manufacturer?: string }, platforms: ReturnType<typeof parsePlatforms>): string | null`
- Matching: normalize to lowercase alphanumerics. Match the system's name, aliases, folder name
  and `manufacturer + name` against platform `name` and `alternates`. Exact normalized equality
  only; a manual `OVERRIDES: Record<systemId, string>` in the CLI wins.

- [ ] **Step 1: Write failing tests.**
  - `'Microsoft XBOX 360'` → `'Microsoft Xbox 360'`.
  - A system whose alias equals a platform alternate → that platform's `name`.
  - An unmatched system → `null`.
  - Use a 3-platform XML string fixture.
- [ ] **Step 2: Run** `npx vitest run packages/system-catalog`. Expected: FAIL.
- [ ] **Step 3: Implement** the matcher and the CLI:
  - Usage: `node packages/system-catalog/scripts/launchbox-map.ts --platforms <Platforms.xml>`.
  - It writes `scraper.launchboxPlatform` into `data/systems.json` (other fields untouched,
    key order kept) and prints the unmatched systems.
  - `seed.ts` keeps an existing `scraper.launchboxPlatform` for the same system id.
- [ ] **Step 4: Run the CLI** on the verified `Platforms.xml` (unzip it from `Metadata.zip`
  into scratch).
  - Add `OVERRIDES` for popular unmatched systems; the popular list is in
    `packages/system-catalog/src/popular.ts`.
  - Expected: `microsoft-xbox-360` has `"launchboxPlatform": "Microsoft Xbox 360"`.
  - Then run `npx vitest run packages/system-catalog`. Expected: PASS (update snapshots
    deliberately).
- [ ] **Step 5: Commit** `feat(catalog): LaunchBox platform per system (FR-SCR-6)`.

### Task 3: Streaming parser

**Files:**
- Create: `apps/launcher/src/main/launchbox/parseMetadata.ts`
- Create: `apps/launcher/test/fixtures/launchbox/` (`Metadata.xml`, `Platforms.xml`, and
  `build-fixture.ts`, which zips them into `Metadata.zip` at test time with `fflate.zipSync`)
- Modify: `apps/launcher/package.json` (add `fflate`)
- Test: `apps/launcher/src/main/launchbox/parseMetadata.test.ts`

**Interfaces (produces):**
- `type LbRecord =
  | { kind: 'game'; id: number; name: string; platform: string; year: number | null; developer: string | null; publisher: string | null; genres: string | null; players: string | null; overview: string | null; rating: number | null }
  | { kind: 'alternate'; id: number; name: string }
  | { kind: 'image'; id: number; fileName: string; type: string; region: string | null }`
- `type LbGame = Omit<Extract<LbRecord, { kind: 'game' }>, 'kind'>`;
  `type LbImage = { fileName: string; type: string; region: string | null }`. Later tasks use
  these names.
- `parseMetadataZip(zipPath: string, onRecord: (r: LbRecord) => void, onProgress?: (share: number) => void, signal?: AbortSignal): Promise<void>`
  - It unzips only the `Metadata.xml` entry (`fflate.Unzip` streamed from a file read stream).
  - It scans the flat `<Game>`, `<GameAlternateName>` and `<GameImage>` blocks as a streaming
    tag scanner that keeps only the current block.
  - It decodes XML entities.
  - `year` comes from the first 4 digits of `ReleaseDate`, else `ReleaseYear`.
  - `rating` is `CommunityRating` rounded to 1 decimal.
- Fixture content:
  - Ace Driver Collection (`DatabaseID 472523`, `Microsoft Xbox 360`, Clear Logo +
    Fanart - Background + 2 × Fanart - Box - Front, one with `Region` World);
  - `Dracula: Undead Awakening` (`Nintendo DS`, Box - Front `North America` and
    Box - Front `Europe`);
  - one game with `&amp;` in the name;
  - one `GameAlternateName`.

- [ ] **Step 1: Write the failing test.** Parsing the fixture zip yields exactly the fixture's
  records, for example:

```ts
expect(games.find((g) => g.id === 472523)).toMatchObject({ name: 'Ace Driver Collection', platform: 'Microsoft Xbox 360', year: 2026 });
expect(images.filter((i) => i.id === 472523).map((i) => i.type)).toEqual(['Clear Logo', 'Fanart - Background', 'Fanart - Box - Front', 'Fanart - Box - Front']);
expect(games.find((g) => g.name === 'Tom & Jerry')).toBeDefined();
```

  Plus a test that an aborted signal rejects with `AbortError` and reports no further records.
- [ ] **Step 2: Run** `npx vitest run apps/launcher/src/main/launchbox`. Expected: FAIL.
- [ ] **Step 3: Implement** `parseMetadataZip`. Also cover a chunk boundary inside a tag: the
  test feeds the scanner 7-byte chunks.
- [ ] **Step 4: Run.** Expected: PASS.
- [ ] **Step 5: Commit** `feat(launcher): LaunchBox metadata parser (FR-SCR-6)`.

### Task 4: Index database and worker build

**Files:**
- Create: `apps/launcher/src/main/launchbox/LaunchBoxIndex.ts`
- Create: `apps/launcher/src/main/launchbox/buildIndex.ts`
- Create: `apps/launcher/src/main/launchbox/indexWorker.ts`
- Test: `apps/launcher/src/main/launchbox/LaunchBoxIndex.test.ts`

**Interfaces (produces):**
- `buildIndex(zipPath: string, outPath: string, onProgress?: (share: number) => void, signal?: AbortSignal): Promise<{ games: number }>`
  - Tables: `games(id primary key, name, norm, platform, year, developer, publisher, genres,
    players, overview, rating)`, `alternates(id, name, norm)`, `images(id, file_name, type,
    region)`, `meta(key, value)` (`builtAt`, `games`).
  - Indexes: `games(platform)`, `alternates(id)`, `images(id)`.
  - Only image types listed in spec §5 are stored.
  - `norm = normalizeTitle(name, { isTitle: true })`, from `scraper/screenscraper/titles.ts`.
- `class LaunchBoxIndex`:
  - `static open(path: string): LaunchBoxIndex | null` (null when missing or unreadable)
  - `close(): void`
  - `info(): { builtAt: string; games: number }`
  - `platforms(): string[]`
  - `platformNames(platform: string): Array<{ id: number; name: string; norm: string }>`
    (games + alternates, cached per platform until `close`)
  - `game(id: number): LbGame | null`
  - `images(id: number): Array<{ fileName: string; type: string; region: string | null }>`
- `indexWorker.ts` runs `buildIndex` from `workerData` and posts `{ progress }` /
  `{ done, games }` / `{ error }` messages. It's imported in main as
  `./launchbox/indexWorker.ts?modulePath`, like `scanWorker.ts`.

- [ ] **Step 1: Write failing tests** (build from the fixture into a temp dir from
  `tempDir()`):
  - `platformNames('Microsoft Xbox 360')` contains Ace Driver Collection with
    `norm === 'ace driver collection'`;
  - `images(472523)` holds 4 rows;
  - an image type not in §5 (add an `Arcade - Cabinet` row to the fixture) isn't stored;
  - `LaunchBoxIndex.open` on a missing path → `null`.
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement.** Insert in one transaction per 5,000 records; prepared statements.
- [ ] **Step 4: Run.** Expected: PASS.
- [ ] **Step 5: Commit** `feat(launcher): LaunchBox local index (FR-SCR-6)`.

### Task 5: LaunchBoxService, handlers and Settings

**Files:**
- Create: `apps/launcher/src/main/launchbox/LaunchBoxService.ts`
- Modify: `apps/launcher/src/main/launchbox/launchboxHandlers.ts` (stubs from Task 1)
- Modify: `apps/launcher/src/main/startLibrary.ts` (wiring)
- Modify: `apps/launcher/src/main/handlers.ts` (spread handlers)
- Create: `apps/launcher/src/renderer/features/settings/scraper/LaunchBoxPanel.tsx`,
  `launchboxApi.ts`
- Modify: `ScraperSection.tsx` (adds the panel), `settings/systems/SystemEditor.tsx`
  (LaunchBox platform text field + catalog default placeholder)
- Modify: i18n files
- Test: `apps/launcher/src/main/launchbox/LaunchBoxService.test.ts`,
  `apps/launcher/src/renderer/features/settings/scraper/LaunchBoxPanel.test.tsx`

**Interfaces:**
- Consumes: `downloadFile` (`main/catalog/downloadFile.ts`) for a resumable `.part`;
  `LaunchBoxIndex`; the worker.
- Produces:
  - `class LaunchBoxService` with:
    - `status(): LaunchBoxStatus`
    - `refresh(): LaunchBoxStatus` (starts download then build, emits `launchbox.status`)
    - `cancel(): LaunchBoxStatus`
    - `index(): LaunchBoxIndex` (throws `LAUNCHBOX_INDEX_MISSING`)
    - `platformOf(systemId: string): string` (settings override, then catalog; throws
      `NO_LAUNCHBOX_PLATFORM`)
    - `setBusy(busy: boolean): void` (the batch calls it; while busy, `refresh` throws
      `LAUNCHBOX_BUSY`)
  - Deps: `{ dataDir, fetch, emit, settings, system, updateSettings, buildInWorker(zip, out, onProgress, signal), clock }`.
  - Files: `<dataDir>\launchbox\Metadata.zip.part` → `Metadata.zip` → `launchbox.db.building`
    → swap to `launchbox.db` (close the current index first, rename, reopen), then delete the
    zip.
  - The expected size comes from a `HEAD` request's `content-length`.

- [ ] **Step 1: Write failing tests** with a fake fetch serving the fixture zip and an
  in-process `buildInWorker`:
  - a refresh from `missing` ends `ready` with `games` = fixture count, and the zip is deleted;
  - Review Focus 1: `setBusy(true)` → `refresh()` throws `LAUNCHBOX_BUSY`; a refresh that
    finishes while `index()` was handed out swaps and the next `index()` sees the new data;
  - Review Focus 2: the fake fetch cuts off at half → status `failed` with error
    `LAUNCHBOX_DOWNLOAD`, the previous `launchbox.db` still opens, and the next refresh sends
    `range: bytes=<half>-`;
  - `platformOf` prefers `settings.systems[id].launchboxPlatform` over the catalog; neither →
    `NO_LAUNCHBOX_PLATFORM`.
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement** the service, handlers and wiring:
  - `launchbox.setPlatform` writes `settings.systems[id].launchboxPlatform` like
    `scraper.setSystemId`.
  - Start with `LaunchBoxIndex.open(<data>\launchbox\launchbox.db)`.
- [ ] **Step 4: Write the failing renderer test**, then implement `LaunchBoxPanel`:
  - It shows "Not downloaded" + **Download (about 110 MB)**; while working, a progress bar
    and **Cancel**; when ready, "Updated <date> · N games" + **Refresh**; on failure, the
    translated error.
  - The test drives it with the fake bridge and a `launchbox.status` event.
  - The SystemEditor field saves through the existing settings form, with the catalog value
    as placeholder.
- [ ] **Step 5: Run** `CI=1 npm test`, lint, typecheck. Expected: PASS.
- [ ] **Step 6: Commit** `feat(launcher): LaunchBox database download and Settings (FR-SCR-6)`,
  then open PR (a).

## PR (b): single game

### Task 6: Art and field mapping

**Files:**
- Create: `apps/launcher/src/main/launchbox/mapping.ts`
- Test: `apps/launcher/src/main/launchbox/mapping.test.ts`

**Interfaces (produces):**
- `LB_ART_TYPES: Record<GameArtKind, readonly string[]>`, exactly spec §5 (`video: []`).
- `LB_REGION_CODES: Record<string, string>`:
  - `'North America'`, `'United States'`, `'USA'`, `'Canada'` → `'us'`
  - `'Europe'`, `'United Kingdom'`, `'Germany'`, `'France'`, `'Spain'`, `'Italy'` → `'eu'`
  - `'Japan'` → `'jp'`
  - `'World'` → `'wor'`
  - `'Brazil'` → `'br'`
  - `'Korea'` → `'kr'`
  - `'Australia'` → `'au'`
  - `'China'` → `'cn'`
  - no region → `'wor'`
- `selectArt(images: LbImage[], regions: readonly string[]): Partial<Record<GameArtKind, LbImage>>`:
  - per kind, the first type in `LB_ART_TYPES[kind]` that has any image;
  - within that type, the first image whose region code comes first in `regions`;
  - else the first image of that type.
- `lbValues(game: LbGame): Record<ScrapeField, string | number | null>`, mapped as spec §5
  (`genre` as is, `players` as text, `rating` as stored).

- [ ] **Step 1: Write failing tests:**
  - Ace Driver Collection's images → `box-front` = the World `Fanart - Box - Front`,
    `logo-clear` and `fanart` set, `box-back` absent;
  - Dracula with regions `['eu', 'us']` → the Europe box;
  - with `['jp']` → the first box (fallback);
  - `lbValues` maps year 2026 and players `'1'`.
- [ ] **Step 2: Run.** Expected: FAIL. **Step 3: Implement.** **Step 4: Run.** Expected: PASS.
- [ ] **Step 5: Commit** `feat(launcher): LaunchBox art and field mapping (FR-SCR-6)`.

### Task 7: Matching

**Files:**
- Create: `apps/launcher/src/main/launchbox/match.ts`
- Test: `apps/launcher/src/main/launchbox/match.test.ts`, `match.perf.test.ts`

**Interfaces (produces):**
- `matchGames(names: Array<{ id: number; name: string; norm: string }>, query: { title: string; fileName: string }): Array<{ id: number; name: string; similarity: number }>`:
  - normalize the title with `normalizeTitle(title, { isTitle: true })`;
  - score every name with `similarity()` from `screenscraper/titles.ts`, against the
    normalized query and each of `queryVariants(normalized)`, keeping the best;
  - ±5 for region match/mismatch, using `extractRegion(fileName)` only where the name carries
    a region tag;
  - keep scores ≥ `SEARCH_THRESHOLD` (60), one row per `id` (an alternate name maps to its
    game id), best first, at most 20.

- [ ] **Step 1: Write failing tests:**
  - Review Focus 3: `Dracula - Undead Awakening (USA)` against `Dracula: Undead Awakening` →
    similarity ≥ 90;
  - an alternate name hit returns the main game id once;
  - nothing ≥ 60 → `[]`.
- [ ] **Step 2: Write the perf test** (Review Focus 5): 50,000 generated names, one query,
  ≤ `perfBudget(300)` ms.
- [ ] **Step 3: Run.** Expected: FAIL. **Step 4: Implement.** **Step 5: Run.** Expected: PASS.
- [ ] **Step 6: Commit** `feat(launcher): LaunchBox title matching (FR-SCR-6)`.

### Task 8: Shared writer, LaunchBox scrape service, routing

**Files:**
- Create: `apps/launcher/src/main/scraper/writeScrape.ts` (extracted from
  `ScrapeService.applyOnce`)
- Modify: `apps/launcher/src/main/scraper/ScrapeService.ts` (uses `writeScrape`)
- Modify: `apps/launcher/src/main/library/ScrapeRepository.ts`: `set(gameId, status & { provider })`
  (drop the `SCREENSCRAPER` constant), and read `provider` into `ScrapeStatus`
- Create: `apps/launcher/src/main/launchbox/LaunchBoxScrapeService.ts`
- Modify: `apps/launcher/src/main/scraper/scrapeHandlers.ts` (route by `input.provider`)
- Modify: `apps/launcher/src/main/protocol/register.ts`, `resolveUrl.ts` and the shared URL
  helper: `nextlevel://launchbox-thumb/<id>`
- Test: `writeScrape.test.ts`, `LaunchBoxScrapeService.test.ts`, the existing
  `ScrapeService.test.ts` (must stay green unchanged)

**Interfaces:**
- Produces:
  - `writeScrape(deps: WriteScrapeDeps, input: { game: GameDetails; provider: ScrapeProvider; providerGameId: number; kinds: GameArtKind[]; fetchArt: (kind: GameArtKind) => Promise<{ bytes: Buffer; format: string } | null>; values: Partial<Record<ScrapeField, string | number | null>>; overrideLocked: ScrapeField[]; candidates: number; batch: boolean }): Promise<ScrapeApplyResult>`.
    - `WriteScrapeDeps` is `ScrapeServiceDeps` minus `client`, `hash` and `system`, plus
      `mediaDir`.
    - `fetchArt` returning `null` → `notAvailable`; throwing → `download` (transport errors
      rethrown when `batch`).
  - `class LaunchBoxScrapeService` with `search(input)`, `preview(input)`, `apply(input, opts?)`
    and `thumbnail(id)`, same shapes as `ScrapeService`.
    - Deps: `{ launchbox: Pick<LaunchBoxService, 'index' | 'platformOf'>, fetch, sleep, ...WriteScrapeDeps }`.
    - `search` returns `method: 'title'`.
    - Candidates carry `year` (string), `region: null` and
      `thumb: launchboxThumbUrl(id) | null` (box-front present).
    - `preview` marks `available` per `selectArt`.
    - `apply` downloads `https://images.launchbox-app.com/<FileName>` with a 500 ms gap and
      checks `isImage`.

- [ ] **Step 1: Write failing tests:**
  - `writeScrape` writes art + fields + status `{ provider: 'launchbox' }` in one transaction
    (moved cases from `ScrapeService.test.ts` keep passing there);
  - LaunchBox `search` for a game titled `Ace Driver Collection` on `microsoft-xbox-360` finds
    472523 at 100;
  - Review Focus 4: the fake fetch answers 404 for the logo and HTML for the fanart → result
    `failed` has both with `download`, and `box-front` plus the fields are written;
  - routing: `scraper.search` with `provider: 'launchbox'` reaches the LaunchBox service;
  - `NO_LAUNCHBOX_PLATFORM` and `LAUNCHBOX_INDEX_MISSING` pass through as errors.
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement.** Extract first and run `ScrapeService.test.ts` green, then add the
  LaunchBox service.
- [ ] **Step 4: Run** the scraper and launchbox folders. Expected: PASS.
- [ ] **Step 5: Commit** `feat(launcher): Scrape from LaunchBox in main (FR-SCR-6)`.

### Task 9: Dialog, menu and platform picker

**Files:**
- Modify: `apps/launcher/src/renderer/features/scrape/useScrape.ts`
  (`useScrape(game, provider)`, `needsDownload` phase on `LAUNCHBOX_INDEX_MISSING`,
  `needsSystem` on `NO_LAUNCHBOX_PLATFORM` loading `launchbox.platforms`)
- Modify: `scrapeApi.ts` (provider on every call), `ScrapeDialog.tsx`
  (`provider` prop; title "Scrape from LaunchBox: <title>"; **Try LaunchBox** when a
  ScreenScraper search returns no candidates; "Not on LaunchBox" wording)
- Modify: `SystemPicker.tsx` (generic `options: Array<{ value: string; label: string }>`, used
  for both sources)
- Modify: `library/LibraryOverlays.tsx`
  - two menu items, `scrape` ("Scrape from ScreenScraper…") and `scrapeLaunchBox`;
  - overlay state `{ gameId, provider }`;
  - a game whose `scrape.status === 'review'` opens with `scrape.provider`.
- Modify: `library/DetailsArt.tsx` `ScrapeStatusLine` ("Scraped <date> from LaunchBox")
- Modify: i18n files
- Test: `ScrapeDialog.test.tsx`, `LibraryApp.test.tsx` or `GameContextMenu` test

**Interfaces:** consumes `provider` on the scrape channels (Task 1) and `launchbox.refresh`
(Task 5).

- [ ] **Step 1: Write failing tests:**
  - the context menu shows both items, and "Scrape from LaunchBox…" opens the dialog that
    searched with `provider: 'launchbox'`;
  - a ScreenScraper search with no candidates shows **Try LaunchBox**, which re-searches with
    `provider: 'launchbox'` in the same dialog;
  - `LAUNCHBOX_INDEX_MISSING` shows "Download the LaunchBox database (about 110 MB)?" with
    **Download**, which calls `launchbox.refresh`; on `launchbox.status` ready, it searches
    again;
  - `NO_LAUNCHBOX_PLATFORM` shows the picker with platform names; Save calls
    `launchbox.setPlatform`.
- [ ] **Step 2: Run.** Expected: FAIL. **Step 3: Implement.** **Step 4: Run.** Expected: PASS.
- [ ] **Step 5: Run** `CI=1 npm test`, lint, typecheck. **Commit**
  `feat(launcher): Scrape from LaunchBox dialog and menu (FR-SCR-6)`, then open PR (b).

## PR (c): batch and docs

### Task 10: Batch LaunchBox step

**Files:**
- Modify: `packages/shared/src/scraper/batch.ts`:
  - `BatchRulesSchema.launchbox: z.boolean().default(false)`;
  - `BatchStatusSchema.launchbox: count`;
  - `BATCH_PAUSE_REASONS` + `'launchbox'`;
  - `IDLE_BATCH.launchbox = 0`.
- Create: `apps/launcher/src/main/library/migrations/0013_*.sql` via `npm run db:generate -w apps/launcher`
  (`scrape_jobs.launchbox integer not null default 0`); `schema.ts`; Prettier the generated
  files.
- Modify: `apps/launcher/src/main/scraper/batch/BatchScrapeService.ts`, `jobStore.ts`,
  `rules.ts`
- Modify: `apps/launcher/src/main/startLibrary.ts` (deps)
- Modify: `apps/launcher/src/renderer/features/scrape/BatchRulesDialog.tsx`
  - **Then fill from LaunchBox** checkbox, ticked by default only when `launchbox.status`
    is `ready`;
  - otherwise unticked with a "Download the LaunchBox database first" link that opens
    Settings → Scraper.
- Modify: `BatchProgress.tsx` ("N applied, of which M from LaunchBox"; pause text for
  `launchbox`)
- Modify: i18n files
- Test: `BatchScrapeService.test.ts` (new describe), `rules.test.ts`,
  `BatchRulesDialog.test.tsx`, `BatchProgress.test.tsx`

**Interfaces:**
- Consumes: `LaunchBoxScrapeService.search/apply` (Task 8) and `LaunchBoxService.setBusy` and
  `status` (Task 5).
- Produces:
  - `fillTargets(rules: BatchRules, game: GameDetails, media): { kinds; fields }` in `rules.ts`
    = `batchTargets({ ...rules, onlyMissing: true }, game, media)`.
  - `bestOutcome(a, b)` with order applied > review > notFound > null.
  - Nothing to fill → no LaunchBox request.

- [ ] **Step 1: Write failing tests:**
  - ScreenScraper `notFound` + LaunchBox single candidate 95 → applied with
    `provider: 'launchbox'`, `applied +1`, `launchbox +1`, `notFound` unchanged;
  - ScreenScraper applied box-front + logo, rules ask fanart too → LaunchBox fills only
    `fanart` (assert apply `kinds: ['fanart']`), even with `onlyMissing: false`;
  - LaunchBox two candidates → status review with provider `launchbox`, counted once as
    review;
  - index missing with `launchbox: true` → pause `launchbox` once; resume after
    `launchbox.status` ready continues the same game;
  - while a job runs, `setBusy(true)`; on finish or cancel, `setBusy(false)`;
  - an old job row without `launchbox` in its rules JSON parses (default `false`).
- [ ] **Step 2: Run.** Expected: FAIL. **Step 3: Implement.** **Step 4: Run.** Expected: PASS.
- [ ] **Step 5: Commit** `feat(launcher): batch fills from LaunchBox after ScreenScraper (FR-SCR-6)`.

### Task 11: Docs and e2e

**Files:**
- Create: `apps/launcher/e2e/launchbox.spec.ts` (fake images server like
  `catalog/fakeFilesServer.ts`; the index built from the fixture into the e2e data folder
  before launch; env `NEXTLEVEL_E2E_LAUNCHBOX_IMAGES=<url>` read only when
  `NEXTLEVEL_E2E` is set, overriding the images base URL)
- Modify: `docs/01-product/02-product-requirements.md` (FR-SCR-6 row from spec §9),
  `docs/02-design/scraping-guide.md`, `docs/02-design/screen-specifications.md`, the data
  model doc (`scrape_status.provider` values, `scrape_jobs.launchbox`, `<data>\launchbox\`
  files), `CHANGELOG.md` (Added)

- [ ] **Step 1: Write the e2e:** right-click a game → Scrape from LaunchBox… → the candidate is
  preselected → Apply → the details show the new box art. It fails before the env hook exists.
- [ ] **Step 2: Implement** the env hook, run `npm run test:e2e -w apps/launcher -- launchbox`.
  Expected: PASS.
- [ ] **Step 3: Write the docs.** The scraping guide covers: the two sources, the download and
  Refresh, the platform picker, batch "Then fill from LaunchBox", and personal use only.
- [ ] **Step 4: Run** lint, typecheck, `CI=1 npm test`. **Commit**
  `docs: LaunchBox scraping (FR-SCR-6)`, then open PR (c).
