# Laserdisc and VHS (Hypseus, squashfs mounting, scripts) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Every game in the owner's "Laserdisc and VHS" menu group launches from the rebuild, with `.wsquashfs` images mounted (never extracted) and everything editable in Settings → Emulators.

**Architecture:** Three new profile capabilities, all data (ADR-004): `squashfs: 'mount'` mounts the image with the WinFsp tool before the command is built (next to archive extraction, same `cleanup()` contract); `entries` (ordered "first existing file wins" rules rendered at `{entryArgs}`) and `argsFile` (a `.commands` file appended to the args) find the game's files by name inside the image or folder. Presets for Hypseus Singe (default + Daphne variant) and a Script preset (`cmd.exe /d /s /c "<rom>"`) come from the catalog seed; catalog system tweaks give the systems the right extensions and scan rules so the games show up and the menu group appears.

**Tech Stack:** TypeScript (Node 24 type stripping), Zod 4, Electron main process, React (Settings), Vitest, Playwright e2e.

**Spec:** `docs/superpowers/specs/2026-11-01-laserdisc-hypseus-design.md` (approved 2026-11-01). Read it first.

## Global Constraints

- **Never change, move or delete anything under `E:\NextLevel\systems`** (owner rule). Code, tests and manual checks only read there.
- The launcher writes nothing outside its own folder (D50 portable rule): overlays go to `<data>\squashfs-overlay\…`, the mount record to `<data>\mounts.json`.
- No WSL. The only mount method is `mountsquashfs.exe -drive <X:> -overlay <dir> <image>` (runs until killed; killing it unmounts).
- The mount tool is not bundled: found at `<root>\tools\mountsquashfs.exe`, or `<emulator folder>\..\..\tools\mountsquashfs.exe`, or Settings `tools.squashfsMount`.
- argv arrays only, no shell (ADR-004). The single exception is the Script preset running `cmd.exe` itself, with `windowsVerbatimArguments` only for that executable.
- No per-game values: the 106 Singe images launch with no gamelist edits.
- No hard-coded drive letters except the drive preference list for mounts.
- FR ids in test names (`FR-EMU-9: …`); i18n keys in `en.json` and `pt-BR.json`; docs tables are not Prettier-formatted (never run Prettier on `docs/*.md`).
- Bash heredocs eat backslashes: write code/JSON with Write/Edit, never `cat <<EOF`.

## Branch and workflow

- **Base:** `tools/launch-compare` (unpushed, in worktree `C:\lestivalet\next-level-claude-launch`). It already has preset `variants` + `env` and the `compare-launch` tool this plan reuses. Work in the main checkout `C:\lestivalet\next-level-claude` (its node_modules build native modules; the worktree's don't): `git switch -c feat/laserdisc-hypseus tools/launch-compare`. When `tools/launch-compare` merges, `git rebase --onto origin/main tools/launch-compare`.
- Ledger: `.superpowers/sdd/2026-11-01-laserdisc-hypseus/progress.md` (rulings, deferred minors, "Final" lines), as in earlier milestones.
- Checks per task: `npx vitest run <touched packages>`; before the PR: `npm run lint`, `npm run typecheck`, `npm test` (launcher with `CI=1`), `npm run test:e2e` (only the new/changed specs locally; CI runs all).

## Review Focus

1. **The emulator fails to start, or exits at once, after the image was mounted** → the drive is unmounted and the mount process is gone (no drive letter left behind). Test in Task 4.
2. **The launcher crashed while a game was mounted, then starts again** → the leftover mount process is killed and its drive freed; a PID in `mounts.json` that now belongs to another program is left alone. Test in Task 3.
3. **Names with spaces, parentheses, `&` or dots** (`FreeFall 3050 A.D.bat`, `Captain America (USA) (MSU1).wsquashfs`, `Tom & Jerry.bat`) → argv is intact; the Script preset runs the right file. Tests in Tasks 2 and 6.
4. **No free drive letter, or the drive never appears** → a clear `mountFailed` error within the timeout, the tool process killed, no hang. Test in Task 3.
5. **Mount tool or WinFsp missing** → launch error with "Fix in Settings" (`mountToolMissing` / `mountFailed` with the tool's output tail), no orphan process, no crash. Tests in Tasks 3 and 4.

---

### Task 1: Shared schema — profile fields, tokens, catalog and settings fields

**Files:**
- Modify: `packages/shared/src/launch/template.ts`, `packages/shared/src/settings/emulators.ts`, `packages/shared/src/settings/fromPreset.ts`, `packages/shared/src/catalog/schema.ts`, `packages/shared/src/settings/schema.ts` (+ `relocatePaths`, wherever it lives)
- Test: co-located `*.test.ts` of each (template, emulators, fromPreset, schema, relocate)

**Interfaces:**
- Produces:
  - `TEMPLATE_TOKENS` adds `'gameDir'`, `'entry'`, `'entryArgs'`.
  - `templateIssues(template, where: 'arg' | 'value' | 'entry')`. New messages: `'entryOnlyInRules'` (`{entry}` outside `where === 'entry'`), `'entryArgsAlone'` (`{entryArgs}` not alone, or not in `'arg'`).
  - `TokenContext = Record<Exclude<TemplateToken, 'extraArgs' | 'entryArgs'>, string> & { extraArgs: readonly string[]; entryArgs: readonly string[] }`; `renderArgs` expands an element that is exactly `{entryArgs}` like `{extraArgs}`.
  - `SQUASHFS_MODES = ['pass', 'mount'] as const`, `type SquashfsMode`.
  - `EntryRuleSchema = z.object({ file: template('value'), args: z.array(template('entry')).min(1).max(8) })`, `type EntryRule`.
  - `EmulatorProfileSchema` adds `squashfs: z.enum(SQUASHFS_MODES).default('pass')`, `entries: z.array(EntryRuleSchema).max(16).default([])`, `argsFile: template('value').optional()`.
  - `PresetProfileSchema` adds optional `squashfs`, `entries`, `argsFile`, `env`; `profileFromPreset` copies them (`squashfs ?? 'pass'`, `entries ?? []`).
  - `EmulatorPresetSchema` adds `windowsTool: z.boolean().optional()` (the executable lives in `%SystemRoot%\System32`).
  - `SystemDefinitionSchema` adds `scan: z.object({ topLevelOnly: z.boolean().optional(), ignore: z.array(z.string()).optional() }).optional()`.
  - `SettingsSchema` adds `tools: z.object({ squashfsMount: OptionalExecutableSchema }).prefault({})` where `OptionalExecutableSchema` = absolute path ending `.exe`, nullable, default `null`. `relocatePaths` rewrites `tools.squashfsMount` like other paths.

- [ ] **Step 1: Write the failing tests**

```ts
it('FR-EMU-3: {entry} is valid only inside entry rule args', () => {
  expect(templateIssues('-script {entry}', 'entry')).toEqual([]);
  expect(templateIssues('{entry}', 'arg')[0]?.message).toBe('entryOnlyInRules');
  expect(templateIssues('{entry}', 'value')[0]?.message).toBe('entryOnlyInRules');
});
it('FR-EMU-3: {entryArgs} stands alone in args', () => {
  expect(templateIssues('{entryArgs}', 'arg')).toEqual([]);
  expect(templateIssues('x{entryArgs}', 'arg')[0]?.message).toBe('entryArgsAlone');
  expect(templateIssues('{entryArgs}', 'value')[0]?.message).toBe('entryArgsAlone');
});
it('FR-EMU-3: renderArgs expands {entryArgs} in place', () => {
  const ctx = { ...baseCtx, gameDir: 'Q:', entry: '', entryArgs: ['-script', 'Q:\\a.singe'] };
  expect(renderArgs(['singe', '{entryArgs}', '-fullscreen'], ctx)).toEqual(['singe', '-script', 'Q:\\a.singe', '-fullscreen']);
});
it('FR-EMU-9: a profile defaults to squashfs pass, no entries, no argsFile', () => {
  const p = EmulatorProfileSchema.parse(minimalProfile);
  expect(p.squashfs).toBe('pass'); expect(p.entries).toEqual([]); expect(p.argsFile).toBeUndefined();
});
it('FR-EMU-9: an entry rule with an unknown token fails on save', () => {
  expect(EmulatorProfileSchema.safeParse({ ...minimalProfile, entries: [{ file: '{gameDir}\\{nope}', args: ['{entry}'] }] }).success).toBe(false);
});
it('FR-EMU-7: profileFromPreset copies squashfs, entries, argsFile', () => { /* preset with all three → same values on the profile */ });
it('FR-EMU-9: tools.squashfsMount defaults to null and is moved with the NextLevel folder', () => {
  /* parse {} → null; relocatePaths(settings with 'E:\\NextLevel\\tools\\mountsquashfs.exe', 'E:\\NextLevel', 'F:\\NextLevel') → 'F:\\NextLevel\\tools\\mountsquashfs.exe' */
});
```

- [ ] **Step 2: Run** `npx vitest run packages/shared` — expect the new tests to FAIL (unknown tokens / missing fields).
- [ ] **Step 3: Implement** the Interfaces above. `CURRENT_SCHEMA_VERSION` stays unless existing settings migration tests demand a bump (new fields all default).
- [ ] **Step 4: Run** `npx vitest run packages/shared packages/system-catalog` — PASS (catalog snapshot unchanged: no data change yet).
- [ ] **Step 5: Commit** `feat(emulators): squashfs mount, entry rules and args file on profiles (FR-EMU-9)`.

---

### Task 2: Game files and the command

**Files:**
- Create: `apps/launcher/src/main/launch/gameFiles.ts`, `gameFiles.test.ts`
- Modify: `apps/launcher/src/main/launch/buildCommand.ts`, `buildCommand.test.ts`

**Interfaces:**
- Consumes: Task 1 tokens and profile fields.
- Produces:
  - `CommandInput` adds `gameDir: string` and `entryArgs: readonly string[]`; `extraArgs` stays the game's override args (fileArgs are prepended by the caller).
  - `tokenContext(input)` sets `gameDir`, `entry: ''`, `entryArgs`.
  - `buildCommand`: a cwd that renders to a bare drive (`/^[A-Za-z]:$/`) becomes `X:\`.
  - `resolveGameFiles(input: { profile: Pick<EmulatorProfile, 'entries' | 'argsFile'>; ctx: TokenContext; exists(path: string): boolean; list(dir: string): Promise<string[]>; readText(path: string): Promise<string> }): Promise<{ entryArgs: string[]; fileArgs: string[] }>`
    - Rules in order; each `file` rendered with `ctx`; a `*` in the **file name** part matches in that folder (case-insensitive, first in alphabetical order); the first existing file wins and its `args` render with `entry` = that path. No rule matches and `entries.length > 0` → `launchError('LAUNCH_FAILED', { reason: 'entryMissing', looked: <rendered file templates> })`.
    - `argsFile` rendered; when it exists, its text (first 4 KB) split on whitespace → `fileArgs`; missing → `[]`.
  - `gameDir` rule (used by Task 4): mounted image → drive root without separator (`Q:`); ROM is a folder (`maddog-hd.hypseus`) → the folder; else the ROM's folder.

- [ ] **Step 1: Write the failing tests** (temp folders as fixtures; names exactly as on the owner's disk)

```ts
it('FR-EMU-9: Singe image — .singe wins over .zip', async () => {
  // gameDir has Agent328OB.singe, Agent328OB.txt, Agent328OB.zip
  expect((await resolve(singeRules, 'Agent328OB')).entryArgs).toEqual(['-script', join(dir, 'Agent328OB.singe')]);
});
it('FR-EMU-9: shared Lua zip — -zlua <the zip> -usealt <game>', async () => {
  // gameDir has cpower1.txt, captainpower.zip
  expect((await resolve(singeRules, 'cpower1')).entryArgs).toEqual(['-zlua', join(dir, 'captainpower.zip'), '-usealt', 'cpower1']);
});
it('FR-EMU-9: no rule matches → entryMissing naming what was looked for', async () => {
  await expect(resolve(singeRules, 'ghost')).rejects.toMatchObject({ error: { details: { reason: 'entryMissing' } } });
});
it('FR-EMU-9: Daphne .commands file becomes leading args; missing file → none', async () => {
  // astron.commands = "-sound_buffer 2048\r\n -nolinear_scale"
  expect((await resolve([], 'astron', '{gameDir}\\{romName}.commands')).fileArgs).toEqual(['-sound_buffer', '2048', '-nolinear_scale']);
});
it('FR-EMU-9: names with spaces, parentheses and & stay one argv element', async () => { /* 'Tom & Jerry (USA).singe' */ });
it('FR-EMU-3: buildCommand renders {gameDir} and {entryArgs}; a bare drive cwd becomes X:\\', () => {
  const cmd = buildCommand({ ...input, gameDir: 'Q:', entryArgs: ['-script', 'Q:\\a.singe'], profile: { ...p, args: ['vldp', '-framefile', '{gameDir}\\{romName}.txt', '{entryArgs}'], cwd: '{gameDir}' } });
  expect(cmd.args).toEqual(['vldp', '-framefile', 'Q:\\a.txt', '-script', 'Q:\\a.singe']);
  expect(cmd.cwd).toBe('Q:\\');
});
```

- [ ] **Step 2: Run** `npx vitest run apps/launcher/src/main/launch` — FAIL.
- [ ] **Step 3: Implement** `resolveGameFiles` and the `buildCommand` changes; update existing callers/tests to pass `gameDir: <romDir>` and `entryArgs: []`.
- [ ] **Step 4: Run** the same — PASS.
- [ ] **Step 5: Commit** `feat(launcher): find a game's files by entry rules and .commands (FR-EMU-9)`.

---

### Task 3: The squashfs mounter

**Files:**
- Create: `apps/launcher/src/main/launch/squashfs.ts`, `squashfs.test.ts`

**Interfaces:**
- Produces:
  - `interface MountedImage { root: string /* 'Q:' */; unmount(): Promise<void> }`
  - `interface Mounter { mount(image: string, overlay: string): Promise<MountedImage> }`
  - `DRIVE_PREFERENCE = ['Z','Y','X','W','V','U','T','S','Q','P','O','N','M']` (skip letters that exist at mount time).
  - `squashoverlayMounter(deps: { tool: string; spawnTool(tool: string, args: string[]): ChildLike; driveExists(letter: string): boolean; record: MountRecord; mountTimeoutMs?: number /* 10_000 */; unmountTimeoutMs?: number /* 5_000 */; pollMs?: number /* 50 */ }): Mounter`
    - argv: `['-drive', 'Q:', '-overlay', overlay, image]`; creates `overlay` (recursive) first; `windowsHide`, stdout+stderr kept as a tail (last 2 KB).
    - Resolves when `Q:\` exists. The child exits first, or timeout → kill it, `launchError('LAUNCH_FAILED', { reason: 'mountFailed', path: image, output: <tail> })`. No free letter → same error with `output: 'noFreeDrive'`.
    - `unmount()`: kill the child, wait until the drive is gone (≤ `unmountTimeoutMs`, else log warn and go on), remove the record entry. Idempotent.
  - `interface MountRecord { add(e: { pid: number; drive: string; image: string }): Promise<void>; remove(pid: number): Promise<void>; list(): Promise<Array<{ pid: number; drive: string; image: string }>> }` and `fileMountRecord(path: string): MountRecord` (JSON at `<data>\mounts.json`, written atomically; unreadable file → treated as empty).
  - `sweepStaleMounts(deps: { record: MountRecord; processName(pid: number): Promise<string | null>; kill(pid: number): void; log }): Promise<void>` — kills a recorded PID only when its image name is `mountsquashfs.exe` (case-insensitive), then clears the record.
  - `findMountTool(o: { configured: string | null; root: string; emulatorExecutable: string; exists(path: string): boolean }): string | null` — order: configured (when it exists), `<root>\tools\mountsquashfs.exe`, `<dirname(emulatorExecutable)>\..\..\tools\mountsquashfs.exe`.

- [ ] **Step 1: Write the failing tests** (fake child + fake drives; no real tool in unit tests)

```ts
it('FR-EMU-9: mounts on the first free preferred letter and passes the overlay', async () => { /* Z taken → Y; argv ['-drive','Y:','-overlay',ov,img]; root 'Y:' */ });
it('FR-EMU-9: the tool exiting before the drive appears → mountFailed with its output', async () => { /* child prints "WinFsp not found", exits 1 */ });
it('FR-EMU-9: drive never appears → mountFailed after the timeout and the tool is killed', async () => {});
it('FR-EMU-9: no free letter → mountFailed noFreeDrive, tool never started', async () => {});
it('FR-EMU-9: unmount kills the tool, waits for the drive to go, clears the record; twice is fine', async () => {});
it('FR-EMU-9: start-up sweep kills only recorded PIDs that are still mountsquashfs.exe', async () => {
  // record [{pid:10},{pid:11}]; processName(10)='mountsquashfs.exe', processName(11)='notepad.exe' → kill called with 10 only; record empty
});
it('FR-EMU-9: the mount tool is found in Settings, then <root>\\tools, then next to the emulators folder', () => {});
```

- [ ] **Step 2: Run** `npx vitest run apps/launcher/src/main/launch/squashfs.test.ts` — FAIL.
- [ ] **Step 3: Implement**. Real `processName`: `tasklist /FI "PID eq <pid>" /FO CSV /NH` via `execFile` (no shell), first CSV field. Real `spawnTool`: `child_process.spawn(tool, args, { shell: false, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] })`.
- [ ] **Step 4: Run** — PASS.
- [ ] **Step 5: Commit** `feat(launcher): mount squashfs images with the WinFsp tool (FR-EMU-9)`.

---

### Task 4: LaunchService — mount, find files, build, always clean up

**Files:**
- Modify: `apps/launcher/src/main/launch/LaunchService.ts`, `LaunchService.test.ts`, `testing.ts`, `apps/launcher/src/main/startLibrary.ts`, `apps/launcher/src/main/launch/spawnProcess.ts` (+ test), `packages/shared/src/i18n/en.json`, `pt-BR.json`, `apps/launcher/src/renderer/features/launch/LaunchErrorDetails.tsx`

**Interfaces:**
- Consumes: Tasks 2–3.
- Produces:
  - `LaunchServiceDeps` adds `mountTool(emulator: Emulator): string | null` (wraps `findMountTool` with settings + root), `mounterFor(tool: string): Mounter`, `overlayRoot: string` (`<data>\squashfs-overlay`), `isDirectory(path): boolean`, `list(dir): Promise<string[]>`, `readText(path): Promise<string>`.
  - `prepare()` order: archives (unchanged) → if `profile.squashfs === 'mount'` and the ROM ends `.wsquashfs`: tool (`null` → `launchError('LAUNCH_FAILED', { reason: 'mountToolMissing', fix: { section: 'emulators', id: profile.id } })`), mount with overlay `<overlayRoot>\<systemId>\<image name without extension>` → `gameDir = root` → `resolveGameFiles`. `PreparedRom` gains `gameDir` and `entryArgs`/`fileArgs`; its `cleanup()` unmounts **then** removes extraction, and runs on every path that already calls it (spawn failure, early exit, normal exit, test launch).
  - `command()` passes `gameDir`, `entryArgs`, and `extraArgs: [...fileArgs, ...override.extraArgs]`.
  - `preview()` does no I/O: mount profiles on a `.wsquashfs` show `gameDir = 'X:'`; `entryArgs` = the first rule's args with `entry` = its rendered file; no fileArgs.
  - `startLibrary.ts`: wire real deps; run `sweepStaleMounts` next to `cleanupStaleExtractions` (failure logged, never fatal).
  - `spawnProcess`: when `basename(executable).toLowerCase() === 'cmd.exe'`, spawn with `windowsVerbatimArguments: true` (args then go to cmd unchanged; the Script preset quotes `{rom}` itself, Task 6).
  - i18n `launch.reason.mountToolMissing` ("The squashfs mount tool (mountsquashfs.exe) was not found. Put it in the NextLevel tools folder or choose it in Settings → Emulators."), `mountFailed` ("The game image could not be mounted. Is WinFsp installed?"), `entryMissing` ("The game's files were not found: {looked}") + pt-BR; add the three to `LaunchErrorDetails` reasons.

- [ ] **Step 1: Write the failing tests** (fake mounter in `testing.ts` that records mount/unmount)

```ts
it('FR-EMU-9: Play mounts a .wsquashfs, renders the command against the drive, unmounts after exit', async () => {
  // profile hypseus singe; ROM 'E:\\roms\\Singe\\Agent328OB.wsquashfs'; fake mount root 'Q:' with Agent328OB.singe
  // spawned args contain 'Q:\\Agent328OB.txt' and '-script','Q:\\Agent328OB.singe'; after exited → unmount called once
});
it('FR-EMU-9: spawn failure after mounting still unmounts', async () => {});            // Review Focus 1
it('FR-EMU-9: exit code 1 within 10 s still unmounts and reports the failure', async () => {}); // Review Focus 1
it('FR-EMU-9: no mount tool → mountToolMissing with Fix in Settings, nothing spawned', async () => {}); // Review Focus 5
it('FR-EMU-9: the overlay folder is under the data folder, per system and image', async () => {
  // expect(fake.mounts[0].overlay).toBe(join(overlayRoot, 'singe', 'Agent328OB'))
});
it('FR-EMU-9: a .hypseus folder ROM uses the folder as {gameDir}, no mount', async () => {});
it('FR-EMU-5: Test launch mounts and unmounts like Play', async () => {});
it('FR-EMU-5: preview of a mount profile shows X: and does not mount', () => {});
it('FR-EMU-9: cmd.exe is spawned with verbatim arguments, other programs are not', async () => {}); // spawnProcess.test.ts
```

- [ ] **Step 2: Run** `npx vitest run apps/launcher/src/main/launch` — FAIL.
- [ ] **Step 3: Implement** per Interfaces. Keep `LaunchService.ts` readable: if it grows past ~420 lines, move `prepare` into `launch/prepareGame.ts`.
- [ ] **Step 4: Run** `npx vitest run apps/launcher` (with `CI=1`) — PASS.
- [ ] **Step 5: Commit** `feat(launcher): launch mounted squashfs games and clean up on every exit (FR-EMU-9)`.

---

### Task 5: Scanner — folder games and per-system scan rules

**Files:**
- Modify: `apps/launcher/src/main/scan/walk.ts`, `walk.test.ts` (and where the walker gets the system's extensions: `plan.ts`/`walker.ts`)
- Modify: `packages/system-catalog/src/index.ts` (`effectiveSystem` keeps `scan` from the definition; not user-editable)

**Interfaces:**
- Consumes: Task 1 `SystemDefinition.scan`.
- Produces: the walker receives `{ extensions, topLevelOnly, ignore }` per system.
  - A **folder** whose extension is one of the system's extensions is a game candidate (`relPath` = folder name) and is not descended into — any depth.
  - `topLevelOnly: true` → no sub-folders are walked.
  - `ignore`: case-insensitive globs on the file name (`*` = any run of characters), e.g. `_*`.

- [ ] **Step 1: Write the failing tests**

```ts
it('FR-LIB-1: a folder named like a game (maddog-hd.hypseus) is one game, its files are not', async () => {
  // Singe\maddog-hd.hypseus\{maddog-hd.txt,maddog-hd.singe}, extensions ['wsquashfs','hypseus'] → ['maddog-hd.hypseus']
});
it('FR-LIB-1: topLevelOnly skips docs\\ and per-game folders; ignore skips _README.txt', async () => {
  // Sega Video Driver: calichase.txt, _README.txt, docs\manual.txt, misc\x.txt → ['calichase.txt']
});
it('FR-LIB-1: the media folder and other systems behave as before', async () => { /* existing fixtures unchanged */ });
```

- [ ] **Step 2: Run** `npx vitest run apps/launcher/src/main/scan` — FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** — PASS (incl. the scan perf test with `CI=1`).
- [ ] **Step 5: Commit** `feat(scan): folder games and per-system scan rules (FR-LIB-1)`.

---

### Task 6: Catalog data — Hypseus and Script presets, system tweaks, Windows tools

**Files:**
- Modify: `packages/system-catalog/scripts/presetTables.ts`, `scripts/presets.ts` (+ test), `scripts/mapping.ts` (+ test), `packages/system-catalog/data/presets.json`, `data/systems.json` (regenerated), `src/__snapshots__/presets.test.ts.snap`, `apps/launcher/src/main/launch/detect.ts` (+ test)

**Interfaces:**
- Consumes: Task 1 schema (`squashfs`, `entries`, `argsFile`, `windowsTool`, `scan`).
- Produces:
  - `StandaloneSpec` gains optional `squashfs`, `entries`, `argsFile`, `windowsTool`, `cwd`; `variants[key]` gains optional `squashfs`, `entries`, `argsFile`. `buildPresets` copies them into the preset profiles.
  - **Hypseus** spec (homepage `https://github.com/DirtBagXon/hypseus-singe`, `executableNames: ['hypseus.exe']`, `runnerKeys: ['hypseus_singe']`, `archives: 'pass'`):
    - default `hypseus:default` "Hypseus Singe": args `['singe', 'vldp', '-framefile', '{gameDir}\\{romName}.txt', '{entryArgs}', '-fullscreen', '-opengl', '{extraArgs}']`, `squashfs: 'mount'`, entries in this order: `{gameDir}\{romName}.singe` → `['-script', '{entry}']`; `{gameDir}\{romName}.zip` → `['-zlua', '{entry}']`; `{gameDir}\*.zip` → `['-zlua', '{entry}', '-usealt', '{romName}']`.
    - variant key `hypseus` → suffix `daphne`, name "Hypseus (Daphne)": args `['{romName}', 'vldp', '-framefile', '{gameDir}\\{romName}.txt', '-fullscreen', '-opengl', '-fastboot', '-force_aspect_ratio', '{extraArgs}']`, `squashfs: 'mount'`, `argsFile: '{gameDir}\\{romName}.commands'`.
  - **Script** spec (`id: 'script'`, name "Script (.bat/.cmd)", `executableNames: ['cmd.exe']`, `windowsTool: true`, homepage `https://learn.microsoft.com/windows-server/administration/windows-commands/cmd`, `runnerKeys: ['script']`): args `['/d', '/s', '/c', '"{rom}"']`, `cwd: '{romDir}'`, `archives: 'pass'`.
  - `mapping.ts` `SYSTEM_TWEAKS: Record<NextLevelOS name, { extensions?: string[]; scan?: { topLevelOnly?: boolean; ignore?: string[] } }>` applied after the extension choice:
    - `Daphne`: `['wsquashfs']`; `Singe`: `['wsquashfs', 'hypseus']`
    - `Mattel Captain Power`, `Sega Video Driver`, `WoW Action Max`: `['txt']`, scan `{ topLevelOnly: true, ignore: ['_*'] }`
    - `Pioneer LaserActive`, `VM Labs Nuon`: `['bat']`, scan `{ topLevelOnly: true }`
  - `detectEmulators(folder, presets, windowsDir = process.env.SystemRoot ?? 'C:\\Windows')`: also returns `{ presetId, executable: <windowsDir>\System32\<name> }` for each `windowsTool` preset whose file exists.

- [ ] **Step 1: Write the failing tests**

```ts
it('FR-EMU-7: Singe, Captain Power, Video Driver and Action Max get hypseus:default; Daphne gets hypseus:daphne', () => {});
it('FR-EMU-7: script systems (VM Labs Nuon, Pioneer LaserActive, Coleco Telstar) get script:default', () => {});
it('FR-EMU-1: system tweaks set Singe extensions to wsquashfs + hypseus and txt systems to top level without _ files', () => {});
it('FR-EMU-9: the Script preset runs "FreeFall 3050 A.D.bat" as one quoted cmd argument', () => {
  // render script:default for 'E:\\NextLevel\\systems\\VM Labs Nuon\\FreeFall 3050 A.D.bat'
  // → args ['/d','/s','/c','"E:\\NextLevel\\systems\\VM Labs Nuon\\FreeFall 3050 A.D.bat"'], cwd '…\\VM Labs Nuon'
});
it('FR-EMU-7: detection finds cmd.exe for the Script preset in System32', async () => {});
```

- [ ] **Step 2: Run** `npx vitest run packages/system-catalog apps/launcher/src/main/launch/detect` — FAIL.
- [ ] **Step 3: Implement the tables and code.**
- [ ] **Step 4: Regenerate the data** the same way as on `tools/launch-compare`: NextLevelOS inputs at `3d530b7` via `git -C C:\lestivalet\NextLevelOS archive 3d530b7 public/data/launchers.json public/data/config.json public/data/screenscraper.json public/nextlevel-launcher.py public/data/gamelists | tar -x -C <scratch>\nlos`, ES-DE `es_systems.xml` v3.5.0 into `<scratch>`, then the `npm run seed -w packages/system-catalog -- …` command from `packages/system-catalog/README.md` with those paths. Check the diff touches only the new presets, the tweaked systems' `extensions`/`scan` and `presetProfiles`. Update the snapshot (`npx vitest run packages/system-catalog -u`) and read the snapshot diff.
- [ ] **Step 5: Run** `npx vitest run packages/system-catalog packages/shared apps/launcher/src/main/launch` — PASS.
- [ ] **Step 6: Commit** `feat(emulators): Hypseus Singe and Script presets; Laserdisc systems' extensions (FR-EMU-7)`.

---

### Task 7: Settings UI — mount, entry rules, args file, mount tool

**Files:**
- Modify: `apps/launcher/src/renderer/features/settings/emulators/ProfileEditor.tsx` (+ test), `EmulatorsSection.tsx` (+ test; new profile defaults `squashfs: 'pass', entries: []`), `packages/shared/src/i18n/en.json`, `pt-BR.json`
- Create: `apps/launcher/src/renderer/features/settings/emulators/EntryRulesEditor.tsx` (+ test)

**Interfaces:**
- Consumes: Task 1 schema; existing `ArgsEditor`/`TokenInput` for templates; existing file picker IPC used for emulator executables.
- Produces:
  - ProfileEditor: "squashfs images" select (Pass to emulator / Mount as a drive) under Archives; "Game files" (`EntryRulesEditor`: ordered rows of file template + args, add/remove/move up/down, token validation like `ArgsEditor`, `{entry}` offered only in rule args); "Arguments file" (`TokenInput`). The live preview and Test launch already show the result.
  - EmulatorsSection top: "squashfs mount tool" path with Browse/Clear, showing the found path as a placeholder when `tools.squashfsMount` is null (main exposes the found path through the existing settings/emulator detection IPC, or a new `emulators.mountTool` query — builder's call, one IPC at most).
  - Token help lists `{gameDir}`, `{entry}`, `{entryArgs}` with one-line descriptions (en + pt-BR).

- [ ] **Step 1: Write the failing tests**

```tsx
it('FR-EMU-2: a profile can switch squashfs to Mount and saves it', async () => {});
it('FR-EMU-2: entry rules can be added, reordered and removed; {entry} in a file field shows an error', async () => {});
it('FR-EMU-2: the mount tool path can be chosen and cleared; empty shows the found path', async () => {});
```

- [ ] **Step 2: Run** `npx vitest run apps/launcher/src/renderer/features/settings` — FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** — PASS.
- [ ] **Step 5: Commit** `feat(settings): edit squashfs mounting, game file rules and the mount tool (FR-EMU-2, FR-EMU-9)`.

---

### Task 8: Import, e2e, docs, owner checks, PR

**Files:**
- Modify (if needed): `apps/launcher/src/main/import/detectedProfiles.ts` (+ test) so `hypseus`, `hypseus_singe`, `script` systems get the new presets as defaults
- Create: `apps/launcher/e2e/laserdisc.spec.ts`, `docs/02-design/laserdisc-guide.md`
- Modify: `docs/03-architecture/adr/ADR-004-emulators-as-data.md`, `docs/01-product/02-product-requirements.md` (FR-EMU-9 note), `docs/01-product/roadmap.md`, `docs/03-architecture/data-model.md` (profile fields, `tools`, catalog `scan`, `mounts.json`, overlay folder), `docs/04-quality/launch-comparison.md`, `CHANGELOG.md` `[Unreleased]`

- [ ] **Step 1: Import check.** Run `npm run compare-launch -w apps/launcher -- --data <dev data> --reimport --emulators E:\NextLevel\emulators` (read-only on `E:\NextLevel\systems`). Expected: Daphne, Singe, Mattel Captain Power, Sega Video Driver, WoW Action Max, Pioneer LaserActive, VM Labs Nuon no longer `NO_PROFILE`; differences from the old commands are the accepted ones (mount drive vs WSL path, `-script`/`-zlua` from rules). If any still say `NO_PROFILE`, write a failing `detectedProfiles` test for it first, then fix. Record the new rows in `launch-comparison.md`.
- [ ] **Step 2: e2e** `laserdisc.spec.ts` "FR-EMU-9: a mounted Singe game plays and the drive is released": an env seam `NEXTLEVEL_E2E_FAKE_MOUNT=1` (development builds only, like the other `NEXTLEVEL_E2E_*` seams) swaps in a mounter that maps the image to a temp folder holding `Agent328OB.singe`/`.txt`; the emulator is the fake exe the e2e helpers already use; assert the launch log row has `-script <root>\Agent328OB.singe` and the fake mounter's unmount ran. Run `npm run test:e2e -- laserdisc` — PASS.
- [ ] **Step 3: Docs.** ADR-004: squashfs mounting moved before 1.0 (date, reason, WSL dropped). `laserdisc-guide.md`: install WinFsp, put `mountsquashfs.exe` in `<NextLevel>\tools`, which systems use which profile, the entry rules and how to edit them, overlay folder (saves/high scores), that nothing in the systems folder is changed, how to add per-game args (e.g. `-manymouse` for gun games). CHANGELOG `[Unreleased]` → Added: Laserdisc and VHS systems, squashfs mounting, Hypseus and Script presets; what the owner must do (put the tool in `tools`, re-run Import NextLevelOS or Settings → Emulators → Detect, rescan those systems).
- [ ] **Step 4: Full checks.** `npm run lint`, `npm run typecheck`, `CI=1 npm test` — all PASS.
- [ ] **Step 5: Owner real-launch checklist** (owner runs; nothing under `E:\NextLevel\systems` is changed): one game each — Daphne `astron` (mounted), Singe `Agent328OB` (mounted, `.singe`), Singe `maddog-hd.hypseus` (folder), American Laser Games collection game, WoW Action Max `sonicfury`, Mattel Captain Power `cpower1` (`-usealt`), Sega Video Driver `calichase` (`-usealt`), Pioneer LaserActive `Hyperion.bat`, VM Labs Nuon `FreeFall 3050 A.D.bat`. First a rescan of those systems: all 108 Singe games are present (106 come through `E:\roms\Singe`, a link to `R:\singe`). Per game: it starts, quitting returns to the launcher, the drive letter is gone (`Get-PSDrive`), and the "Laserdisc and VHS" menu group shows. Any wrong argument → fix the preset (and its test) before the PR; note argument changes in the ledger.
- [ ] **Step 6: Review.** One fresh Opus reviewer on the branch (spec + plan + Review Focus); fix Critical/Important failing-test-first; minors to the ledger.
- [ ] **Step 7: PR.** Push `feat/laserdisc-hypseus`, open the PR (base `tools/launch-compare` if still unmerged, else `main`), `gh pr checks <n>`, ask the owner before squash-merging.
