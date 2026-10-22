# M3 Launching Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Emulators and launch profiles become data, edited in Settings → Emulators. Presets cover
RetroArch, MAME and the common standalone emulators. Each profile has a live preview and a Test
launch. A game runs from the Game Library with **Play**: the front-end gets out of the way and
comes back on the same game, and every launch is recorded in a launch log.

**Architecture:**
- `packages/shared` gets the template language (`launch/template.ts`: parse, validate, render to
  an argv array) and the emulator, profile, override and launch-log schemas. Settings gain
  `emulators`, `profiles` and `systems[id].defaultProfileId`.
- `packages/system-catalog` gets `data/presets.json` and fills `presetProfiles` per system. Both
  come from the seed script: RetroArch cores from `launchers.json`, MAME machine args and the
  emulator order from `nextlevel-launcher.py`, and a hand-written table for standalone emulators.
- Main gets `launch/`, made of pure functions (resolve profile → locate ROM → token context →
  argv) and a `LaunchService` with injected `spawn`, fs, window and clock. `library.db` gains
  `game_launch_override` and `launch_log` (migration 0003) behind a `LaunchRepository`.
- Renderer: Settings → Emulators (list, add from preset, profile editor with token autocomplete,
  preview, Test launch), a default profile per system in Settings → Systems, Play and Launch
  options in the Library, and a launch log in Settings → Data & logs.
- **Two PRs:** **M3a** (Tasks 1–10: engine and Settings, demo: Test launch) on
  `feat/m3a-launch-engine`, then **M3b** (Tasks 11–14: Play, per-game options, launch log) on
  `feat/m3b-play`. Release v0.3.0 after M3b.

**Tech Stack:** Existing stack plus `7zip-bin` (ships `7za.exe`, LGPL-2.1) for D3, with ADR-014.

**Spec:**
- FR-EMU-2..8, FR-EMU-10 (FR-EMU-9 hooks stay post-1.0); US-C2, US-D1; NFR-SEC-1 (spawn rules);
  test-strategy C2 (argv snapshot per preset, never a shell) and the `fake-emulator` fixture.
- Architecture §4.3; data model §2 (`Emulator`, `EmulatorProfile`, `SystemSettings.defaultProfileId`),
  §2.1 tokens, §2.3 resolution, §2.4 file location, §3 `EmulatorPreset`, §4 `game_launch_override`,
  `launch_log`; ADR-004; api-spec §3 Launch / Emulators rows; screen spec S9 profile editor; IA
  Settings sections (Emulators, Data & logs → launch log) and "errors link to their fix".
- Reference (read-only): NextLevelOS `electron/main.cjs` `launch-emulator` @ 3d530b7 (what *not*
  to do: string commands and quote parsing) and `public/nextlevel-launcher.py` @ 3d530b7
  (`SYSTEM_EMULATORS`, `MAME_CUSTOM_ARGS`, per-emulator `get_launcher_command`).

## Owner decisions (2026-10-21: the **bold** option was chosen for D1–D5; D6 included by default)

- **D1 Preset scope:** **RetroArch (one profile per core, systems from `launchers.json`) + MAME
  (one profile per system from `MAME_CUSTOM_ARGS`) + standalone presets (Dolphin, PCSX2,
  DuckStation, PPSSPP, Cemu, Ryujinx, Azahar, xemu, Xenia Canary, DOSBox, ScummVM, Flycast,
  Vita3K)**. Left out and reported by the M5 importer: TeknoParrot (42 systems), `script` (17),
  squashfs/WSL, Hypseus/Laserdisc, Demul, Model 2/3, pinball. Alternative: only the FR-EMU-7 list,
  which leaves about 200 MAME computer systems without a preset.
- **D2 Per-game RetroArch `config`/`shader` and MAME `media`/`commands`:** **no new tokens.** The
  M5 importer turns them into per-game `extraArgs` (`--appendconfig …`, `--set-shader …`,
  `-cass {rom}`). MAME systems whose runner args varied by media get an extra preset profile per
  medium (`mame:sega-sc3000:cass`). Alternative: add `{media}`/`{commands}`/`{shader}` tokens.
- **D3 Archives (FR-EMU-8):** **(a) bundle 7-Zip (`7zip-bin`, zip + 7z), ADR-014**; (b) zip only
  in pure JS (`yauzl`), 7z passed as-is; (c) defer FR-EMU-8 (priority S).
- **D4 While a game runs:** **minimize the launcher window (it stays on the taskbar), restore and
  focus it when the emulator exits. One game at a time; Play is disabled while one runs.**
  Alternative: hide the window completely.
- **D5 Failure vs. play:** **an exit code ≠ 0 within 10 s counts as a failure: show the error
  dialog with stderr, don't count the play. Any other exit counts as a play (`play_count + 1`,
  `last_played_at`, `play_seconds += duration`); non-zero exit codes after 10 s are only logged.**
  Test launches never count as plays.
- **D6 Emulator detection:** **include in M3: "Find emulators in a folder…" searches a chosen
  folder two levels deep for preset executable names**, and picking an executable suggests the
  matching preset. Alternative: wait for the M9 first-run wizard.

## Global Constraints

- **Branches:** `feat/m3a-launch-engine` (Tasks 1–10), then `feat/m3b-play` (Tasks 11–14).
- **Spawn:** `spawn(executable, args, { cwd, env, shell: false, windowsHide: false, stdio:
  ['ignore', 'ignore', 'pipe'] })`. Never build a command string; the displayed command line
  (`formatCommandLine`) is for display only and is never executed.
- **Tokens (exact set, data model §2.1):** `rom romDir romName romFile romExt systemId systemDir
  emulatorDir core extraArgs`; `{{` and `}}` are literal braces. Allowed in `args`, `cwd` and
  `env` values. `{extraArgs}` must be a whole `args` element (it expands to zero or more
  elements); anywhere else it is an error. Validation issue messages: `unknownToken`,
  `unclosedBrace`, `extraArgsAlone`.
- **Resolution (§2.3):** override `profileId` → `systems[id].defaultProfileId` → first profile in
  list order whose `systems` includes the system → `NO_PROFILE`. `core` = override core ?? profile
  core ?? `''`. A `{core}` that renders empty is a pre-flight error (`CORE_MISSING`).
- **ROM location (§2.4):** the game's own location first, then the others by priority:
  `<location.path>/<folderName>/<rel_path>`; the first that exists wins. None → `ROM_MISSING`
  with the expected path. Paths are joined with `node:path` `win32.join`.
- **Defaults:** profile `cwd` = `{emulatorDir}`; `archives` = `pass`; env is `process.env`
  without `ELECTRON_RUN_AS_NODE` and `NODE_OPTIONS`, plus the rendered profile env.
- **New error codes:** `NO_PROFILE`, `EMULATOR_MISSING`, `ROM_MISSING`, `CORE_MISSING`,
  `LAUNCH_FAILED`, `ALREADY_RUNNING`; `details` carries `{ fix?: { section: 'emulators' |
  'systems' | 'storage', id?: string }, path?: string, stderrTail?: string, exitCode?: number }`.
- **Launch log:** keep the newest 1,000 rows (pruned in the insert transaction); `stderr_tail` =
  last 4 KiB of stderr, decoded as UTF-8.
- **Limits:** profile name 1–80, emulator name 1–60, ≤ 64 args of ≤ 1,000 characters each,
  ≤ 50 extra args, executable absolute and ending in `.exe`/`.bat`/`.cmd`. `.bat`/`.cmd` are
  refused at launch (`LAUNCH_FAILED`, `shell: false` can't run them) until hooks exist.
- **Ids:** emulators and profiles UUIDv7 (`uuid` v7, as storage locations).
- **Files:** components ≤ 200 lines, files ≤ 400. Main tests never import renderer files.
- **i18n:** every string in `en.json` and `pt-BR.json`; the locale-sync test stays green.
- **Tests** carry requirement/story IDs; main tests use `tempLibrary()` and an injected spawn;
  the real-process tests use `test/fixtures/fake-emulator.mjs` run with `process.execPath`.

## Review Focus

- **Paths with spaces, parentheses, `&`, `%`, quotes or non-ASCII** (`Pokémon (USA) [!].zip`) reach
  the emulator as one argv element, unchanged → Task 6 integration test with the fake emulator.
- **Settings that point at things that are gone:** a deleted profile still named as a system
  default or per-game override, an emulator whose exe was moved → resolution falls through or
  fails with a fix link, never crashes → Tasks 2 (schema) and 5 (resolve).
- **Emulator never starts** (ENOENT, access denied, not a Win32 app): the `spawn` `error` event,
  not `exit` → `LAUNCH_FAILED`, window restored, temp extraction cleaned → Task 6.
- **Launcher quits or the renderer reloads while a game runs:** extraction folder cleaned at next
  start, log row left with `ended_at` null and shown as "unknown" → Tasks 4, 6.
- **Second Play while one runs** (double-click, Enter repeat) → `ALREADY_RUNNING`, one spawn → Task 6.

---

## M3a — launch engine and Settings (`feat/m3a-launch-engine`)

### Task 1: Template language (FR-EMU-3)

**Files:** Create `packages/shared/src/launch/template.ts` (+ `.test.ts`); export from
`packages/shared/src/index.ts`.

**Interfaces — Produces:**
- `TEMPLATE_TOKENS` (readonly tuple, exact set above); `type TemplateToken`.
- `type TemplateIssue = { message: 'unknownToken' | 'unclosedBrace' | 'extraArgsAlone'; token?: string; index: number }`
- `templateIssues(template: string, where: 'arg' | 'value'): TemplateIssue[]` (`'value'` = cwd/env:
  `{extraArgs}` is not allowed there at all).
- `type TokenContext = Record<Exclude<TemplateToken, 'extraArgs'>, string> & { extraArgs: readonly string[] }`
- `renderValue(template: string, ctx: TokenContext): string`
- `renderArgs(args: readonly string[], ctx: TokenContext): string[]`
- `formatCommandLine(executable: string, args: readonly string[]): string` — display only: quotes
  elements containing whitespace or `"` with Windows `CommandLineToArgvW` escaping.

- [ ] **Step 1: Failing tests** `FR-EMU-3 …`: unknown `{romm}` → `[{ message: 'unknownToken', token: 'romm', index: 0 }]`
  (US-D1); `{{rom}}` renders `{rom}`; `'{rom'` → `unclosedBrace`; `'-x{extraArgs}'` → `extraArgsAlone`;
  `renderArgs(['-L', '{emulatorDir}/cores/{core}.dll', '{extraArgs}', '{rom}'], ctx)` with
  `extraArgs: ['--a', 'b c']` → `['-L', 'E:\\emu\\ra/cores/x.dll', '--a', 'b c', 'E:\\r\\A (USA).zip']`;
  empty `extraArgs` drops the element; a value with spaces stays one element; `formatCommandLine`
  quotes `b c` and escapes `a"b` as `"a\"b"`.
- [ ] **Step 2:** run `npx vitest run packages/shared/src/launch` → FAIL (module missing).
- [ ] **Step 3:** implement as a single left-to-right scanner shared by `templateIssues` and render.
- [ ] **Step 4:** tests PASS. **Step 5:** commit `feat(shared): launch template tokens (FR-EMU-3)`.

### Task 2: Emulator and profile settings (FR-EMU-2, FR-EMU-4)

**Files:** Create `packages/shared/src/settings/emulators.ts` (+ test); modify
`settings/schema.ts` (add sections), `errors.ts` (codes above), `i18n/*.json` (`errors.*`,
`errors.validation.unknownToken|unclosedBrace|extraArgsAlone|unknownEmulator|unknownProfile|notExecutable`),
`apps/launcher/src/renderer/features/settings/form/fields.ts` (`CUSTOM_ISSUES` gains those keys).

**Interfaces — Produces:**
- `EmulatorSchema` `{ id: uuid, name, presetId?: string, executable: string, version?: string }`
- `EmulatorProfileSchema` `{ id: uuid, name, emulatorId: uuid, systems: string[] (SYSTEM_ID, min 1),
  args: string[], cwd?: string, core?: string, archives: 'pass'|'extract' (default 'pass'),
  env: Record<string,string> (default {}), presetProfileId?: string }`
- `SettingsSchema` gains `emulators: Emulator[]` (default `[]`), `profiles: EmulatorProfile[]`
  (default `[]`); `SystemSettingsSchema` gains `defaultProfileId?: uuid`.
- Cross-field `superRefine` on `SettingsSchema`: each profile's `emulatorId` exists
  (`unknownEmulator` at `profiles.i.emulatorId`); template issues at `profiles.i.args.j`,
  `profiles.i.cwd`, `profiles.i.env.KEY`; `executable` absolute and `.exe/.bat/.cmd`
  (`notExecutable`). A `defaultProfileId` that no longer exists is **not** an error (resolution
  falls through): the Settings UI removes it when the profile is deleted.

- [ ] **Step 1: Failing tests** `FR-EMU-2/3/4`: `{ schemaVersion: 1 }` still parses with
  `emulators: []`, `profiles: []`; `{romm}` in `args[1]` → issue path `['profiles', 0, 'args', 1]`
  message `unknownToken`; missing emulator → `unknownEmulator`; `C:\\x\\retroarch` (no extension) →
  `notExecutable`; dangling `defaultProfileId` parses.
- [ ] **Step 2:** FAIL. **Step 3:** implement. **Step 4:** PASS, plus `npm test -w packages/shared`
  and the settings round-trip tests in the launcher. **Step 5:** commit
  `feat(shared): emulator and profile settings (FR-EMU-2, FR-EMU-4)`.

### Task 3: Emulator presets in the catalog (FR-EMU-7, test-strategy C2)

**Files:** Modify `packages/shared/src/catalog/schema.ts` (`EmulatorPresetSchema`,
`PresetCatalogSchema`); create `packages/system-catalog/scripts/presets.ts` (hand-written standalone
table + MAME method-entry defaults), `scripts/runner.ts` (parses `SYSTEM_EMULATORS` and
`MAME_CUSTOM_ARGS` from the runner source with regexes; dev-only), `data/presets.json`,
`src/presets.test.ts`; modify `scripts/seed.ts` (new `--runner` and `--gamelists` args),
`scripts/mapping.ts`, `src/index.ts`, `README.md`, `NOTICE.md` if sources change.

**Interfaces — Produces:**
- `EmulatorPresetSchema` per data model §3, profiles `{ id, name, systems, args, cwd?, core?, archives }`.
- `emulatorPresets(): readonly EmulatorPreset[]`, `getPreset(id)`, `presetForExecutable(fileName): EmulatorPreset | undefined`
  (case-insensitive match on `executableNames`).
- Preset profile ids: `retroarch:<core>`, `mame:<system-id>[:<medium>]`, `<preset>:default`.
- `systems.json` `presetProfiles` = runner `SYSTEM_EMULATORS[system]` order mapped to preset
  profile ids (unmapped emulators skipped).

Mapping rules (seed):
- RetroArch: `args ['-L', '{emulatorDir}/cores/{core}.dll', '{extraArgs}', '{rom}']`, `core` from
  `launchers.json` `-c "<core>"`. Systems whose command uses `%core%` get the most common
  per-game `core` in their NextLevelOS gamelist (`--gamelists`); none → no RetroArch profile.
- MAME: list entries map `%ROM_PATH%`→`{rom}`, `%SYSTEM_PATH%`→`{systemDir}`, `%CORE%`→`{core}`;
  a `-autoboot_command %COMMANDS%` pair and `-%MEDIA%` use the method's default medium; then
  `['-rompath', '{systemDir}', '-skip_gameinfo', '{extraArgs}']`; `cwd` `{emulatorDir}`. Arcade
  systems with no entry: `['{romName}', '-rompath', '{romDir}', '-skip_gameinfo', '{extraArgs}']`.
- Standalone (hand-written, args taken from the runner where it has them, otherwise from each
  emulator's documented CLI; the implementer checks the official docs and links them in a comment):
  Dolphin `['-b', '-e', '{rom}']`, PCSX2 `['-fullscreen', '--', '{rom}']`, DuckStation
  `['-fullscreen', '-batch', '--', '{rom}']`, PPSSPP `['--fullscreen', '{rom}']`, Cemu
  `['-f', '-g', '{rom}']`, Ryujinx `['{rom}']`, Azahar, xemu, Xenia Canary, DOSBox, ScummVM,
  Flycast, Vita3K per runner/docs.

- [ ] **Step 1: Failing tests** `FR-EMU-7 C2`: `presets.json` parses; every preset profile's
  templates have no `templateIssues`; every `presetProfiles` id exists; **snapshot test**: for
  each preset profile, `renderArgs` against a fixed context `{ rom: 'E:\\roms\\Sys\\Game (USA).zip', … }`
  → `toMatchSnapshot()`; `presetForExecutable('RetroArch.EXE')?.id === 'retroarch'`; seed mapping
  unit tests on fixture snippets (`scripts/fixtures/runner.py` with 3 MAME entries incl. one
  method entry, 2 SYSTEM_EMULATORS rows).
- [ ] **Step 2:** FAIL. **Step 3:** implement the mapping and run the seed against NextLevelOS
  @ 3d530b7 (read-only); commit the generated data. **Step 4:** PASS; review the snapshot by hand
  against the runner for RetroArch, MAME `apple-ii`, Dolphin, PCSX2. **Step 5:** commit
  `feat(catalog): emulator presets (FR-EMU-7) ported from NextLevelOS public/nextlevel-launcher.py @ 3d530b7`.

### Task 4: Launch tables and repository (FR-EMU-4, FR-EMU-10)

**Files:** Modify `apps/launcher/src/main/library/schema.ts`; generate migration `0003_*`; create
`library/LaunchRepository.ts` (+ test); extend `library/testing.ts`; modify
`packages/shared/src/launch/schema.ts` (new) for `LaunchOverrideSchema`, `LaunchLogEntrySchema`,
`LaunchLogPageSchema`.

**Interfaces — Produces:**
- Tables per data model §4: `game_launch_override (game_id PK FK cascade, profile_id text null,
  core text null, extra_args text json not null default '[]')`; `launch_log (id int PK, game_id
  int FK on delete set null, game_title text, profile_id text, profile_name text, argv text json,
  cwd text, test int bool, started_at text, ended_at text null, exit_code int null, error_code
  text null, stderr_tail text null)`, index `launch_log_started` on `started_at`. (`game_title`,
  `profile_name` are copies, so the log reads well after renames/deletes; add both to the data model.)
- `LaunchRepository`: `getOverride(gameId): LaunchOverride` (defaults when no row), `setOverride(gameId, o)`
  (deletes the row when all empty), `start(entry): number` (prunes to 1,000 in the same
  transaction), `finish(id, { endedAt, exitCode, errorCode, stderrTail })`,
  `page(offset, limit): LaunchLogPage`, `recordPlay(gameId, seconds, at: Date)` (upserts
  `game_user_state`), `unfinished(): number[]`.

- [ ] **Step 1: Failing tests** `FR-EMU-4/10`: override round trip and empty → no row; 1,001
  starts keep the newest 1,000; `recordPlay` twice → `play_count` 2, `play_seconds` summed; game
  delete keeps log rows with `game_id` null; migration test (`schema.test.ts`) lists the new tables.
- [ ] **Step 2:** FAIL. **Step 3:** schema + `npm run db:generate -w apps/launcher`, delete
  `node_modules/.vitest-cache`, implement. **Step 4:** PASS. **Step 5:** commit
  `feat(launcher): launch override and launch log tables (FR-EMU-4, FR-EMU-10)`.

### Task 5: Resolve and build the command (FR-EMU-3, FR-EMU-4, §2.3/§2.4)

**Files:** Create `apps/launcher/src/main/launch/resolve.ts`, `romLocation.ts`, `buildCommand.ts`
(+ tests).

**Interfaces — Produces:**
- `resolveProfile(settings, systemId, override): { profile: EmulatorProfile; emulator: Emulator }`
  — throws `AppErrorException` `NO_PROFILE` (`fix: { section: 'systems', id: systemId }`) or
  `EMULATOR_MISSING` (`fix: { section: 'emulators', id: emulatorId }`). A dangling override or
  default falls through to the next rule.
- `locateRom({ settings, system, game: { relPath, locationId } }, exists: (p) => boolean): { path; systemDir }`
  — throws `ROM_MISSING` with `details.path` = the expected path.
- `buildCommand({ emulator, profile, romPath, systemDir, systemId, core, extraArgs, baseEnv }):
  { executable; args; cwd; env }` — `CORE_MISSING` when `{core}` is used and empty.
- `sampleRomPath(system, settings): string` for previews without a game:
  `<first location or C:\\Games>\\<folderName>\\Example Game (USA).<first extension>`.

- [ ] **Step 1: Failing tests** with `FR-EMU-4`/`§2.3` names covering every resolution rule
  (override → default → first profile → `NO_PROFILE`; dangling ids fall through); ROM on the
  second location found when the first lacks it; `ROM_MISSING` path; argv for a RetroArch profile
  and a path with `&`, `%`, `'`, `é` unchanged; `ELECTRON_RUN_AS_NODE` stripped from env.
- [ ] **Step 2–4:** FAIL → implement → PASS. **Step 5:** commit
  `feat(launcher): resolve launch profile and build argv (FR-EMU-3, FR-EMU-4)`.

### Task 6: LaunchService and archives (FR-EMU-5, FR-EMU-6, FR-EMU-8, FR-EMU-10)

**Files:** Create `launch/LaunchService.ts`, `launch/archives.ts`, `launch/spawnProcess.ts`
(wraps `child_process.spawn`, resolves on `spawn`, rejects on `error`), tests, and
`apps/launcher/test/fixtures/fake-emulator.mjs` (writes `{ argv, cwd, env.NEXTLEVEL_FAKE }` as
JSON to the path in `--out`, writes `--stderr` text to stderr, waits `--ms`, exits with `--exit`).

**Interfaces:**
- Consumes Tasks 2, 4, 5; `GameRepository.get`/row lookup for `systemId`, `relPath`, `locationId`,
  title.
- Produces `LaunchService` with deps `{ settings, catalog, games, launches: LaunchRepository,
  spawn: SpawnFn, exists, clock, emit, window: { minimize(): void; restore(): void }, extractor:
  Extractor, tempDir, log }`:
  - `preview({ emulator, profile, gameId? }): LaunchPreview` (`{ executable, args, cwd, commandLine }`, no checks)
  - `test({ emulator, profile, gameId }): Promise<TestLaunchResult>` (`{ commandLine, executable,
    args, cwd, exitCode: number | null, stderrTail, durationMs, error?: AppError }`; logged with `test`;
    no minimize, no play stats)
  - `play(gameId): Promise<{ launchId: number }>` — resolves once the process spawned; exit is
    reported by the `launch.finished` event.
  - `running(): { gameId; launchId } | null`; `cleanupStaleExtractions(): Promise<void>` (start-up).
- `Extractor = { extract(archive: string, dest: string): Promise<void> }` (D3: `7za x -y -o<dest>`
  via `spawn`, `shell: false`). `prepareRom(romPath, profile, systemExtensions, launchId)`:
  `pass` or not `.zip`/`.7z` → as-is; else extract to `<tempDir>/nextlevel-launch/<launchId>` and
  pick `.m3u` > `.cue` > `.gdi` > the largest file whose extension is a system extension
  other than zip/7z; `cleanup()` removes the folder after exit or failure.
- Events: `launch.started { launchId, gameId }`, `launch.finished { launchId, gameId, exitCode:
  number | null, durationMs, counted: boolean, error?: AppError }`.

- [ ] **Step 1: Failing tests** (fake `spawn`, fake clock) `FR-EMU-6/10, US-C2`: play minimizes
  then restores on exit; `ALREADY_RUNNING` on a second play; D5: exit 1 after 3 s → `finished`
  with `error.code` `LAUNCH_FAILED`, `stderrTail`, `counted: false`, no `recordPlay`; exit 0 after
  60 s → `counted: true`, `play_seconds` 60; spawn `error` ENOENT → `LAUNCH_FAILED`, window
  restored, log finished, extraction cleaned; `.bat` refused; `EMULATOR_MISSING` when the exe
  doesn't exist; archives: `extract` picks the `.cue`, cleans up after exit; `pass` passes the zip.
  **Integration** (`LaunchService.integration.test.ts`, real spawn of `process.execPath` +
  `fake-emulator.mjs`): `Pokémon & Friends (USA) [!] 100%.zip` arrives as one argv element; cwd =
  emulator dir; exit code 3 and stderr tail come back from `test()`.
- [ ] **Step 2–4:** FAIL → implement → PASS. **Step 5:** commit
  `feat(launcher): launch service with test launch and archive handling (FR-EMU-5, FR-EMU-6, FR-EMU-8)`.
  If D3 = (a): add `7zip-bin`, ADR-014, `asarUnpack` for the binary in the builder config, all in this commit.

### Task 7: IPC, handlers and wiring

**Files:** Modify `packages/shared/src/ipc/contract.ts`, `ipc/events.ts`, `library/games.ts`
(`GameDetails.launchOverride`); create `apps/launcher/src/main/launchHandlers.ts` (+ test); modify
`handlers.ts`, `index.ts` (construct `LaunchService`, `window.minimize/restore+focus` on the main
`BrowserWindow`, `cleanupStaleExtractions()` and log rows without `ended_at` left as-is at start),
`api-spec.md` §3.

**Interfaces — Produces channels:** `launch.game { gameId }` → `{ launchId }`; `launch.test
{ emulator, profile, gameId }` → `TestLaunchResult`; `launch.preview { emulator, profile, gameId? }`
→ `LaunchPreview`; `launch.log { offset, limit ≤ 200 }` → `LaunchLogPage`; `launch.running` →
`{ gameId, launchId } | null`; `library.games.setLaunchOverride { gameId, override }` → `GameDetails`;
`emulators.presets` → `EmulatorPreset[]`; `emulators.detect { folder }` → `{ presetId, executable }[]`
(two levels deep, D6); `app.pickFile { title?, kind: 'executable' }` → `string | null` (filters
`exe`, honours `NEXTLEVEL_E2E_PICK_FILE` in development like the folder picker).

- [ ] **Step 1: Failing tests** in `launchHandlers.test.ts`: each channel validates input (extra
  keys rejected), `launch.test` with a draft profile whose template has `{romm}` →
  `VALIDATION_FAILED`, `emulators.detect` on a temp tree finds `retroarch.exe` at depth 2 and not at 3.
- [ ] **Step 2–4:** FAIL → implement → PASS. **Step 5:** commit
  `feat(launcher): launch and emulator IPC channels (FR-EMU-5)`.

### Task 8: Settings → Emulators: list and add (FR-EMU-2, FR-EMU-7, US-D1)

**Files:** Create `apps/launcher/src/renderer/features/settings/emulators/EmulatorsSection.tsx`,
`EmulatorList.tsx`, `AddEmulatorDialog.tsx`, `fromPreset.ts` (+ tests); register in
`SettingsApp.tsx` after Systems (icon `Joystick`); i18n.

**Interfaces — Produces:** `profilesFromPreset(preset, emulatorId, enabledSystemIds, newId): EmulatorProfile[]`
— one profile per preset profile that covers at least one enabled system (all preset systems kept
on the profile); `remainingPresetProfiles(preset, settings)` for **Add from preset…**.
Deleting an emulator deletes its profiles and clears `defaultProfileId`s and leaves overrides to
fall through (confirm dialog names the counts).

- [ ] **Step 1: Failing tests** `US-D1`: Add emulator → choose Dolphin → pick exe (fake bridge
  returns `C:\\Emu\\Dolphin.exe`) → draft has the emulator and a profile with
  `['-b', '-e', '{rom}']` and Save enabled; picking `retroarch.exe` under Custom suggests the
  RetroArch preset; Find emulators in a folder lists detected presets with checkboxes; delete
  clears the system default.
- [ ] **Step 2–4:** FAIL → implement → PASS. **Step 5:** commit
  `feat(launcher): Settings emulators section with presets (FR-EMU-2, FR-EMU-7)`.

### Task 9: Profile editor, preview and Test launch (FR-EMU-3, FR-EMU-5, US-D1)

**Files:** Create `emulators/ProfileEditor.tsx`, `ArgsEditor.tsx` (one row per argv element,
add/remove/reorder, token autocomplete when `{` is typed, inline issue from `templateIssues`:
"Unknown token {romm}"), `SystemPicker.tsx` (searchable checkbox list, virtualized), `EnvEditor.tsx`,
`CommandPreview.tsx` (debounced `launch.preview` on the draft, with a game picker using
`library.search`), `TestLaunchPanel.tsx` (+ tests); modify `systems/SystemEditor.tsx` (default
profile select: "Automatic (first matching profile)" + profiles covering the system).

- [ ] **Step 1: Failing tests** `US-D1`: typing `{romm}` shows "Unknown token {romm}" and the Save
  bar's Save is disabled; autocomplete inserts `{romDir}`; preview shows the command line returned
  by the bridge; Test launch shows command, exit code and stderr, and an error result shows its
  message; SystemEditor lists only covering profiles and saves `defaultProfileId`.
- [ ] **Step 2–4:** FAIL → implement → PASS. **Step 5:** commit
  `feat(launcher): profile editor with preview and test launch (FR-EMU-3, FR-EMU-5)`.

### Task 10: M3a end-to-end, docs, PR

**Files:** Create `apps/launcher/e2e/emulators.spec.ts`; modify `e2e/launch.ts` helpers (fake
emulator exe for e2e = `process.execPath` with the fixture as the first arg, set through Custom
emulator + profile args `['<fixture>', '--out', '<tmp>/argv.json', '{rom}']`); docs: data model §2
"Implemented so far", §4 tables, api-spec, screen spec S9, test-strategy C2 status,
`CHANGELOG.md` Unreleased, roadmap M3 ◐.

- [ ] **Step 1:** e2e `US-D1 FR-EMU-5`: scan a temp library with one game → Settings → Emulators →
  add Custom emulator + profile → Save → Test launch with that game → command line shown, exit
  code 0, `argv.json` has the ROM path as one element.
- [ ] **Step 2:** `npm run lint && npm run typecheck && npm test && npm run test:e2e` all green
  (show output). **Step 3:** fresh Opus review of the branch; fix Critical/Important with failing
  tests first. **Step 4:** PR "feat: M3a launch engine and emulator settings (FR-EMU-2..5, FR-EMU-7,
  FR-EMU-8)", CI green, ask the owner before squash-merge.

---

## M3b — Play, per-game options, launch log (`feat/m3b-play`)

### Task 11: Play from the Library (FR-EMU-6, US-C2)

**Files:** Create `features/library/usePlay.ts` (mutation + `launch.started/finished`
subscription + `launch.running` on mount), `PlayingOverlay.tsx` ("Playing <title>…", shown over
the Library while running), `LaunchErrorDialog.tsx` (message, reason and path through
`features/launch/LaunchErrorDetails.tsx` from M3a, stderr tail in a `<pre>`, **Fix in Settings**); modify `GameDetails.tsx` (Play button, disabled while running or when the game is
missing), `GameRow.tsx`/`GameList.tsx` (Enter and double-click play), `GameContextMenu.tsx`
(Play), `features/shell/useOpenApp.ts` + `SettingsApp.tsx` (open with `{ section, focusId? }`;
a second open of the single-instance window switches section).

- [ ] **Step 1: Failing tests** `US-C2`: Play calls `launch.game`; on `launch.finished` with
  `counted` the details refetch (play count shown) and the same row stays selected and focused;
  an `ALREADY_RUNNING`/`NO_PROFILE` error opens the dialog and **Fix in Settings** opens Settings
  on Systems for that system; Enter on a row plays it; Play disabled for missing games.
- [ ] **Step 2–4:** FAIL → implement → PASS. **Step 5:** commit
  `feat(launcher): play games from the library (FR-EMU-6, US-C2)`.

### Task 12: Launch options per game (FR-EMU-4)

**Files:** Create `features/library/LaunchOptionsDialog.tsx` (+ test): profile select ("System
default (<name>)" + profiles covering the system), core text field, extra arguments (one per line),
"Reset to system default"; context menu and details entry **Launch options…**.

- [ ] **Step 1: Failing test** `FR-EMU-4`: saving profile + core + two extra args calls
  `library.games.setLaunchOverride` with `extraArgs: ['--a', 'b c']`; reset sends empty values.
- [ ] **Step 1b (M3a review, minor 6):** the standalone presets have no `{extraArgs}`, so a game's
  extra arguments are silently dropped with them. Add `{extraArgs}` to every standalone preset
  (before `{rom}`, snapshot test updated), and have the dialog say so when the chosen profile's
  arguments don't use `{extraArgs}`.
- [ ] **Step 2–4:** FAIL → implement → PASS. **Step 5:** commit
  `feat(launcher): per-game launch options (FR-EMU-4)`.

### Task 13: Launch log in Data & logs (FR-EMU-10)

**Files:** Create `features/settings/LaunchLog.tsx` (+ test): virtualized table (time, game,
profile, duration, exit code / error, "test" badge, "unknown" when `ended_at` is null), a row
expands to the command line and stderr tail; paged `launch.log` with infinite scroll; refetch on
`launch.finished`. Modify `DataSection.tsx`.

- [ ] **Step 1: Failing test** `FR-EMU-10`: rows render from the fake bridge, expanding shows the
  command line, a new `launch.finished` event refetches.
- [ ] **Step 2–4:** FAIL → implement → PASS. **Step 5:** commit
  `feat(launcher): launch log viewer (FR-EMU-10)`.

### Task 14: M3b end-to-end, docs, PR, release

- [ ] **Step 1:** e2e `US-C2 FR-EMU-6/10`: with the fake emulator (`--ms 1500`), Play from the
  Library → window minimized while running (`BrowserWindow.isMinimized()` via `electronApp.evaluate`)
  → restored, same row selected, play count 1 in details, launch log shows the run; a profile with
  `--exit 2 --ms 0` shows the error dialog and Fix in Settings opens Emulators/Systems.
- [ ] **Step 2:** docs (PRD FR-EMU status notes, data model, api-spec, screen specs S7/S9, IA,
  CHANGELOG, roadmap M3 ☑ with M3a/M3b); lint/typecheck/test/e2e green with output.
- [ ] **Step 3:** fresh Opus review, fixes failing-first, PR "feat: M3b play, per-game launch
  options and launch log (FR-EMU-4, FR-EMU-6, FR-EMU-10)", CI green, ask the owner before merge.
- [ ] **Step 4:** after merge: release PR moving Unreleased → `[0.3.0]`, tag `v0.3.0`, GitHub release.
