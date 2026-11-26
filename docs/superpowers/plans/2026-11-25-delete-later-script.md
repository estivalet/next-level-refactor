# Delete-later cleanup script Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** In the Delete later tab, **Export cleanup script…** saves a PowerShell `.ps1` file.
The script sends every file of every marked game, in every storage location, to the Recycle
Bin. The owner reviews it and runs it; the launcher never deletes anything.

**Architecture:** `GameExportReader.deleteLaterGames(scope)` reads the tab's games.
`collectCleanupFiles` (main, touches the disk read-only) finds each game's files in every
location, expanding playlists and disc sets. `renderCleanupScript` (pure) turns that into the
script text. `exportCleanupScript` asks for a path and writes the file atomically, behind a new
IPC channel `library.exportCleanupScript`. The renderer adds a bar to the Delete later tab in
`ScopeToolbar`, the same way Missing has one.

**Tech Stack:** TypeScript ESM, Zod (`packages/shared`), better-sqlite3 via the existing query
helpers, Electron `dialog`, React + react-i18next, Vitest, Windows PowerShell 5.1 (the script's
target).

**Spec:** `docs/superpowers/specs/2026-11-25-delete-later-script-design.md`

## Global Constraints

- Requirement **FR-LIB-20**, story **US-C14**; every new test name carries one of them.
- The launcher never deletes, moves or renames files (FR-LIB-19 stays true); it only writes the
  `.ps1` the owner picks.
- The script never deletes permanently: Recycle Bin only. When recycling fails (e.g. a drive
  without a Recycle Bin), it prints a skip and goes on.
- Managed (Catalog) locations: their files are written only as comments (`# installed from
  Catalog, use Uninstall: <path>`), never as delete lines.
- Only ROM files: no saves and no media.
- Script file: UTF-8 **with BOM**, CRLF line endings, paths single-quoted.
- `packages/*` never import `apps/*`; renderer talks only through `getBridge().invoke`.
- All user-visible strings through i18n, `en` and `pt-BR`.
- Files under 400 lines. `LibraryApp.tsx` is at 398: Task 5 must not grow it.
- Branch `feat/delete-later-script`; commits `feat(launcher|shared): … (FR-LIB-20, US-C14)`.
- Lint, typecheck and `npm test` pass before done; run tests via `scripts/vitest.mjs`.

## Review Focus

1. **Quote characters in names**: `'` and the curly quotes `‘ ’ ‚ ‛`, which PowerShell also treats
   as single quotes. In `Coca-Cola Kid's.zip` or `Kid’s.zip`, each of those must be doubled, or
   the line breaks or runs something else. Test in Task 3.
2. **Wildcard characters** `[ ]` in names (`[T-En by Filler v1.1]`): `Test-Path` without
   `-LiteralPath` treats them as patterns and reports "already gone". Covered by the Task 3
   PowerShell run.
3. **A playlist pointing outside the system folder** (`FILE "..\..\other\x.bin"`): never write a
   delete line for it. Write a comment instead. Test in Task 2.
4. **The same file reached twice** (two `.cue`s sharing a `.bin`, or two marked games that are
   the same path in one location): one line only. Test in Task 2.
5. **Newlines or `#` in a title**: a title goes only into a `#` comment. CR/LF must be replaced
   with spaces so a title can't start a new script line. Test in Task 3.

---

### Task 1: Requirement, story and IPC contract

**Files:**
- Modify: `docs/01-product/02-product-requirements.md` (add the FR-LIB-20 row after FR-LIB-19)
- Modify: `docs/01-product/03-user-stories.md` (add US-C14 after US-C13)
- Create: `packages/shared/src/library/cleanupScript.ts`
- Create: `packages/shared/src/library/cleanupScript.test.ts`
- Modify: `packages/shared/src/library/index` barrel (wherever `export.ts` is re-exported)
- Modify: `packages/shared/src/ipc/contract.ts` (next to `'library.export'`, line ~217)
- Modify: `docs/03-architecture/api-spec.md:200` (Library row: add the channel)

**Interfaces:**
- Produces:
  - `CleanupScriptRequestSchema = z.strictObject({ scope: GameScopeSchema, title: z.string().trim().min(1).max(200) })`
  - `CleanupScriptResultSchema`, a discriminated union on `status`: `{ status: 'cancelled' }` |
    `{ status: 'saved', games: int ≥ 0, files: int ≥ 0 }`
  - types `CleanupScriptRequest`, `CleanupScriptResult`
  - IPC `'library.exportCleanupScript': { input: CleanupScriptRequestSchema, output: CleanupScriptResultSchema }`

- [ ] **Step 1: Write the docs.**
  - FR-LIB-20 row, priority S, text: "Delete-later cleanup script (owner request 2026-11-25):
    the Delete later tab exports a PowerShell script that sends every file of the tab's games
    to the Recycle Bin, in every storage location the file is in. Files a `.cue`/`.m3u` names
    and the other discs of a disc set are included. Catalog installs are listed as comments
    only. The owner reviews and runs the script; the launcher itself still never deletes,
    moves or renames files (FR-LIB-19), and the next scan marks the games missing."
  - US-C14 "Delete my marked games with a script I review · FR-LIB-20" with these criteria:
    - Given two marked games in Sega Game Gear, one of them also in a second location, when I
      press **Export cleanup script…** and save, then the script has one line per file (three
      lines), each with its location.
    - A `.cue` game's `.bin` files are in the script.
    - Running it sends the files to the Recycle Bin; running it again reports them already gone.
    - A file on a drive without a Recycle Bin is skipped, not deleted.
- [ ] **Step 2: Write the failing test** `cleanupScript.test.ts`:
  - `FR-LIB-20: CleanupScriptRequest takes a scope and a title`: parses
    `{ scope: { kind: 'system', systemId: 'gamegear' }, title: 'Sega Game Gear' }`; rejects
    `title: ''` and an extra key.
  - `FR-LIB-20: CleanupScriptResult is cancelled or saved with counts`: parses
    `{ status: 'saved', games: 2, files: 3 }`; rejects `files: -1`.
- [ ] **Step 3: Run it.** `node scripts/vitest.mjs run packages/shared/src/library/cleanupScript.test.ts`
  should FAIL (module not found).
- [ ] **Step 4: Implement the schemas**, export them from the barrel, and add the contract entry
  with the doc comment `/** FR-LIB-20: writes the Delete later tab's cleanup script to a file the user picks. */`.
  Add the channel to the api-spec Library row.
- [ ] **Step 5: Run the test and `npm run typecheck`.** The test should PASS. Typecheck is
  expected to fail only in `libraryHandlers.ts`, because the channel has no handler yet. That
  is fixed in Task 4. If the repo enforces handler completeness at typecheck, add a temporary
  `throw` handler to keep commits green.
- [ ] **Step 6: Commit** `feat(shared): cleanup script contract (FR-LIB-20, US-C14)` with the docs.

### Task 2: Delete-later games and their files

**Files:**
- Modify: `apps/launcher/src/main/library/GameExportReader.ts`
- Test: `apps/launcher/src/main/library/GameExportReader.test.ts` (existing; add cases)
- Create: `apps/launcher/src/main/export/cleanupFiles.ts`
- Create: `apps/launcher/src/main/export/cleanupFiles.test.ts`

**Interfaces:**
- Consumes: `resolveScope`, `listShape` (`gameSql.ts`, tab `'deleteLater'`), `playlistReferences`
  and `PLAYLIST_EXTENSIONS` (`scan/playlists.ts`), `DISC_PATTERN` and `normalizeDiscName`
  (`scan/discs.ts`), `orderedLocations` and `StorageLocation` (`@nextlevel/shared`).
- Produces:
  ```ts
  // GameExportReader
  deleteLaterGames(scope: GameScope): DeleteLaterGame[]
  export interface DeleteLaterGame { title: string; systemId: string; system: string; relPath: string; discGroup: string | null }

  // cleanupFiles.ts
  export interface CleanupFile { path: string; location: string; size: number; folder: boolean }
  export interface CleanupGame { title: string; system: string; files: CleanupFile[]; notes: string[] }
  export interface CleanupDeps {
    locations: readonly StorageLocation[];          // any order; sorted by priority inside
    folderName: (systemId: string) => string;       // the settings/catalog rule used by expectedGamePath
  }
  export async function collectCleanupFiles(games: readonly DeleteLaterGame[], deps: CleanupDeps): Promise<CleanupGame[]>
  ```
  `notes` holds the comment lines, without `#`: Catalog copies and playlist entries outside
  the system folder.

- [ ] **Step 1: Write the failing reader test** `US-C14: deleteLaterGames lists the Delete later
  tab with system and disc group`. Seed three games: one marked, one marked + hidden, one marked +
  missing. Expect the first two, in title order, with `relPath`, `systemId`, the system name
  and `discGroup`.
- [ ] **Step 2: Implement `deleteLaterGames`** like `read()`, with `listShape({ scope, tab:
  'deleteLater' }, …)`. Select `g.system_id`, `g.rel_path`, `g.disc_group` and the title. Run
  the test; it should PASS.
- [ ] **Step 3: Write the failing `cleanupFiles.test.ts`** against `mkdtemp` folders. Make two
  locations `A` (priority 1) and `B` (priority 2) plus a managed `C`, with system folder `Game
  Gear`:
  - `FR-LIB-20: a game is found in every location`: `x.gg` in A and B → two files, locations
    `A` and `B`, sizes from disk.
  - `FR-LIB-20: a file in no location is left out`: a game whose file is gone → `files: []`.
  - `FR-LIB-20: a cue brings its bins, an m3u its cues and their bins`: `g.m3u` → `g (Disc
    1).cue` → `g (Disc 1).bin`. Expect all three, each once.
  - `FR-LIB-20: a disc set brings its other discs`: `discGroup: 'Saga (USA)'`, `relPath:
    'Saga (USA) (Disc 1).chd'`, with `Saga (USA) (Disc 2).chd` and `Saga (Japan) (Disc 2).chd`
    in the folder. Expect Disc 1 and Disc 2 (USA) only.
  - `FR-LIB-20: a playlist entry outside the system folder is a note, not a file`: a cue with
    `FILE "..\..\elsewhere.bin"` → the bin isn't in `files`; `notes` has one line naming the
    path.
  - `FR-LIB-20: a file reached twice is listed once`: two `.cue`s sharing one `.bin`, both games
    marked → the `.bin` appears in exactly one game's files. Compare paths case-insensitively.
  - `FR-LIB-20: Catalog copies are notes`: `x.gg` also in managed `C` → C isn't in `files`;
    `notes` has `installed from Catalog, use Uninstall: <path>`.
  - `FR-LIB-20: a game folder is one folder entry`: `relPath` is a directory → one file with
    `folder: true`, its contents not listed.
- [ ] **Step 4: Run it.** Expected: FAIL (module not found).
- [ ] **Step 5: Implement `collectCleanupFiles`.** For each non-managed location in priority
  order, check `join(location.path, folderName(systemId), ...relPath.split('/'))` with `stat`.
  A playlist is expanded recursively, with a visited set. A referenced path must stay under that
  location's system folder; otherwise it becomes a note. A disc group adds the files in the same
  folder whose stem matches `DISC_PATTERN` and has `normalizeDiscName(stem) === discGroup`, case
  ignored. One `Set` of lower-cased paths spans all games, so a file is listed only once.
  Missing files are silently skipped. Run the tests; they should PASS.
- [ ] **Step 6: Commit** `feat(launcher): find Delete later files in every location (FR-LIB-20, US-C14)`.

### Task 3: Script text

**Files:**
- Create: `apps/launcher/src/main/export/cleanupScript.ts`
- Create: `apps/launcher/src/main/export/cleanupScript.test.ts`

**Interfaces:**
- Consumes: `CleanupGame` (Task 2).
- Produces: `renderCleanupScript(games: readonly CleanupGame[], meta: { scope: string; exportedAt: string }): string`.
  It returns the full file content: BOM first, CRLF lines.

Script layout. The line content is fixed; the helper body is the builder's:
```
# NextLevel cleanup script: <scope>, exported <exportedAt>
# <G> games, <F> files, <size, e.g. 1.2 GB>. Review before running: comment out (#) any line to keep a file.
# Files go to the Recycle Bin. Run with -DryRun to only list what would happen.
param([switch]$DryRun)
<helper: function Remove-ToRecycleBin([string]$Path, [switch]$Folder) … counters, final summary>

# <title> · <system>
Remove-ToRecycleBin '<path>'            # <location>
Remove-ToRecycleBin '<path>' -Folder    # <location>
# <note>
```
Helper behaviour:
- `Test-Path -LiteralPath`. When the path is gone, print `Already gone: <path>`.
- `-DryRun`: print `Would recycle: <path>`.
- Otherwise call `[Microsoft.VisualBasic.FileIO.FileSystem]::DeleteFile` (or `DeleteDirectory`)
  with `OnlyErrorDialogs, SendToRecycleBin` inside `try`. On an exception print
  `Skipped (not deleted): <path>: <message>`. Never fall back to `Remove-Item`.
- `Add-Type -AssemblyName Microsoft.VisualBasic` once.
- End with `Recycled N · already gone N · skipped N`.

- [ ] **Step 1: Write the failing test** `cleanupScript.test.ts`:
  - `FR-LIB-20: the script starts with a BOM and uses CRLF`: `startsWith('\uFEFF')`, and no `\n`
    without `\r` before it.
  - `FR-LIB-20: the header counts games, files and size`: two games, three files of
    1 000 000 bytes → the header contains `2 games, 3 files, 2.9 MB`. Use the same size format
    the launcher already uses elsewhere if there is a helper; otherwise binary units, one decimal.
  - `FR-LIB-20: one line per file, with its location`: contains
    `Remove-ToRecycleBin 'E:\roms\Game Gear\x.gg'` and `# B`.
  - `US-C14: quotes in a path are doubled`: path `E:\r\Kid's ‘x’.gg` → the line holds
    `'E:\r\Kid''s ‘‘x’’.gg'`. (Review Focus 1)
  - `US-C14: a title can't break out of its comment`: title `"Evil\r\nRemove-Item C:\"` → no
    line of the output starts with `Remove-Item`. (Review Focus 5)
  - `FR-LIB-20: notes are comments`: every note appears as a line starting with `# `.
  - `FR-LIB-20: no permanent delete`: the output contains no `Remove-Item` and no
    `DeleteDirectory`/`DeleteFile` call without `SendToRecycleBin`.
  - `FR-LIB-20: the script runs in Windows PowerShell` (`it.skipIf(process.platform !== 'win32')`,
    as in `spawnProcess.test.ts`; CI runs on windows-latest). Set up a temp folder holding
    `a [T-En].gg`, `b's.gg` and a path that doesn't exist. Render, write it out, and run
    `powershell.exe -NoProfile -ExecutionPolicy Bypass -File <ps1> -DryRun` with argv and
    `shell: false`. Expect exit code 0, `Would recycle:` for both existing files, `Already
    gone:` for the third, and both files still on disk. (Review Focus 2)
- [ ] **Step 2: Run it.** Expected: FAIL (module not found).
- [ ] **Step 3: Implement `renderCleanupScript`.**
  - Quote with `'` + `path.replace(/['‘’‚‛]/g, (q) => q + q)` + `'`.
  - Comment text: replace `[\r\n]+` with a space.
  - A game with no files and no notes gets just its title comment plus `# no files found`.
- [ ] **Step 4: Run the tests.** Expected: PASS (on Windows, including the PowerShell run).
- [ ] **Step 5: Commit** `feat(launcher): render the cleanup script (FR-LIB-20, US-C14)`.

### Task 4: Export flow, handler and Save dialog

**Files:**
- Create: `apps/launcher/src/main/export/exportCleanupScript.ts`
- Create: `apps/launcher/src/main/export/exportCleanupScript.test.ts`
- Modify: `apps/launcher/src/main/handlers.ts:96` (`MainDeps`: add `pickScriptPath`)
- Modify: `apps/launcher/src/main/libraryHandlers.ts:96` (add the channel next to `'library.export'`)
- Modify: `apps/launcher/src/main/index.ts:179` (add `pickScriptPath` next to `pickExportPath`;
  filter `{ name: 'PowerShell script', extensions: ['ps1'] }`)
- Modify: test doubles that build `MainDeps` (`handlers.test.ts`, `handlers.library.test.ts`)

**Interfaces:**
- Consumes: `deleteLaterGames`, `collectCleanupFiles`, `renderCleanupScript`, `atomicWrite`,
  `exportFileName` logic from `exportGames.ts` (reuse its sanitising; extract a
  `safeFileName(title)` if needed rather than duplicating).
- Produces:
  ```ts
  export interface CleanupExportDeps {
    reader: Pick<GameExportReader, 'deleteLaterGames'>;
    files: (games: readonly DeleteLaterGame[]) => Promise<CleanupGame[]>;
    pickPath: (defaultName: string) => Promise<string | null>;
    clock: () => Date;
  }
  export async function exportCleanupScript(deps: CleanupExportDeps, request: CleanupScriptRequest): Promise<CleanupScriptResult>
  // MainDeps
  pickScriptPath: (defaultName: string) => Promise<string | null>;
  ```

- [ ] **Step 1: Write the failing test** `exportCleanupScript.test.ts`, with fakes and a temp
  output path:
  - `FR-LIB-20: suggests "delete-later-<title>.ps1"`: title `Sega Game Gear` → `pickPath`
    called with `delete-later-Sega Game Gear.ps1`.
  - `FR-LIB-20: cancelling writes nothing`: `pickPath` → null → `{ status: 'cancelled' }`, and
    `files` was never called. (Read games first, as `exportGames` does, so a gone scope fails
    before the dialog. Collect files after the dialog, because that touches the disk.)
  - `FR-LIB-20: saving writes the script and counts games and files`: two games, three files →
    `{ status: 'saved', games: 2, files: 3 }`, and the file starts with the BOM.
- [ ] **Step 2: Run it.** Expected: FAIL.
- [ ] **Step 3: Implement it** and wire the handler:
  `exportCleanupScript({ reader: library().exports, files: (g) => collectCleanupFiles(g, { locations, folderName }), pickPath: deps.pickScriptPath, clock: deps.clock }, request)`.
  - `locations` and `folderName` come from the current settings, using the same lookup as
    `expectedGamePath` (`settings.systems[id]?.folderName ?? system?.defaultFolderName ?? id`).
    Export a small `systemFolderName(settings, system, systemId)` from `expectedPath.ts` and
    use it in both places rather than copying the rule.
- [ ] **Step 4: Run** `node scripts/vitest.mjs run apps/launcher/src/main` and `npm run typecheck`.
  Both should PASS.
- [ ] **Step 5: Commit** `feat(launcher): export the cleanup script (FR-LIB-20, US-C14)`.

### Task 5: Delete later bar, strings and docs

**Files:**
- Modify: `apps/launcher/src/renderer/features/library/ScopeToolbar.tsx`
- Modify: `apps/launcher/src/renderer/features/library/LibraryApp.tsx:289`: replace
  `missing={facets.data?.tabs.missing}` with `tabs={facets.data?.tabs}`. Keep it one line; the
  file must stay ≤ 400.
- Create: `apps/launcher/src/renderer/features/library/DeleteLaterBar.tsx` (keeps ScopeToolbar
  small)
- Test: `apps/launcher/src/renderer/features/library/DeleteLaterBar.test.tsx`
- Modify: `packages/shared/src/i18n/en.json`, `pt-BR.json`
- Modify: `docs/02-design/screen-specifications.md` (Delete later tab, near line 218),
  `CHANGELOG.md` (Unreleased), the roadmap status line for FR-LIB-20 if the roadmap lists
  FR-LIB-19

**Interfaces:**
- Consumes: IPC `library.exportCleanupScript` (Task 1).
- Produces: `DeleteLaterBar({ scope, title, count }: { scope: GameScope; title: string; count: number })`.
  `ScopeToolbar` renders it when `view.tab === 'deleteLater' && count > 0`; its prop
  `missing` becomes `tabs: TabCounts | undefined`.

i18n keys (en / pt-BR):
- `library.cleanup.count`: "{{count}} games marked" / "{{count}} jogos marcados" (with plural forms as the file does elsewhere)
- `library.cleanup.export`: "Export cleanup script…" / "Exportar script de limpeza…"
- `library.cleanup.saved`: "Script saved: {{games}} games, {{files}} files. Review it before running." / "Script salvo: {{games}} jogos, {{files}} arquivos. Revise antes de executar."
- `library.cleanup.failed`: "Couldn't save the script." / "Não foi possível salvar o script."

- [ ] **Step 1: Write the failing test** `DeleteLaterBar.test.tsx`, using the bridge mock the
  other Library tests use (see `RemoveGamesDialog.test.tsx`):
  - `US-C14: the bar exports the scope's cleanup script`: click **Export cleanup script…** →
    invoke called with `('library.exportCleanupScript', { scope, title })`; the bridge returns
    `{ status: 'saved', games: 2, files: 3 }` → "Script saved: 2 games, 3 files…" shown.
  - `US-C14: cancelling shows nothing`: `{ status: 'cancelled' }` → no saved text.
  - `US-C14: a failure says so`: invoke rejects → the failed text appears.
  - In `ScopeView.test.tsx` or the existing ScopeToolbar test, add `US-C14: the bar shows only
    on a Delete later tab with games`.
- [ ] **Step 2: Run it.** Expected: FAIL.
- [ ] **Step 3: Implement it.** Use `useMutation` + `unwrap(await getBridge().invoke(…))`, as
  `ExportDialog.tsx:38` does. The bar matches the Missing bar's markup in `ScopeToolbar.tsx`,
  with the `FileDown` icon.
- [ ] **Step 4: Update the docs.** Screen spec: "Delete later tab with games: a bar with the
  count and **Export cleanup script…** (FR-LIB-20)". CHANGELOG Unreleased: "**Cleanup script**
  (FR-LIB-20, US-C14): the Delete later tab exports a PowerShell script that sends the marked
  games' files, in every storage location, to the Recycle Bin, for you to review and run."
- [ ] **Step 5: Verify everything:** `npm run lint`, `npm run typecheck`, `npm test`. All pass,
  and `traceability.test.ts` finds FR-LIB-20. If a new migration was involved (none expected),
  clear `.vitest-cache`.
- [ ] **Step 6: Commit** `feat(launcher): Delete later cleanup script button (FR-LIB-20, US-C14)`.
