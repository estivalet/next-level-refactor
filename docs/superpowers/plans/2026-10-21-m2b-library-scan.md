# M2b Library Database and Scan Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The launcher keeps a SQLite library (`library.db`). A background scan, started from Settings → Storage, finds new, moved and missing games in every storage location, collapses multi-disc sets into one game, enables the systems it finds games for, and reports progress, which the user can cancel.

**Architecture:**
- `apps/launcher/src/main/library/` owns `library.db`: the Drizzle schema, a small migrator over embedded SQL files (with a backup first), and a `LibraryRepository`. Only the main process opens the DB.
- `apps/launcher/src/main/scan/` splits the scan in two:
  - A worker thread only walks folders (the slow part, especially on HDDs and network drives) and returns the files it found.
  - The main thread diffs those files against the library and applies the result in one transaction per system.
  - `ScanService` runs the systems one by one, emits events and handles cancel.
- The typed bridge gains main → renderer **events** (`scan.progress`, `scan.finished`, `settings.changed`, `library.changed`). Settings drafts **rebase** onto a newer snapshot instead of being thrown away, so a scan that enables systems never wipes unsaved edits.

**Tech Stack:** Existing stack, plus:
- `better-sqlite3@^13.0.3`: bundles N-API prebuilds. Verified 2026-10-21 to load with FTS5 in Node 24.15, Electron 45 (Node 24.22, ABI 150) and an Electron worker thread, with no native rebuild.
- `drizzle-orm@^0.45.4`.
- `drizzle-kit` (dev).

**Spec:**
- FR-LIB-1, FR-LIB-3, FR-LIB-4, FR-LIB-5, NFR-REL-1.
- Data model §1 (identity), §2.4 (resolution) and §4 (library).
- ADR-003 (better-sqlite3 + Drizzle, WAL, main-process only).
- Architecture §4.1–4.2 (ScanService in a worker, events) and coding standards ("long work off the main thread", "DB access only through repositories").
- API spec §3: `scan.start` / `scan.cancel` / `scan.status`, `systems.list`, and the events.
- Test strategy C4.
- **Port:** NextLevelOS `electron/romScan.cjs` + `romScan.test.ts` @ 3d530b7, and the Disc/Disk/Tape/Cassette/Side rules of `scripts/nextlevel-gamelist-cleanup-multidisk.py` @ 3d530b7.
- **Owner decisions 2026-10-21:**
  - The scan is started from **Settings → Storage** ("Scan now", with progress, Cancel and per-system results). M2c's Library app reuses the same IPC.
  - **"Scan all"** covers enabled systems plus every catalog system the user never touched whose folder exists in a storage location. Untouched systems with games are enabled automatically. Nothing is ever disabled automatically.

## Global Constraints

- **Library file:** `<data>/library.db`.
  - Pragmas on open: `journal_mode = WAL`, `foreign_keys = ON`, `busy_timeout = 5000`.
  - `meta(key, value)` holds `schema_version`.
  - Before migrating an existing DB, back it up to `<data>/backups/library-<ISO with : and . replaced by ->-v<old>.db` using `db.backup()`.
  - A DB whose `schema_version` is newer than the app's refuses to open (`LIBRARY_UNAVAILABLE`, `details.reason: 'newerVersion'`).
- **M2b tables:** `meta`, `games` and `game_metadata`, exactly as in data model §4, with these details:
  - `games.rel_path` is `TEXT COLLATE NOCASE`, `UNIQUE(system_id, rel_path)`, plus an index on `system_id`.
  - `missing` is an integer 0/1, `mtime` is in ms, and `added_at` / `missing_since` are ISO strings.
  - `game_metadata.game_id` has `ON DELETE CASCADE`.
  - `locked_fields` is a JSON text column defaulting to `'[]'`.
  - The other §4 tables arrive with M2c, as new migrations.
- **rel_path** is relative to the system folder and uses `/` as the separator (`! Brazil/Game (Brazil).zip`).
- **Walk rules (ported):**
  - Scan the system folder and one sub-folder level.
  - Skip a root sub-folder named `media`, case-insensitively (that's where game art lives).
  - Keep only accepted extensions.
  - Drop files referenced by a `.cue` (`FILE "x"` lines) or a `.m3u` (non-`#` lines) found in the same location. A leading `\` or `/` in a reference is relative to the playlist folder. References are compared case-insensitively. Playlists over 256 KiB are ignored.
- **Locations:**
  - System folder = `<location.path>/<settings.systems[id].folderName ?? catalog.defaultFolderName>`.
  - Extensions = `settings.systems[id].extensions ?? catalog.extensions`.
  - Locations are tried in `orderedLocations` order, and the first location containing a rel_path wins (compared case-insensitively).
- **Multi-disc:** stems matching `/\b(Disk|Disc|Tape|Cassette)\s+(\d+)(?:\s+Side\s+([AB]))?\b/i` are grouped by folder plus normalized name. The normalized name removes that match, standalone `Side A|B`, empty `()`, and runs of whitespace.
  - A group with ≥ 2 members becomes one game: the member with the lowest (number, side A before B, then rel_path).
  - That game's `disc_group` is the normalized name.
  - If an `.m3u` with that normalized stem is in the same folder, the m3u is the game and the whole group is dropped.
- **Diff, per system:**
  - Match existing rows by rel_path, case-insensitively.
  - **Moved:** a found file and an unmatched existing row with the same basename (case-insensitive) and the same size, each the only candidate for the other. The row keeps its id and metadata and gets the new rel_path.
  - A found row that was missing is **restored**: `missing = 0`, `missing_since = null`.
  - An unmatched row that is present becomes **missing**, with `missing_since = now`. An already missing row is untouched.
  - **Never delete rows** (FR-LIB-4).
  - New games get `game_metadata.title` from the file name: basename without extension, disc tag removed (as normalized above), tags like `(USA)` kept. `sort_title` is `title.toLowerCase()`.
  - Existing metadata is never changed by a scan.
- **Scope of a scan:** `scan.start({ systemIds? })`.
  - Without ids: systems with `enabled: true`, plus systems with **no** settings entry whose folder exists in at least one location.
  - With ids: exactly those, which must exist in the catalog.
  - Systems with an entry and `enabled: false` are skipped unless named explicitly.
  - After the scan, every scanned system that has ≥ 1 present game and **no** settings entry gets `{ enabled: true }` in one settings write (`SettingsService.update`), and their ids are reported as `enabledSystemIds`.
- **Cancel:** checked between systems; the worker is terminated at once. A system whose walk was interrupted is not applied. Systems already applied stay applied. The outcome is `'cancelled'`.
- **One scan at a time:** `scan.start` while running returns the running status and does not start a second scan.
- **Events (main → renderer):**
  - Channels are prefixed `event:` on the wire.
  - Payloads are validated against `ipcEvents` in shared before sending.
  - The bridge exposes `on(event, listener) → unsubscribe`, and the preload only subscribes to known events.
- **New error code:** `LIBRARY_UNAVAILABLE` → `errors.libraryUnavailable`. If `library.db` can't be opened, the app still starts. Library and scan channels then fail with that code, and the scan panel says so, with an "Open data folder" button.
- **i18n:** strings go into both `en.json` and `pt-BR.json`. Counts use i18next plurals (`_one` / `_other`). Components ≤ 200 lines, files ≤ 400.
- **Tests:** test names carry requirement IDs. Main-process tests use real temp folders and a real temp `library.db`.
- **Branch:** `feat/m2b-library-scan`.

## Review Focus

1. **A disconnected drive, then reconnected** (C4). Games on it go missing, and nothing is deleted. On reconnect the same rows (same ids, same metadata) are restored, not re-added. Pinned in Task 4.
2. **A file moved into a sub-folder** (same name and size) keeps its id and metadata (moved, not missing + new). When two candidates share a basename and size, nothing is guessed. Pinned in Task 3.
3. **A system the user switched off** (`enabled: false`) whose folder holds games. "Scan all" neither scans nor re-enables it. Pinned in Task 4.
4. **Unsaved edits in Settings → Systems while a scan enables systems.** The draft rebases onto the new settings, so the user's edits and the newly enabled systems both survive. Pinned in Task 6.
5. **Cancel in the middle of a large system.** The worker stops, that system's rows are unchanged, and earlier systems stay applied. Status returns to idle with outcome `cancelled`. Pinned in Task 4.

---

### Task 1: Contracts: scan/library schemas, events, error code, docs

**Files:**
- Create: `packages/shared/src/library/schema.ts` (+ `schema.test.ts`), `packages/shared/src/ipc/events.ts` (+ `events.test.ts`)
- Modify: `packages/shared/src/ipc/contract.ts` (+ test), `packages/shared/src/errors.ts`, `packages/shared/src/index.ts`, both locale files
- Docs: `docs/03-architecture/data-model.md` §4 ("Implemented so far" paragraph: the M2b tables, NOCASE rel_path, `disc_group` meaning, library backups) and `docs/03-architecture/api-spec.md` §3 (channels, events, `on`, `LIBRARY_UNAVAILABLE`)

**Interfaces (Produces):**
- `ScanSystemResultSchema = z.object({ systemId: z.string(), present: int ≥ 0, added: int ≥ 0, moved: int ≥ 0, restored: int ≥ 0, missing: int ≥ 0 })`. Here `missing` is newly missing in this scan, and `present` is games present after the scan.
- `ScanProgressSchema = z.object({ scanId: z.string(), systemsDone: int, systemsTotal: int, systemId: z.string().nullable(), filesSeen: int })`.
- `ScanSummarySchema = z.object({ scanId, startedAt: z.string(), finishedAt: z.string(), outcome: z.enum(['completed','cancelled','failed']), systems: z.array(ScanSystemResultSchema), enabledSystemIds: z.array(z.string()) })`.
- `ScanStatusSchema = z.object({ running: z.boolean(), progress: ScanProgressSchema.nullable(), last: ScanSummarySchema.nullable() })`.
- `SystemSummarySchema = z.object({ id: z.string(), enabled: z.boolean(), games: int, missing: int })`. Here `games` counts present and missing games, and `missing` counts missing games.
- Contract additions:
  - `'scan.start': { input: z.strictObject({ systemIds: z.array(z.string()).min(1).optional() }), output: ScanStatusSchema }`
  - `'scan.cancel': { input: z.void(), output: ScanStatusSchema }`
  - `'scan.status': { input: z.void(), output: ScanStatusSchema }`
  - `'systems.list': { input: z.void(), output: z.array(SystemSummarySchema) }`, with one entry per catalog system.
- `ipcEvents = { 'scan.progress': ScanProgressSchema, 'scan.finished': ScanSummarySchema, 'settings.changed': SettingsSnapshotSchema, 'library.changed': z.object({ systems: z.array(z.string()) }) } as const`.
- `type IpcEvent = keyof typeof ipcEvents`, `IpcEventPayload<E>` and `eventChannel(e: IpcEvent): string` (returns `` `event:${e}` ``).
- `NextLevelBridge.on<E extends IpcEvent>(event: E, listener: (payload: IpcEventPayload<E>) => void): () => void`.
- `ERROR_CODES.LIBRARY_UNAVAILABLE = 'errors.libraryUnavailable'`.

- [ ] **Step 1: Write the failing tests:**
  - `'FR-LIB-3: scan.start takes optional non-empty system ids'`: `{}` and `{ systemIds: ['nintendo-64'] }` parse; `{ systemIds: [] }` and `{ extra: 1 }` fail.
  - `'FR-LIB-3: scan status carries progress and the last summary'`: a sample status with an outcome of `'cancelled'` round-trips.
  - `'FR-LIB-3: every event has a payload schema and an event: channel'`: `eventChannel('scan.progress') === 'event:scan.progress'`, and no event name equals a contract channel.
- [ ] **Step 2:** Run `npx vitest run packages/shared`. Expected: FAIL (modules missing).
- [ ] **Step 3: Implement the schemas, events, contract entries and the error code.**
  - Add `errors.libraryUnavailable` to both locales: "The game library could not be opened." / "Não foi possível abrir a biblioteca de jogos."
  - Every existing fake bridge (`apps/launcher/src/renderer/bridge.ts` `missingBridge`, `test-utils.tsx`) gets an `on` that returns a no-op unsubscribe, so typecheck passes.
- [ ] **Step 4:** Run `npx vitest run packages/shared` and `npm run typecheck`. Expected: PASS.
- [ ] **Step 5:** Update the docs listed above.
- [ ] **Step 6: Commit:** `feat(shared): scan, library and event contracts (FR-LIB-3)`.

### Task 2: Library DB: schema, migrator, repository

**Files:**
- Create in `apps/launcher/src/main/library/`:
  - `schema.ts`: Drizzle tables.
  - `migrations/0000_*.sql`: generated, then committed.
  - `migrate.ts` (+ test).
  - `openLibrary.ts` (+ test).
  - `LibraryRepository.ts` (+ test).
  - `testing.ts`: a `tempLibrary()` helper.
- Create: `apps/launcher/drizzle.config.ts`, `apps/launcher/src/main/env.d.ts` (`/// <reference types="vite/client" />` and `/// <reference types="electron-vite/node" />`)
- Modify:
  - `apps/launcher/package.json`: deps `better-sqlite3@^13.0.3` and `drizzle-orm@^0.45.4`; devDep `drizzle-kit`; script `"db:generate": "drizzle-kit generate"`. Add `@types/better-sqlite3` only if v13 ships no types.
  - `apps/launcher/electron.vite.config.ts`: keep `better-sqlite3` external (default). Nothing else should be needed, so verify.
  - `CLAUDE.md` commands table: add `npm run db:generate -w apps/launcher`.

**Interfaces (Produces):**
- `type LibraryDb = BetterSQLite3Database<typeof schema> & { $client: Database.Database }`, which is what Drizzle's `drizzle()` returns.
- `migrations(): Array<{ version: number; sql: string }>`: built from `import.meta.glob('./migrations/*.sql', { query: '?raw', import: 'default', eager: true })`, sorted by file name, with version = index + 1.
- `migrate(client: Database.Database, list, backup: (fromVersion: number) => void): { from: number; to: number }`:
  - Each pending file is split on `--> statement-breakpoint` and applied in one transaction, together with the `schema_version` update.
  - `backup` is called once, before the first pending file, and only if `from > 0`.
  - It throws `AppErrorException(LIBRARY_UNAVAILABLE, { reason: 'newerVersion' })` when `from >` the latest version.
- `openLibrary(file: string, opts: { backupsDir: string; clock: () => Date }): LibraryDb`: sets the pragmas, creates `meta` if needed, migrates.
- `type ExistingGame = { id: number; relPath: string; size: number; missing: boolean }`.
- `type FoundGame = { relPath: string; locationId: string; size: number; mtime: number; discGroup: string | null }`.
- `type SystemDiff = { added: FoundGame[]; present: Array<{ id: number; game: FoundGame }>; moved: Array<{ id: number; game: FoundGame }>; restored: number[]; missing: number[] }`. Every id in `restored` is also in `present` or `moved`.
- `class LibraryRepository`:
  - `constructor(db: LibraryDb)`
  - `listSystemGames(systemId): ExistingGame[]`
  - `applySystemDiff(systemId, diff: SystemDiff, now: Date): void`: one transaction. Inserts `games` + `game_metadata` (title via `titleFromRelPath` from Task 3). Updates `location_id`, `size`, `mtime` and `disc_group` for present and moved rows, plus `rel_path` for moved rows. Sets `missing = 0`, `missing_since = null` on restored rows and `missing = 1`, `missing_since = now` on newly missing rows.
  - `systemCounts(): Array<{ systemId: string; games: number; missing: number }>`

- [ ] **Step 1: Write the failing tests:**
  - `'NFR-REL-1: a new library is created at the latest schema version with WAL'`: `meta.schema_version` = latest and `pragma journal_mode` = `wal`.
  - `'NFR-REL-1: migrating an existing library backs it up first'`: build a v1 DB, add a fake `0001` migration to the list, migrate, and expect one backup file with v1 data. A failing migration rolls back, so the version stays 1.
  - `'NFR-REL-1: a library from a newer app version is refused'`: `schema_version = 999` throws `LIBRARY_UNAVAILABLE` with `reason: 'newerVersion'`.
  - `'FR-LIB-1: rel_path is unique per system regardless of case'`: inserting `Game.zip` and then `game.ZIP` for one system violates the constraint; the same rel_path in another system is fine.
  - `'FR-LIB-4: applying a diff marks missing and restores, never deletes'`: an apply with all kinds → counts and row states match, and the row count never drops.
  - `'NFR-REL-1: a failing apply leaves the system unchanged'`: an insert that violates UNIQUE throws, and earlier statements in that apply are rolled back.
- [ ] **Step 2:** Run `npx vitest run apps/launcher/src/main/library`. Expected: FAIL.
- [ ] **Step 3: Write `schema.ts`, run `npm run db:generate -w apps/launcher`, and check the SQL:** NOCASE on `rel_path`, the unique index, and the cascade. Then implement `migrate`, `openLibrary` and `LibraryRepository`.
- [ ] **Step 4:** Run the library tests, then `npm run typecheck` and `npm run lint`. Expected: PASS.
- [ ] **Step 5: Commit:** `feat(launcher): SQLite library with migrations and backups (FR-LIB-1, FR-LIB-4, NFR-REL-1)`.

### Task 3: Walk, multi-disc and diff (pure logic + fs)

**Files:**
- Create in `apps/launcher/src/main/scan/`:
  - `playlists.ts` (+ test): ported `playlistReferences`.
  - `walk.ts` (+ test): `walkSystem`.
  - `discs.ts` (+ test): `groupDiscs`, `normalizeDiscName` and `titleFromRelPath`.
  - `diff.ts` (+ test): `diffSystem`.
  - `types.ts`: `WalkJob`, `WalkResult`.
- Commit note: `ported from NextLevelOS electron/romScan.cjs and scripts/nextlevel-gamelist-cleanup-multidisk.py @ 3d530b7`.

**Interfaces:**
- Consumes: `ExistingGame`, `FoundGame` and `SystemDiff` (Task 2).
- Produces:
  - `type WalkJob = { systemId: string; dirs: Array<{ locationId: string; dir: string }>; extensions: string[] }`: dirs come in priority order.
  - `type WalkResult = { systemId: string; files: FoundGame[]; foldersFound: number }`: `discGroup` is `null` here.
  - `walkSystem(job: WalkJob): Promise<WalkResult>`: async `fs.promises.readdir(..., { withFileTypes: true })`, and `stat` only for accepted files. It merges locations by lowercase rel_path, first location wins, then applies `groupDiscs`. A missing or unreadable folder is skipped.
  - `groupDiscs(files: FoundGame[]): FoundGame[]`.
  - `titleFromRelPath(relPath: string): string`.
  - `diffSystem(existing: ExistingGame[], found: FoundGame[]): SystemDiff`.

- [ ] **Step 1: Write the failing tests** (ported cases first, renamed with IDs):
  - `'FR-LIB-3: keeps accepted extensions at root and one sub-folder deep'`
  - `'FR-LIB-3: skips the media folder'`
  - `'FR-LIB-5: drops bins referenced by a cue'`
  - `'FR-LIB-5: drops discs referenced by an m3u, including nested cue/bin'`
  - `'FR-LIB-5: resolves references into sub-folders, case-insensitively'`
  - `'FR-LIB-5: a leading slash in an m3u entry is relative to the playlist folder'`
  - `'FR-LIB-3: skips missing folders'`
  - `'FR-LIB-1: the first location containing a game wins'`: `Game.zip` in loc A (priority 1) and `GAME.zip` in loc B → one file, from A.
  - `'FR-LIB-5: loose discs become one game'`: `Saga (USA) (Disc 1).chd` and `Saga (USA) (Disc 2).chd` → one game, `Saga (USA) (Disc 1).chd`, with `discGroup: 'Saga (USA)'`.
  - Also: Disc 1 Side B sorts after Disc 1 Side A, and `Tape 2` alone stays a single game with `discGroup: null`.
  - `'FR-LIB-5: an m3u named like a disc group replaces the group'`
  - `'FR-LIB-5: titles drop the extension and disc tag but keep region tags'`: `! Brazil/Saga (USA) (Disc 1).chd` → `Saga (USA)`.
  - `'FR-LIB-3: diff finds new, present and restored games by case-insensitive rel_path'`
  - `'FR-LIB-3: a renamed or moved file keeps its id'`: an existing `Game.zip` (size 10) and a found `Sub/Game.zip` (size 10) → `moved`, nothing added or missing.
  - `'FR-LIB-3: an ambiguous move is not guessed'`: two found files share the basename and size → both added, existing missing.
  - `'FR-LIB-4: an already missing game stays missing without a new missing_since'`: not in `missing` again.
- [ ] **Step 2:** Run `npx vitest run apps/launcher/src/main/scan`. Expected: FAIL.
- [ ] **Step 3: Implement the four modules.** No Electron imports, and only `node:` built-ins plus relative imports, so the worker can load `walk.ts` directly.
- [ ] **Step 4:** Run the scan tests. Expected: PASS.
- [ ] **Step 5: Commit:** `feat(launcher): scan walk, multi-disc grouping and diff (FR-LIB-3, FR-LIB-5)`.

### Task 4: ScanService, worker walker, settings update

**Files:**
- Create in `apps/launcher/src/main/scan/`:
  - `ScanService.ts` (+ `ScanService.test.ts`).
  - `scanWorker.ts`: `parentPort.on('message', job => walkSystem(job).then(post))`.
  - `workerWalker.ts` (+ test).
  - `plan.ts` (+ test): `planScan`.
- Modify: `apps/launcher/src/main/settings/SettingsService.ts` (+ test): `update` and `onChanged`.

**Interfaces:**
- Consumes: `walkSystem` and `WalkJob` (Task 3), `LibraryRepository` and `diffSystem` (Tasks 2–3), `orderedLocations` (shared), the contract types (Task 1).
- Produces:
  - `type Walker = { walk(job: WalkJob): Promise<WalkResult>; stop(): void }`. `stop` rejects a pending walk with `ScanCancelled`.
  - `inProcessWalker(): Walker`, for tests.
  - `createWorkerWalker(workerPath: string | URL): Walker`: lazily starts one `Worker` per scan. `stop` terminates it.
  - `planScan(settings: Settings, catalog: readonly SystemDefinition[], systemIds: string[] | undefined, folderExists: (dir: string) => boolean): WalkJob[]`: implements "Scope of a scan" in Global Constraints. Unknown explicit ids throw `VALIDATION_FAILED`.
  - `SettingsService.update(change: (s: Settings) => Settings): Promise<Result<SettingsSnapshot>>`: runs exclusively, applies to the latest state, validates, and returns `INVALID_SETTINGS` while the file is invalid.
  - New optional `SettingsDeps.onChanged?: (snapshot: SettingsSnapshot) => void`, called after every successful write.
  - `class ScanService`:
    - `constructor(deps: { repo: LibraryRepository; settings: SettingsService; catalog: () => readonly SystemDefinition[]; createWalker: () => Walker; folderExists: (dir: string) => boolean; clock: () => Date; emit: <E extends IpcEvent>(e: E, p: IpcEventPayload<E>) => void; log; newId: () => string })`
    - `start(systemIds?: string[]): ScanStatus`: returns at once; the scan runs in the background.
    - `cancel(): ScanStatus`
    - `status(): ScanStatus`
    - `whenIdle(): Promise<void>`: for tests and quit.
    - Emits `scan.progress` before each system and after each walk, `library.changed` after each applied system that changed, and `scan.finished` at the end.
    - Outcome is `'failed'` if a walk or apply throws. That is logged, and the remaining systems are not run.

- [ ] **Step 1: Write the failing tests** (real temp folders + `tempLibrary()` + `inProcessWalker`):
  - `'FR-LIB-3: a scan adds the games of every enabled system and reports progress'`: events arrive in order and the summary counts match.
  - `'FR-LIB-3: scan all includes untouched systems whose folder exists and enables those with games'`: `enabledSystemIds` lists them, settings now has `{ enabled: true }`, and `settings.changed` was emitted once.
  - `'FR-LIB-3: a system switched off is neither scanned nor re-enabled'` (Review Focus 3).
  - `'FR-LIB-4: a disconnected drive marks games missing; reconnecting restores the same rows'` (Review Focus 1): the location path is renamed away and then back, and ids and titles are unchanged.
  - `'FR-LIB-3: cancel stops the scan; the interrupted system is unchanged'` (Review Focus 5): use a walker whose second walk waits on a deferred. Cancel during it → outcome `cancelled`, system 1 is applied, system 2 has no rows, and `status().running === false`.
  - `'FR-LIB-3: starting while a scan runs returns the running status'`.
  - `'FR-LIB-3: an unknown explicit system id is rejected'`.
  - `'FR-LIB-3: the worker walker returns the same files as walkSystem and stops on terminate'`: uses `createWorkerWalker(new URL('./scanWorker.ts', import.meta.url))`; Node 24 strips the types. If Node can't load the TS worker in Vitest, keep this test on a tiny `.mjs` shim that imports `walk.ts`, and note why.
  - `'FR-SET-1: update applies to the latest settings and notifies onChanged'`.
- [ ] **Step 2:** Run `npx vitest run apps/launcher/src/main/scan apps/launcher/src/main/settings`. Expected: FAIL.
- [ ] **Step 3: Implement.** `ScanService` stays under 200 lines; `planScan` and the summary maths are separate functions.
- [ ] **Step 4:** Run the tests, `npm run typecheck` and `npm run lint`. Expected: PASS.
- [ ] **Step 5: Commit:** `feat(launcher): background ScanService with worker walk and cancel (FR-LIB-3, FR-LIB-4)`.

### Task 5: Wiring: handlers, events to windows, boot

**Files:**
- Modify:
  - `apps/launcher/src/main/handlers.ts` (+ `handlers.test.ts`).
  - `apps/launcher/src/main/index.ts`.
  - `apps/launcher/src/preload/index.ts`.
  - `apps/launcher/src/renderer/bridge.ts` (+ `bridge.test.ts`).
- Create: `apps/launcher/src/main/ipc/events.ts` (+ test): `createEventSink`.

**Interfaces:**
- `createEventSink(targets: () => Array<{ send(channel: string, payload: unknown): void }>, log): EmitEvent`: validates the payload with `ipcEvents[e]`. An invalid payload is logged and not sent.
- `MainDeps` gains `library: { repo: LibraryRepository; scan: ScanService } | null`. `null` means the library failed to open, and then `scan.*` and `systems.list` throw `AppErrorException(LIBRARY_UNAVAILABLE)`.
- `'systems.list'` merges the catalog, `settings.systems[id].enabled` and `repo.systemCounts()`. Systems without games show 0.
- Preload `on(event, listener)`:
  - Only `Object.hasOwn(ipcEvents, event)`; otherwise it's a no-op that returns a no-op unsubscribe.
  - Wraps `ipcRenderer.on(eventChannel(event), (_e, payload) => listener(payload))` and returns `() => ipcRenderer.removeListener(...)`.
- `index.ts`:
  - Opens the library with `openLibrary(join(dataDir,'library.db'), …)` in a try/catch. On failure it logs and passes `library: null`.
  - The worker comes from `import scanWorkerPath from './scan/scanWorker.ts?modulePath'`.
  - `onChanged` emits `settings.changed`.
  - `before-quit` cancels the scan and closes the DB.

- [ ] **Step 1: Write the failing tests:**
  - `'FR-LIB-3: scan channels fail with LIBRARY_UNAVAILABLE when the library could not open'`.
  - `'FR-LIB-3: systems.list merges catalog, enabled flag and game counts'`.
  - `'FR-LIB-3: the event sink drops payloads that break the contract'`.
  - `'FR-LIB-3: the bridge ignores unknown events'`: the fallback `missingBridge.on` returns a function.
- [ ] **Step 2:** Run `npx vitest run apps/launcher/src/main apps/launcher/src/renderer/bridge.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4:** Run `npm test`, `npm run typecheck` and `npm run lint`. Then run `npm run build -w apps/launcher` and confirm that `out/main` contains the worker chunk, and that `better-sqlite3` is required at runtime, not bundled. Expected: all PASS.
- [ ] **Step 5: Commit:** `feat(launcher): wire library, scan IPC and main-to-renderer events (FR-LIB-3)`.

### Task 6: Renderer: event hook, draft rebase, scan panel in Storage

**Files:**
- Create:
  - `apps/launcher/src/renderer/events.ts`: `useIpcEvent`.
  - `apps/launcher/src/renderer/features/settings/form/rebase.ts` (+ test).
  - In `apps/launcher/src/renderer/features/library/`: `scanApi.ts`, `ScanPanel.tsx` (+ `ScanPanel.test.tsx`) and `ScanResults.tsx`.
- Modify:
  - `features/settings/form/useSettingsDraft.ts` and `form/SettingsSection.tsx`: rebase instead of remounting on a new revision.
  - `features/settings/StorageSection.tsx`: renders `<ScanPanel dirty={draft.dirty} hasLocations={…} />` below the list.
  - `features/settings/settingsApi.ts`: `settings.changed` → `setQueryData` when the incoming revision is newer.
  - `test-utils.tsx`: the fake bridge records `on` listeners and exposes `emit(event, payload)` to tests.
  - Both locale files: keys under `settings.storage.scan.*`.
- Docs: `docs/02-design/screen-specifications.md` S9 (Storage scan panel) and `docs/04-quality/test-strategy.md` C4 (where it is pinned).

**Interfaces:**
- `useIpcEvent<E extends IpcEvent>(event: E, listener: (p: IpcEventPayload<E>) => void): void`: subscribes in an effect and unsubscribes on cleanup, with the listener kept in a ref.
- `rebase(base: unknown, draft: unknown, next: unknown): unknown`:
  - All three plain objects → per-key recursion over the union of keys, and a key whose result is `undefined` is omitted.
  - Otherwise `deepEqual(base, draft) ? next : draft`. Arrays are compared whole.
- `useSettingsDraft` keeps `{ base: SettingsSnapshot, draft }`. When `snapshot.revision !== base.revision` it sets `draft = rebase(base.settings, draft, snapshot.settings)` during render, and focus-after-save keeps working without remounting.
- `scanApi.ts`:
  - `useScanStatus()`: query `['scan.status']`, updated from `scan.progress` and `scan.finished` events.
  - `useStartScan()` and `useCancelScan()`.
  - `useSystemSummaries()`: query `['systems.list']`, invalidated on `library.changed` and `scan.finished`.
- `ScanPanel` (S9 Storage):
  - **Scan now** button, disabled with the hint `settings.storage.scan.saveFirst` while the draft is dirty, and `settings.storage.scan.noLocations` without locations.
  - While running: a `role="progressbar"` with `aria-valuenow = systemsDone` and `aria-valuemax = systemsTotal`, the current system name from the catalog, files seen, and **Cancel**.
  - After a scan: the summary line (present / new / moved / restored / missing / systems enabled, with plurals). A cancelled or failed outcome gets its own line.
  - `ScanResults` is a virtualized list of the scanned systems with present > 0 or changes: name, games, missing.
  - On `LIBRARY_UNAVAILABLE`: the message plus **Open data folder** (`app.openPath({ key: 'data' })`).

- [ ] **Step 1: Write the failing tests:**
  - `'FR-SET-2: rebase keeps the user edits and takes the other changes'` (Review Focus 4): base `{systems:{a:{enabled:false}}}`, draft changes `a.folderName`, next enables `b`. The result has both, and a draft equal to base returns next.
  - `'FR-SET-2: a newer snapshot keeps an unsaved Systems edit'`: the component test emits `settings.changed`, the edited field keeps its value, and the save bar is still shown.
  - `'FR-LIB-3: Scan now starts a scan and shows progress with Cancel'`: emit `scan.progress` → progressbar values; clicking Cancel calls `scan.cancel`.
  - `'FR-LIB-3: the finished summary shows counts and enabled systems'`.
  - `'FR-LIB-3: Scan now is disabled with unsaved storage changes'`.
  - `'FR-LIB-3: an unavailable library offers Open data folder'`.
  - Existing Settings tests stay green (focus after save, conflict notice).
- [ ] **Step 2:** Run `npx vitest run apps/launcher/src/renderer`. Expected: FAIL.
- [ ] **Step 3: Implement**, with strings in en and pt-BR (the locales test enforces parity).
- [ ] **Step 4:** Run `npm test`, `npm run typecheck` and `npm run lint`. Expected: PASS.
- [ ] **Step 5: Commit:** `feat(launcher): scan panel in Settings → Storage; drafts rebase on newer settings (FR-LIB-3, FR-SET-2)`.

### Task 7: E2E, docs and changelog

**Files:**
- Create: `apps/launcher/e2e/scan.spec.ts`
- Modify: `CHANGELOG.md` (Unreleased), `docs/01-product/roadmap.md` (M2 stays ◐, with a note that M2b is done), `docs/03-architecture/05-architecture.md` tech table (better-sqlite3 13 N-API: no rebuild for Electron)

- [ ] **Step 1: Write `'FR-LIB-3, FR-LIB-4: scan finds games, then marks them missing when the folder goes away'`:**
  - A temp data dir with settings for one storage location in a temp folder holding `Nintendo 64/Homebrew Demo.z64` (an empty file; no commercial names) and `Sony Playstation/Demo (Disc 1).chd` (catalog folder names: `Nintendo 64`, `Sony Playstation`) + `(Disc 2).chd`.
  - Open Settings → Storage and click Scan now. Expect the summary to show 2 games and 2 systems enabled.
  - Rename the folder away and scan again. Expect 2 missing.
- [ ] **Step 2:** Run `npm run test:e2e`. Expected: PASS (all specs).
- [ ] **Step 3:** Update the docs and changelog.
- [ ] **Step 4: Run the full gate:** `npm run lint`, `npm run typecheck`, `npm test` and `npm run test:e2e`. All must pass; keep the output for the PR.
- [ ] **Step 5: Commit:** `test(launcher): scan e2e; docs: M2b status`.
