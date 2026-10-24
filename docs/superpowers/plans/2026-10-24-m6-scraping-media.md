# M6 Scraping & Media Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Scrape art and metadata from ScreenScraper — one game with a preview-and-choose step,
or a whole system/selection in a resumable, quota-aware background batch — with credentials in
the OS credential store, media written where both NextLevel apps find it, and the media index
updated at once so themes never probe the disk.

**Architecture:**
- `packages/shared` gets the scraper contracts (settings block, IPC, batch progress), the D16 art
  kind list and settings schema v2 (with a migration).
- Main gets a `SecretStore` (`safeStorage` → `secrets.bin`), a ScreenScraper client ported from
  NextLevelOS `scrappers/` (pure title/rank/metadata/media-selection modules + an HTTP client with
  an injected `fetch`, quota and rate limiting, a SQLite response cache), ROM hashing, a
  `MediaWriter`, a `ScrapeService` (search → preview → apply) and a `BatchScrapeService` (a
  persisted job, one game at a time).
- The renderer gets **Settings → Scraper**, the Library **Scrape…** dialog, **Scrape ▾**
  (batch rules, progress, Needs review) and the central media setting in **Settings → Storage**.
- **Four PRs**, same workflow as M5 (inline TDD → fresh Opus reviewer for the branch → fixes
  with failing-first tests → PR → CI green → owner OK → squash-merge → main push run):
  **M6a** scraper core + credentials (Tasks 1–5, `feat/m6a-scraper-core`);
  **M6b** single-game scrape (Tasks 6–10, `feat/m6b-scrape-game`);
  **M6c** media location + batch engine (Tasks 11–13, `feat/m6c-media-batch`);
  **M6d** batch UI, Needs review, release v0.6.0 (Tasks 14–16, `feat/m6d-batch-ui`).

**Tech Stack:** Existing stack. Node `crypto` (md5/sha1) and `zlib.crc32` for hashing, global
`fetch` (injected for tests), Electron `safeStorage` and `nativeImage` (injected), a second
better-sqlite3 file for the cache. No new runtime dependencies.

**Spec:**
- FR-SCR-1..5; new stories US-C5, US-C6, US-D6 (D20, Task 1); IA §Settings (Scraper, Storage);
  screen spec S7 (Library: Scrape…, Scrape ▾); data model §2 (settings `scraper`,
  `storage.media`, secrets), §4 (`game_media`, `scrape_status`, game art kinds); ADR-013 (port
  the scraper to TypeScript); security-and-privacy (secrets, CSP `img-src 'self' nextlevel: data:`).
- Reference (read-only — never edit, run write scripts in, or commit to NextLevelOS) @ 3d530b7:
  `scrappers/scrape_cli.py`, `scrappers/ScreenScraper.py` (`normalize_title`, `extract_region`,
  `_query_variants`, `_rank_candidates`, `levenshtein_similarity`, `extract_metadata`,
  `_select_nextlevel_media`, `_get_mapping_key`, `MEDIA_MAPPING`, `RESOLVER_EXTENSIONS`,
  `_resolver_target_extension`, `_download_selected_art`, `redact`, `http_error_message`),
  `scrappers/test_scrape_cli.py`, `scrappers/test_scrape_library.py` (port the cases as vitest),
  `electron/scraper.cjs`, `src/apps/ScrapeGame/*` (UI behaviour).

## Owner decisions

Asked in one batch on 2026-10-24; all answered "recommended".

- **D15 Developer credentials — user-entered for now.** Settings → Scraper asks for the
  ScreenScraper account (user, password) and, in an **Advanced** group, the developer id and
  password. All four live in the OS credential store (`safeStorage` → `secrets.bin`), never in
  settings or logs. Before the M10 installer an ADR revisits this (build-time secret or API proxy).
- **D16 Art kinds — the NextLevelOS set.** `GAME_ART_KINDS` = `box-front`, `box-back`, `box-3d`,
  `cart-front`, `fanart`, `video`, `screenshot-game-play`, `screenshot-game-title`, `logo-clear`,
  `marquee`. `screenshot-select` is dropped; settings schema v2 renames `screenshot-title` →
  `screenshot-game-title` in saved theme options (backup first).
- **D17 Written format — what NextLevelOS loads.** Images are written as `.png` (JPEG/WebP
  transcoded with `nativeImage`), `fanart` as `.jpg` for JPEG sources else `.png`, `video` as
  `.mp4`. After the new file is in place, other files with the same stem in that kind folder are
  deleted.
- **D18 Batch — in M6, conservative matching.** Scope: one system or the selected games. Rules:
  only missing fields / art (default on), art kinds, fields, region priority. A game is applied
  automatically only on an exact hash match or a single candidate with similarity ≥ 90;
  otherwise it is marked **Needs review** (a Library filter). Runs in the background, survives a
  restart (resumes on launch), pauses on quota.
- **D19 Locked fields.** Single-game preview shows locked (user-edited) fields with a lock,
  unticked; the user may tick one on purpose, and it stays locked. Batch never writes locked
  fields. Scraped values never lock. `title` is offered only in the single-game dialog, unticked.
- **D20 Stories.** US-C5 Scrape one game (FR-SCR-1, FR-SCR-5), US-C6 Fill in a whole system
  (FR-SCR-2), US-D6 Enter my ScreenScraper account (FR-SCR-3), marked *(proposed)*.

**Assumptions (no decision needed):**
- **Where media is written:** `perRomFolder` (default) → `<game's location path>/<system folder
  name>/media/<kind>/<rom file stem><ext>`; `central` → `<central>/<systemId>/<kind>/<stem><ext>`.
  The stem is the ROM file name without its last extension (subfolders ignored, as `matchMedia`).
  The scan indexes the central folder first, then the per-ROM folders (one file per game+kind;
  central wins).
- **Hash identify** only for files < 512 MiB that are not `.m3u`, `.cue`, `.gdi`; a hash miss
  (HTTP 404 or empty `jeu`) falls back to title search (NextLevelOS raised an error instead).
  Missing games are searched by title only.
- **No system id:** search returns `NO_SCRAPER_SYSTEM`; the dialog shows a ScreenScraper system
  picker (from `systemesListe.php`) that saves `systems[id].screenscraperId` and searches again.
- **Thumbnails and art URLs never reach the renderer** (they carry the credentials and CSP blocks
  them): main fetches thumbnails into the cache and serves them as
  `nextlevel://scrape-thumb/<providerGameId>`.
- **Cache:** `<userData>/scraper-cache.sqlite`: systems 30 d, game details 30 d, searches 7 d,
  hash identifications 30 d. "Search again" in the dialog bypasses the cache.
- **Language:** description/genre language = `scraper.languagePriority` when set, else the app
  language (`pt-BR` → `pt`), then `en`, then any. Region priority default `['us','eu','wor','jp']`.
- **Batch defaults:** art kinds `box-front`, `logo-clear`, `screenshot-game-play`, `fanart`;
  fields description, year, developer, publisher, genre, players, rating.
- **Importer unchanged:** the owner's gamelists hold no scrape status (only `updatedAt`,
  `ai_updated`, `artfolder`), so `scrapeInM6` stays a report reason; nothing fills
  `scrape_status` from NextLevelOS.
- **`settings.scraper.hasCredentials` is not stored** (data model listed it): credential presence
  is read from the SecretStore (`scraper.credentials.status`) so it can never drift. Data model
  updated in Task 1.
- **M5d deferred minors not folded in** (M6 doesn't need them): import scan stage progress
  0/1→1/1; ImportPanel loses state when leaving the page. The batch keeps its status in main and
  the UI re-reads it on mount, which avoids that class of bug for scraping.

## Global Constraints

- **ScreenScraper API:** base `https://api.screenscraper.fr/api2` (override with env
  `NEXTLEVEL_SCREENSCRAPER_URL`, used by e2e only); endpoints `jeuInfos.php`, `jeuRecherche.php`,
  `systemesListe.php`, `ssuserInfos.php`; every request sends `devid`, `devpassword`,
  `softname=NextLevel`, `output=json`, plus `ssid`/`sspassword` when set. Timeout 30 s.
- **HTTP status → error code:** 401/403 → `SCRAPER_CREDENTIALS`; 423, 426, 5xx →
  `SCRAPER_UNAVAILABLE`; 429 → retry after backoff (2 s, 4 s, 8 s, then `SCRAPER_QUOTA`); 430,
  431 → `SCRAPER_QUOTA`; network/timeout → `SCRAPER_NETWORK`; 404 on `jeuInfos.php` → not found
  (no error). New `ERROR_CODES`: `SCRAPER_CREDENTIALS`, `SCRAPER_QUOTA`, `SCRAPER_UNAVAILABLE`,
  `SCRAPER_NETWORK`, `NO_SCRAPER_SYSTEM`, `NO_CREDENTIALS`, `SECRETS_UNAVAILABLE`.
- **Rate:** at most `ssuser.maxthreads` (default 1) request in flight and ≥ 1.2 s between
  requests unless `ssuser.maxrequestspermin` allows more; quota state (`requeststoday`,
  `maxrequestsperday`) is read from every response's `ssuser`.
- **Secrets never leave main:** no credential in settings, IPC outputs, logs, errors, URLs sent to
  the renderer or test snapshots. Every error string and log line from the scraper passes
  `redact()` (`devid|devpassword|ssid|sspassword=…` → `=***`).
- **Media kinds (D16)** and ScreenScraper media type → kind: `box-2D`→`box-front`,
  `box-2D-back`→`box-back`, `box-3D`→`box-3d`, `support-2D`→`cart-front`, `fanart`→`fanart`,
  `video`→`video`, `ss`→`screenshot-game-play`, `sstitle`→`screenshot-game-title`,
  `wheel`→`logo-clear`, `screenmarquee`→`marquee` (types compared lowercase; region suffixes
  `-us`/`_eu`/`(jp)` stripped as `_get_mapping_key`). One item per kind by region priority.
- **Scrape fields:** `title`, `description`, `year` (first 4 digits; region order wor, us, eu,
  jp, any), `developer`, `publisher`, `genre` (first genre, language order), `players`, `rating`
  (`note.text` 0–20 → 0–5, one decimal; stored in `game_metadata.rating`).
- **Writes:** media downloads go to a temp file in the target kind folder's parent
  (`<media>/.nextlevel-tmp/`), then rename; never leave partial files; metadata + `game_media` +
  `scrape_status` for one game commit in one transaction. NextLevelOS folders are only written
  through the user's own media folders (same convention), never its `public/data`.
- **Events:** after an apply, `library.changed { systems: [systemId], gameIds: [gameId] }`; new
  event `scraper.batch.progress`.
- **Media URLs change when the file changes:** `mediaUrl(gameId, kind, version)` →
  `nextlevel://media/<id>/<kind>?v=<version>`; `game_media.version` = file mtime in ms.
- **Perf:** batch bookkeeping per game ≤ `perfBudget(20)` ms over a 200k library; selecting the
  next batch game ≤ `perfBudget(50)` ms.
- **Files:** components ≤ 200 lines, files ≤ 400; main tests never import renderer files.
- **i18n:** every visible string in `en.json` and `pt-BR.json` (python script,
  `ensure_ascii=False`, `newline=''`); error and status codes rendered via i18n.
- **Fixtures:** invented game titles, ids, file names and image bytes only; no real ScreenScraper
  responses copied verbatim, no credentials, no commercial ROMs. No test touches the network.

## Review Focus

1. **Replacing art that already exists** — a re-scrape overwrites `box-front/foo.png`; the theme
   and Library must show the new image, not a cached one (same URL). Pinned in Task 6
   (`mediaUrl` version changes after `upsert`) and Task 8 (apply bumps the version).
2. **Awkward ROM names** — `Foo (USA) [!].zip`, names with `'`, `&`, Unicode, a trailing dot, or
   a ROM in a `!hacks/` subfolder: the written file must use the verbatim stem the scan matches,
   and a stem with a path separator is refused. Pinned in Task 7.
3. **Credentials leaking** — through an error message (`fetch` errors include the URL), a log
   line, a candidate thumbnail URL or the IPC output. Pinned in Task 3 (`redact` on client
   errors) and Task 8 (search output has only `nextlevel://scrape-thumb/…`).
4. **Quota or network loss mid-batch** — must pause the job (resumable), not mark every remaining
   game failed. Pinned in Task 12.
5. **Unwritable media folder / disk full / read-only drive** — apply reports a per-kind failure,
   still applies the chosen metadata, and leaves existing files untouched. Pinned in Task 8.

---

## M6a — Scraper core + credentials (`feat/m6a-scraper-core`)

### Task 1: Stories, docs and shared contracts (D16 settings v2)

**Files:**
- Modify: `docs/01-product/03-user-stories.md` (US-C5, US-C6, US-D6 *(proposed)*),
  `docs/03-architecture/data-model.md` (§2 `scraper` + `storage.media` as built, no
  `hasCredentials`, secrets keys; §4 `scrape_status` columns, `game_media.version`,
  `scrape_jobs`; art kinds D16), `docs/03-architecture/adr/ADR-013-single-runtime.md`
  (consequence: credentials D15, revisit before M10)
- Modify: `packages/shared/src/frontend/schema.ts` (`GAME_ART_KINDS` D16),
  `packages/shared/src/settings/schema.ts` (`CURRENT_SCHEMA_VERSION = 2`, `scraper`,
  `storage.media`), `apps/launcher/src/main/settings/migrate.ts` (v1→v2),
  `packages/shared/src/errors.ts` (7 codes), `packages/themes/src/engine/themeArt.ts`
  (`SCREENSHOT_KINDS`), `packages/themes/src/engine/useThemeArt.ts`, i18n `en.json`/`pt-BR.json`
- Create: `packages/shared/src/scraper/schema.ts` (+ export from `index.ts`)
- Test: `packages/shared/src/scraper/schema.test.ts`, `apps/launcher/src/main/settings/migrate.test.ts`,
  `packages/shared/src/settings/schema.test.ts`, existing themes tests updated

**Interfaces:**
- Produces (shared):
  - `GAME_ART_KINDS` (D16 order above); `type GameArtKind`.
  - `SCRAPE_FIELDS = ['title','description','year','developer','publisher','genre','players','rating'] as const`; `type ScrapeField`.
  - Settings: `scraper: { regionPriority: string[] (default ['us','eu','wor','jp'], each /^[a-z]{2,4}$/, 1–10), languagePriority: string[] (default [], /^[a-z]{2}$/), artKinds: GameArtKind[] (default box-front, logo-clear, screenshot-game-play, fanart), fields: ScrapeField[] (default all but title) }`;
    `storage.media: { mode: 'perRomFolder' } | { mode: 'central'; path: string }` (default perRomFolder; `path` absolute).
  - `ScrapeCandidateSchema { providerGameId: int>0, name, year: string|null, region: string|null, similarity: 0–100, thumb: string|null }`;
    `ScrapeSearchResultSchema { method: 'hash'|'title', candidates }`;
    `ScrapePreviewSchema { art: Record<GameArtKind, { local: boolean; available: boolean }>, fields: Record<ScrapeField, { current: string|number|null; scraped: string|number|null; locked: boolean }> }`;
    `ScrapeApplyInputSchema { gameId, providerGameId, kinds: GameArtKind[], fields: ScrapeField[] }`;
    `ScrapeApplyResultSchema { written: GameArtKind[]; failed: { kind: GameArtKind; code: 'notAvailable'|'download'|'write' }[]; game: GameDetails }`;
    `CredentialStatusSchema { available: boolean; devId: boolean; devPassword: boolean; user: boolean; password: boolean }`;
    `ScrapeStatusSchema { status: 'scraped'|'review'|'notFound'|'failed'; providerGameId: number|null; candidates: number; error: string|null; scrapedAt: string }`.

- [ ] **Step 1: Failing tests** — `schema.test.ts`: `defaultSettings().scraper` equals the defaults above; `storage.media` defaults to `{ mode: 'perRomFolder' }`; `central` with a relative path fails; `artKinds: ['screenshot-select']` fails. `migrate.test.ts`: `'v1 → v2 renames screenshot-title in themes.entries[*].art.gameArt (FR-SCR-4, D16)'` — input v1 with `gameArt: { all: ['screenshot-title','box-front'], snes: ['screenshot-select'] }` → v2 `{ all: ['screenshot-game-title','box-front'], snes: [] }`, `schemaVersion: 2`; a v1 file without themes migrates unchanged except the version; v3 → `newerVersion`.
- [ ] **Step 2: Run** `npx vitest run packages/shared apps/launcher/src/main/settings` → FAIL.
- [ ] **Step 3: Implement** the schemas, `migrate()` step (pure; SettingsService already backs up before writing a migrated file — verify with its test that a migrated load writes a backup, add the test if absent), the error codes with i18n keys `errors.scraperCredentials` etc., D16 in themes (`SCREENSHOT_KINDS = ['screenshot-game-play','screenshot-game-title']`), i18n labels for the new kinds, stories and docs.
- [ ] **Step 4: Run** `npm run typecheck && npx vitest run packages/shared packages/themes apps/launcher/src/main/settings` → PASS.
- [ ] **Step 5: Commit** `feat(shared): scraper contracts, D16 art kinds, settings v2 (FR-SCR-3, FR-SCR-4)`.

### Task 2: SecretStore and credential IPC (FR-SCR-3, US-D6)

**Files:**
- Create: `apps/launcher/src/main/secrets/SecretStore.ts`, `apps/launcher/src/main/scraper/credentialHandlers.ts`
- Modify: `packages/shared/src/ipc/contract.ts`, `apps/launcher/src/main/handlers.ts`, `apps/launcher/src/main/index.ts`
- Test: `apps/launcher/src/main/secrets/SecretStore.test.ts`, `apps/launcher/src/main/scraper/credentialHandlers.test.ts`

**Interfaces:**
- Produces:
  - `interface Cipher { available(): boolean; encrypt(text: string): Buffer; decrypt(data: Buffer): string }` (prod: `safeStorage.isEncryptionAvailable/encryptString/decryptString`).
  - `class SecretStore { constructor(file: string, cipher: Cipher); get(key: SecretKey): Promise<string|null>; setMany(values: Partial<Record<SecretKey, string|null>>): Promise<void>; has(key): Promise<boolean>; available(): boolean }`, `type SecretKey = 'screenscraper.devId'|'screenscraper.devPassword'|'screenscraper.user'|'screenscraper.password'`. File `<userData>/secrets.bin` = cipher(JSON map), written with the atomic-write helper; `null` deletes a key.
  - IPC `scraper.credentials.status: void → CredentialStatus`; `scraper.credentials.set: { devId?, devPassword?, user?, password?: string(1–200)|null } → CredentialStatus` (omitted = unchanged).
- [ ] **Step 1: Failing tests** — `'stores and reads values encrypted (FR-SCR-3)'` with a fake cipher that base64s + prefixes: file bytes never contain the plain value; `'null removes a key'`; `'unavailable cipher: setMany throws SECRETS_UNAVAILABLE, get returns null'`; `'unreadable/corrupt secrets.bin reads as empty and logs once'`; handlers: status never contains values; set with `user: ''` → `VALIDATION_FAILED`.
- [ ] **Step 2: Run** `npx vitest run apps/launcher/src/main/secrets apps/launcher/src/main/scraper` → FAIL.
- [ ] **Step 3: Implement**; wire `safeStorage` in `index.ts`.
- [ ] **Step 4: Run** → PASS; `npm run typecheck`.
- [ ] **Step 5: Commit** `feat(launcher): credential store for the scraper (FR-SCR-3)`.

### Task 3: ScreenScraper port — pure matching, metadata, media selection

**Files:**
- Create: `apps/launcher/src/main/scraper/screenscraper/titles.ts` (normalize, region, variants, Levenshtein),
  `rank.ts`, `metadata.ts`, `mediaSelect.ts`, `redact.ts`, `types.ts` (lenient Zod for `jeu`, `jeux`, `ssuser`, `systemes`)
- Test: one `*.test.ts` per file; cases ported from `scrappers/test_scrape_library.py` / `test_scrape_cli.py` with invented titles

**Interfaces:**
- Produces:
  - `normalizeTitle(value: string, opts?: { isTitle?: boolean }): string`; `extractRegion(filename: string): string|null`; `queryVariants(normalized: string): string[]`; `similarity(a: string, b: string): number` (0–100).
  - `rankCandidates(games: SsGame[], query: { normalized: string; matched: string; region: string|null; threshold: number; isTitle: boolean }): GameMatch[]` with `GameMatch { providerGameId; name; similarity /* 2 decimals */; regionMatch: boolean|null; game: SsGame }`, sorted by similarity then region match, ids de-duplicated; ±5 region bonus/penalty; threshold 60 for the dialog (`SEARCH_THRESHOLD`).
  - `extractMetadata(game: SsGame, langs: string[]): Record<Exclude<ScrapeField,'title'>, string|number|null>` and `gameName(game, regions: string[]): string|null` (for `title`).
  - `selectMedia(game: SsGame, regions: string[]): Partial<Record<GameArtKind, SsMedia>>` (Global Constraints mapping); `targetExtension(kind: GameArtKind, sourceFormat: string): '.png'|'.jpg'|'.mp4'` (D17).
  - `redact(text: string): string`.
- [ ] **Step 1: Failing tests** (names cite FR-SCR-1): normalize keeps `dr mario` in title mode and drops `(USA)`, `[!]`, `the`, punctuation; `extractRegion('Foo (Europe)') === 'eu'`; `queryVariants('a b c d')` = `['a b c d','a b c','b c d','a b','c d']`; rank picks the better of several regional names and applies the region bonus; a candidate below threshold is dropped; metadata picks the `en` synopsis over `fr`, falls back to the first; year prefers `wor` over `jp`, `'1994-03-01'` → `1994`; rating `'16'` → `4`; media picks `us` box over `jp`, `wheel-us` maps to `logo-clear`, unknown types ignored; `targetExtension('fanart','jpg') === '.jpg'`, `('box-front','jpg') === '.png'`, `('video','mp4') === '.mp4'`; `redact('https://x/?devid=a&devpassword=b&ssid=c&sspassword=d&x=1')` hides all four.
- [ ] **Step 2: Run** `npx vitest run apps/launcher/src/main/scraper/screenscraper` → FAIL.
- [ ] **Step 3: Implement** (port; keep functions pure).
- [ ] **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `feat(launcher): port ScreenScraper matching and metadata (FR-SCR-1)` with `ported from NextLevelOS scrappers/ScreenScraper.py @ 3d530b7`.

### Task 4: HTTP client, quota, cache and ROM hashing

**Files:**
- Create: `apps/launcher/src/main/scraper/screenscraper/client.ts`, `quota.ts`, `cache.ts`,
  `apps/launcher/src/main/scraper/hashRom.ts`, `apps/launcher/src/main/scraper/testing.ts` (fake `fetch` router + invented `jeu` builders)
- Test: `client.test.ts`, `quota.test.ts`, `cache.test.ts`, `hashRom.test.ts`

**Interfaces:**
- Consumes: `redact`, `types.ts` (Task 3); `SecretStore` (Task 2).
- Produces:
  - `interface ScreenScraperCredentials { devId: string; devPassword: string; user: string|null; password: string|null }`.
  - `class ScreenScraperClient { constructor(deps: { fetch: typeof fetch; credentials: () => Promise<ScreenScraperCredentials|null>; baseUrl: string; cache: ScraperCache; quota: QuotaGate; clock: () => number; sleep: (ms) => Promise<void> }); systems(): Promise<{ id: number; name: string }[]>; identify(hashes: RomHashes, romName: string, systemId: number): Promise<SsGame|null>; search(query: string, systemId: number, opts?: { refresh?: boolean }): Promise<SsGame[]>; game(providerGameId: number, systemId: number, opts?): Promise<SsGame>; user(): Promise<SsUser>; download(url: string, signal?: AbortSignal): Promise<{ bytes: Buffer; format: string }> }`. No credentials → `NO_CREDENTIALS`. `search` does the system-filtered query, then unfiltered + `systeme.id|parentid` filter when empty (as `_search_games_api`).
  - `class QuotaGate { constructor(clock, sleep); run<T>(fn: () => Promise<T>): Promise<T>; update(user: SsUser): void; state(): { requestsToday: number|null; maxPerDay: number|null; exhaustedUntil: string|null } }` — serializes to `maxthreads`, spaces requests, sets `exhaustedUntil` = next 00:00 Europe/Paris on 430.
  - `class ScraperCache { constructor(file: string, clock); get(kind: 'systems'|'game'|'search'|'hash', key: string): unknown|null; put(kind, key, value): void; close(): void }` (TTLs per Assumptions).
  - `hashRom(path: string): Promise<RomHashes|null>` (`{ size, crc /* 8 hex lowercase */, md5, sha1 }`; null when not hashable per Assumptions).
- [ ] **Step 1: Failing tests** — request carries the four credential params and `softname=NextLevel`; 403 → `SCRAPER_CREDENTIALS`; 430 → `SCRAPER_QUOTA` and `state().exhaustedUntil` set; 429 retried 3× with sleeps 2000/4000/8000 then `SCRAPER_QUOTA`; a `fetch` rejection whose message contains the URL → `SCRAPER_NETWORK` with a redacted message; 404 on identify → `null`; `response.error` field → `SCRAPER_UNAVAILABLE`; second `game()` hits the cache (fetch called once); expired entry refetches; `ssuser` updates the gate; two concurrent `run` calls with `maxthreads` 1 never overlap; `hashRom` of a 3-byte invented file matches precomputed crc/md5/sha1; `.cue` and ≥ 512 MiB (stubbed `stat`) → null.
- [ ] **Step 2: Run** `npx vitest run apps/launcher/src/main/scraper` → FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `feat(launcher): ScreenScraper client with quota, cache and ROM hashing (FR-SCR-1, FR-SCR-2)`.

### Task 5: Settings → Scraper, docs, review, PR (M6a)

**Files:**
- Create: `apps/launcher/src/renderer/features/settings/scraper/ScraperSection.tsx`, `CredentialsFields.tsx`, `PriorityListField.tsx` (reuse the themes ordered-list pattern), `scraperApi.ts`
- Modify: `SettingsApp.tsx` (section `scraper` after `themes`, icon `ImageDown`), `contract.ts` (`scraper.test: void → { user: string|null; requestsToday: number|null; maxRequestsPerDay: number|null }`), `apps/launcher/src/main/scraper/credentialHandlers.ts`, `docs/02-design/screen-specifications.md` (S9 Scraper as built), `CHANGELOG.md` (Unreleased)
- Test: `ScraperSection.test.tsx`, handler test for `scraper.test`, `apps/launcher/e2e/settings.spec.ts` (one flow)

- [ ] **Step 1: Failing tests** — `'US-D6: saving the account stores it via scraper.credentials.set and shows "Saved" without echoing the password'`; password fields are `type=password`, empty means unchanged, **Remove** clears (asks first); Advanced group collapsed by default and shows "Required" when dev id is missing; unavailable store shows the `SECRETS_UNAVAILABLE` message and disables Save; **Test** shows "Signed in as X · N of M requests today" or the translated error; region/language order and default art kinds/fields save through settings (Save stays off while invalid); e2e: create `apps/launcher/e2e/fakeScreenScraper.ts` (an `http.createServer` on a free port answering `ssuserInfos.php`; Task 9 extends it), point `NEXTLEVEL_SCREENSCRAPER_URL` at it, enter credentials, Test succeeds, restart keeps "Saved".
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement.** **Step 4:** `npm run lint`, `npm run typecheck`, `npm test`, `npm run test:e2e` → PASS.
- [ ] **Step 5: Commit** `feat(launcher): Settings → Scraper (FR-SCR-3, US-D6)`; fresh Opus review of the branch; fixes failing-first; PR "M6a"; CI green (`gh pr checks <n>` alone); owner OK → squash-merge; check the main push run.

## M6b — Single-game scrape (`feat/m6b-scrape-game`)

### Task 6: `scrape_status`, `game_media.version`, repositories

**Files:**
- Modify: `apps/launcher/src/main/library/schema.ts` (+ migration `0007_*` via `npm run db:generate -w apps/launcher`; delete `node_modules/.vitest-cache`), `MediaRepository.ts`, `GameRepository.ts`, `packages/shared/src/frontend/urls.ts`, `packages/shared/src/frontend/schema.ts` (`ThemeGame.mediaVersions: Record<string, number>`), `apps/launcher/src/main/frontend/FrontendService.ts`, `LauncherThemeHost.ts`, `packages/themes/src/host/FakeThemeHost.ts`, `apps/launcher/src/main/scan/media.ts` (rows carry `version` = mtime ms)
- Create: `apps/launcher/src/main/library/ScrapeRepository.ts`
- Test: `MediaRepository.test.ts`, `ScrapeRepository.test.ts`, `GameRepository.write.test.ts`, `urls.test.ts`

**Interfaces:**
- Produces:
  - table `scrape_status(game_id PK FK cascade, provider text, provider_game_id int?, status text, candidates int, error text?, scraped_at text)`; `game_media.version integer not null default 0`.
  - `MediaRepository.upsert(row: GameMediaRow & { version: number }): void`; `GameMediaRow.version`.
  - `GameRepository.applyScraped(gameId: number, values: Partial<Record<ScrapeField, string|number|null>>, opts: { overrideLocked: ScrapeField[] }, now: Date): GameDetails` — writes only unlocked fields plus `overrideLocked`; never adds to `locked_fields`; `title` updates `sort_title`; `rating` column.
  - `ScrapeRepository.set(gameId, status: ScrapeStatus): void`, `get(gameId): ScrapeStatus|null`; `GameDetails.scrape: ScrapeStatus|null`.
  - `mediaUrl(gameId: number, kind: string, version?: number): string` (`?v=` when version given).
- [ ] **Step 1: Failing tests** — Review Focus 1: `'upsert replaces the row and the theme URL changes (FR-SCR-5)'`; `applyScraped` leaves a locked `genre` alone unless in `overrideLocked`, and `locked_fields` is unchanged afterwards (D19); scan rows keep versions; deleting a game cascades `scrape_status`.
- [ ] **Step 2–4:** run → FAIL, implement, run → PASS (`npx vitest run apps/launcher/src/main/library packages/shared packages/themes`).
- [ ] **Step 5: Commit** `feat(launcher): scrape status and versioned media index (FR-SCR-5)`.

### Task 7: MediaWriter (D17, FR-SCR-4)

**Files:**
- Create: `apps/launcher/src/main/scraper/mediaTarget.ts`, `apps/launcher/src/main/scraper/MediaWriter.ts`
- Test: `mediaTarget.test.ts`, `MediaWriter.test.ts` (temp dirs)

**Interfaces:**
- Produces:
  - `mediaDir(game: { systemId: string; relPath: string; locationPath: string }, settings: Settings, catalog): string` → per Assumptions; `romStem(relPath: string): string` = base name without its last extension, verbatim (same rule as `matchMedia`); `MediaWriter.write` refuses a stem that is empty or contains `/` or `\` with `VALIDATION_FAILED`.
  - `class MediaWriter { constructor(deps: { toPng: (bytes: Buffer) => Buffer|null /* nativeImage; null = cannot decode */; clock }); write(dir: string, kind: GameArtKind, stem: string, bytes: Buffer, format: string): Promise<{ path: string; size: number; version: number }> }` — temp file under `<dir>/.nextlevel-tmp/`, rename into `<dir>/<kind>/<stem><ext>`, then delete other `<stem>.*` files in that kind folder (case-insensitive stem); undecodable image → keep original bytes under `.png` (as NextLevelOS).
- [ ] **Step 1: Failing tests** — Review Focus 2: stems `Foo (USA) [!]`, `Bär & Co.'s`, `trailing.` (from `trailing..zip`), ROM `!hacks/x.sfc` → file `x.png` in the system's media folder; JPEG source for `box-front` written as `.png` via `toPng`; old `foo.jpg` removed after `foo.png` lands; a failed write (dir is a file) throws and leaves the old file; no `.nextlevel-tmp` leftovers; central mode path `<central>/<systemId>/<kind>/`.
- [ ] **Step 2–4:** FAIL → implement → PASS. **Step 5: Commit** `feat(launcher): media writer in NextLevelOS formats (FR-SCR-4, D17)`.

### Task 8: ScrapeService + IPC + thumbnails (FR-SCR-1)

**Files:**
- Create: `apps/launcher/src/main/scraper/ScrapeService.ts`, `apps/launcher/src/main/scraper/scrapeHandlers.ts`
- Modify: `contract.ts`, `handlers.ts`, `index.ts`, `apps/launcher/src/main/protocol/register.ts` + `resolveUrl.ts` (`scrape-thumb` host)
- Test: `ScrapeService.test.ts`, `scrapeHandlers.test.ts`, `protocol/register.test.ts`

**Interfaces:**
- Consumes: Tasks 3, 4, 6, 7.
- Produces IPC: `scraper.systems: void → {id,name}[]`; `scraper.search: { gameId; title?: string; refresh?: boolean } → ScrapeSearchResult` (title given = title only); `scraper.preview: { gameId; providerGameId } → ScrapePreview`; `scraper.apply: ScrapeApplyInput → ScrapeApplyResult`; `scraper.setSystemId: { systemId; screenscraperId } → void` (settings update).
  `ScrapeService { search; preview; apply; thumbnail(providerGameId): Promise<{ bytes; mime }|null> }`.
- [ ] **Step 1: Failing tests** — hash match returns one candidate `method: 'hash'`, similarity 100; hash miss falls back to title; missing game never hashes; no system id → `NO_SCRAPER_SYSTEM`; Review Focus 3: no output string contains `devpassword` or `http` (thumbs are `nextlevel://scrape-thumb/<id>`); preview marks `local` from `game_media` and `locked` from `locked_fields`; apply writes kinds, upserts media, applies fields, sets `scrape_status` `scraped`, emits `library.changed` with `gameIds`; Review Focus 5: write failure for `video` → `failed: [{ kind: 'video', code: 'write' }]`, metadata still applied, other kinds written; a kind not available → `notAvailable`; concurrent apply on the same game → `BUSY`.
- [ ] **Step 2–4:** FAIL → implement → PASS. **Step 5: Commit** `feat(launcher): single-game scrape service (FR-SCR-1, FR-SCR-5)`.

### Task 9: Library Scrape… dialog + e2e

**Files:**
- Create: `apps/launcher/src/renderer/features/scrape/ScrapeDialog.tsx`, `CandidateList.tsx`, `PreviewTable.tsx`, `SystemPicker.tsx`, `scrapeApi.ts`, `useScrape.ts`; `apps/launcher/e2e/fakeScreenScraper.ts` (http server on a free port, invented `jeu` data, PNG bytes generated in code); `apps/launcher/e2e/scrape.spec.ts`
- Modify: `GameContextMenu.tsx` (Scrape… after Edit details), `GameDetails.tsx` (scrape status line: "Scraped <date>" / "Needs review" / "Not found"), `LibraryOverlays.tsx`
- Test: `ScrapeDialog.test.tsx`, `PreviewTable.test.tsx`

- [ ] **Step 1: Failing tests** — `'US-C5: searching on open, best candidate preselected, preview rows default to missing art and empty fields'`; **Overwrite existing** ticks available kinds/fields that have values; locked fields show a lock and stay unticked even with Overwrite (D19), ticking one sends it; title row unticked; Search box re-searches by title with `refresh`; `NO_SCRAPER_SYSTEM` shows SystemPicker → save → searches again; partial failure lists failed kinds and keeps the dialog open; Esc closes; late results after close are ignored. e2e: game in fixture library → Scrape… → Apply → details image updates and the file exists in `media/box-front/<stem>.png`.
- [ ] **Step 2–4:** FAIL → implement → PASS (`npx vitest run apps/launcher/src/renderer/features/scrape`, `npm run test:e2e`).
- [ ] **Step 5: Commit** `feat(launcher): Scrape… in the Library (FR-SCR-1, US-C5)` with `UI behaviour from NextLevelOS src/apps/ScrapeGame @ 3d530b7`.

### Task 10: Docs, review, PR (M6b)

- [ ] Screen spec S7 (Scrape… as built), data model, CHANGELOG Unreleased; `npm run lint`, `typecheck`, `test`, `test:e2e`; fresh Opus review; fixes failing-first; PR "M6b"; CI; owner OK; merge; main run.

## M6c — Media location + batch engine (`feat/m6c-media-batch`)

### Task 11: Central media folder (FR-SCR-4)

**Files:**
- Modify: `apps/launcher/src/main/scan/walk.ts`/`walker.ts`/`plan.ts` (job carries `centralMediaDir: string|null`), `ScanService.ts`, `StorageSection.tsx` (+ `MediaLocationField.tsx`), docs S9 Storage
- Test: `walk.test.ts`, `ScanService.test.ts`, `StorageSection.test.tsx`

- [ ] **Step 1: Failing tests** — `'central media is indexed before per-ROM media; per-ROM fills kinds central lacks (FR-SCR-4)'`; missing central folder = no central media, scan not failed; changing mode in Settings shows "Rescan to update art" and a **Scan all** button; folder picker; relative path invalid.
- [ ] **Step 2–4:** FAIL → implement → PASS. **Step 5: Commit** `feat(launcher): central media folder (FR-SCR-4)`.

### Task 12: BatchScrapeService (FR-SCR-2, D18)

**Files:**
- Modify: `schema.ts` (+ migration `0008_*`: `scrape_jobs(id PK, scope json, rules json, status text, cursor_game_id int?, done int, applied int, review int, not_found int, failed int, created_at, updated_at, paused_reason text?)`), `contract.ts`, `events.ts`
- Create: `apps/launcher/src/main/scraper/batch/BatchScrapeService.ts`, `batch/nextGame.ts`, `batch/batchHandlers.ts`
- Test: `BatchScrapeService.test.ts`, `nextGame.test.ts`, `nextGame.perf.test.ts` (project `launcher-perf`)

**Interfaces:**
- Produces:
  - `BatchRules { onlyMissing: boolean; kinds: GameArtKind[]; fields: Exclude<ScrapeField,'title'>[]; regions: string[] }`; `BatchScope { systemIds: string[] } | { gameIds: number[] }` (≤ 50,000 ids).
  - `BatchStatus { jobId: number|null; state: 'idle'|'running'|'paused'|'finished'; pausedReason: 'quota'|'network'|'credentials'|'user'|null; resumeAt: string|null; total; done; applied; review; notFound; failed; current: { gameId; title }|null }`.
  - IPC `scraper.batch.start: { scope; rules } → BatchStatus` (`BUSY` while one runs or a scan runs); `scraper.batch.pause`, `scraper.batch.resume`, `scraper.batch.cancel`, `scraper.batch.status`; event `scraper.batch.progress: BatchStatus`.
  - `nextGame(db, job): { gameId }|null` — games in scope with `id > cursor`, ordered by id; with `onlyMissing`, skips games that have every chosen kind in `game_media` and every chosen field non-empty.
- [ ] **Step 1: Failing tests** — D18: hash match → applied; single candidate ≥ 90 → applied; two candidates → `scrape_status` `review` with `candidates: 2`, nothing written; none → `notFound`; locked fields untouched; Review Focus 4: `SCRAPER_QUOTA` pauses with `pausedReason: 'quota'`, `resumeAt` = gate's `exhaustedUntil`, the current game is retried on resume (not counted failed); `SCRAPER_NETWORK` pauses after 3 consecutive network failures; `SCRAPER_CREDENTIALS` pauses `credentials`; a per-game write failure counts `failed` and continues; app restart: a `running` job in the DB resumes from its cursor on `start()` of the service (resumed jobs whose `resumeAt` is in the future wait until then); cancel stops after the current game; missing games are title-searched; perf: `nextGame` over 200k games ≤ `perfBudget(50)` ms.
- [ ] **Step 2–4:** FAIL → implement → PASS. **Step 5: Commit** `feat(launcher): resumable batch scrape (FR-SCR-2, D18)`.

### Task 13: Docs, review, PR (M6c)

- [ ] Data model (`scrape_jobs`), architecture (`ScraperService`, `MediaIndex` as built), CHANGELOG; full checks; fresh Opus review; fixes; PR "M6c"; CI; owner OK; merge; main run.

## M6d — Batch UI, Needs review, release (`feat/m6d-batch-ui`)

### Task 14: Scrape ▾, rules dialog, progress

**Files:**
- Create: `apps/launcher/src/renderer/features/scrape/ScrapeMenu.tsx`, `BatchRulesDialog.tsx`, `BatchProgress.tsx`, `useBatchStatus.ts`
- Modify: Library header (next to Scan ▾), `GameContextMenu.tsx` (multi-select: Scrape selected…)
- Test: `ScrapeMenu.test.tsx`, `BatchRulesDialog.test.tsx`, `BatchProgress.test.tsx`

- [ ] **Step 1: Failing tests** — `'US-C6: Scrape <system>… opens the rules with Settings defaults, Start begins the job'`; rules: Only missing (on), kinds, fields (no title), region order; Start disabled with no kind and no field; header shows "Scraping n/m · applied a · review r" with Pause/Resume/Cancel; paused quota shows "Daily quota reached — resumes at <time>"; credentials pause shows **Open Settings** (deep link to Scraper via `params.section`); status is read on mount (Library closed and reopened mid-batch shows the running job); finished summary with **Show Needs review**.
- [ ] **Step 2–4:** FAIL → implement → PASS. **Step 5: Commit** `feat(launcher): batch scrape in the Library (FR-SCR-2, US-C6)`.

### Task 15: Needs review filter + e2e

**Files:**
- Modify: `packages/shared/src/library/games.ts` (`GameListQuery.filter` adds `'needsReview'`), `GameRepository.ts`, `LibraryStatusBar.tsx`, `ScrapeDialog.tsx` (on success clears `review`)
- Create: `apps/launcher/e2e/scrape-batch.spec.ts`
- Test: `GameRepository.test.ts`, `LibraryStatusBar` test

- [ ] **Step 1: Failing tests** — filter lists games with status `review`, count in the status bar; scraping one from the dialog removes it from the list; e2e against the fake server: batch a 4-game system (one hash hit, one single ≥ 90, one ambiguous, one not found) → counts 2/1/1, Needs review shows the ambiguous game, scraping it clears it; quota scenario (fake server returns 430 after 2 requests) pauses and shows the quota message.
- [ ] **Step 2–4:** FAIL → implement → PASS. **Step 5: Commit** `feat(launcher): Needs review filter (FR-SCR-2, D18)`.

### Task 16: Docs, review, PR, release v0.6.0

- [ ] Screen spec S7 (Scrape ▾ as built), roadmap M6 ☑, CHANGELOG `0.6.0`, user guide `docs/02-design/scraping-guide.md` (credentials, single, batch, media location, formats D17); full checks; fresh Opus review; fixes; PR "M6d"; CI; owner OK; merge; main run; tag `v0.6.0` on the merge commit; `gh release create v0.6.0` with the CHANGELOG 0.6.0 notes; delete `.superpowers/sdd/2026-10-24-m6-scraping-media/` after listing its rulings and deferred minors.
