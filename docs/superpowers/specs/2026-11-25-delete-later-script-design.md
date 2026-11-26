# Delete-later cleanup script — design (short)

Owner request 2026-11-25. Builds on FR-LIB-19 / US-C13 (Duplicates, Delete later).

## Intent

The owner marks games **Delete later** while reviewing a collection, then deletes the files by
hand, switching between the launcher and Explorer for each one. They want the launcher to write
a **PowerShell script** that deletes those files, which they read, edit and run themselves. The
launcher still never deletes, moves or renames files (FR-LIB-19 unchanged).

## Goals

- From the **Delete later** tab: **Export cleanup script…** → Save dialog → a `.ps1` file.
- The script removes every file of every marked game **in every storage location** where it
  exists. Other locations are more places the owner keeps ROMs, not backups (owner, 2026-11-25).
- One readable line per file, so the owner can comment out what to keep.

## Non-goals / anti-goals

- The launcher never runs the script and never deletes anything itself.
- No saves, scraped media, or anything other than the game's ROM files.
- No permanent delete: a file is never removed past the Recycle Bin.
- Failure even if it works: a line that deletes a file the owner couldn't see in the script
  (wildcards, paths resolved at run time).

## Approaches

- **A. Spell out every path at export (picked).** Resolved when exporting; what you read is
  what runs. It's a snapshot, so export again after marking more games.
- B. Resolve paths when the script runs: always current, but the owner can't review the files.
- C. A path list plus a generic helper script: two files, and easy to run the wrong list.

## Design

- **Which games:** the Delete later tab's games for the current scope (hidden included, missing
  excluded, same as the tab).
- **Which files:** for each game, its `rel_path` checked in every non-managed storage location
  (`<location>/<system folderName>/<rel_path>`, existing files only). A `.cue`/`.m3u` adds the
  files it references (`scan/playlists.ts`). A loose disc set (`discGroup`) adds its sibling
  discs, with the same rules as `scan/discs.ts`. A game folder (`gameFolderFile` systems)
  becomes one line for the folder.
- **Managed (Catalog) location: skipped (my call).** Those files belong to installs, and Catalog
  **Uninstall** removes them. The script lists them as comments ("installed from Catalog — use
  Uninstall").
- **Script shape:** header comment (exported date, scope, game/file counts, total size, "review
  before running"); one `Remove-ToRecycleBin` helper; then, per game, a comment line
  (`# Title · system`) followed by one line per file with a `# location name` comment. Paths are
  single-quoted with `'` doubled. The script is UTF-8 with BOM, so Windows PowerShell 5.1 reads
  accented names correctly.
- **Helper:** `Test-Path -LiteralPath` → skip (print "already gone") when missing. It calls the
  shell's `SHFileOperation` with `FOF_ALLOWUNDO | FOF_NOCONFIRMATION | FOF_WANTNUKEWARNING`
  (review fix 2026-11-25: the VisualBasic call silently deletes for good when Windows can't
  recycle). Windows then asks before any permanent delete, and No is reported as skipped.
  When the drive has no Recycle Bin or the call fails, it prints a skip message and **does not
  delete**. It ends with a summary (recycled / already gone / skipped). A `-DryRun` switch only
  prints what would happen (my call: it lets the owner, and the tests, run the script safely).
- **After running:** nothing in the launcher changes. The next scan moves the games to Missing,
  same as a hand delete today.
- **Contracts:** a new IPC channel (`library.exportCleanupScript`) with Zod input (scope) and
  output (`cancelled` | `saved` with game and file counts) in `packages/shared`. The file is
  written with `atomicWrite`, and the script is rendered by a pure function (unit-tested).
- **UI:** a bar on the Delete later tab (shown when it has games, like Missing's bar) with the
  count and the button. The result shows in the bar ("Script saved: 12 games, 15 files"); the
  launcher has no toasts. All strings go through i18n
  (en, pt-BR).
- **Docs:** add FR-LIB-20 and US-C14, plus the screen spec, api/IPC notes
  and the CHANGELOG.

## Left to the builder

The exact helper code, the file-name suggestion (e.g. `delete-later-<system>.ps1`), and the
toast wording.
