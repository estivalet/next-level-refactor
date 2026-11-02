# Laserdisc and VHS: Hypseus, squashfs mounting, script games — design

- **Date:** 2026-11-01
- **Status:** Draft, awaiting owner approval
- **Requirements touched:** FR-EMU-7 (presets), FR-EMU-9 (pre-launch hooks, moved before 1.0 for
  squashfs only), FR-EMU-3 (tokens), FR-EMU-5 (Test launch), ADR-004 (amend: squashfs mounting is
  no longer "after 1.0")

## 1. Intent

The owner's "Laserdisc and VHS" menu group does not show in the rebuild, and none of its games can
launch: M3 (D1) left Hypseus, squashfs/WSL and `script` launches out, and ADR-004 parked mounting
until after 1.0. In NextLevelOS this group was never finished either: `nextlevel-launcher.py`
tried two mount methods (WSL and an external tool), and the Singe `.wsquashfs` games need a
`squashfs_exe` value no gamelist entry has, so they fall through to a broken command.

The owner wants this group working now, built from scratch, with the same goal as RetroBat:
**mount `.wsquashfs` images instead of extracting them**, so disk space is saved. It is the hardest
group, so doing it first also proves the hook mechanism the rest of the deferred systems (Pong /
Coleco Telstar, TeknoParrot, other squashfs systems) will reuse.

## 2. Scope

### Goals — every game in the owner's "Laserdisc and VHS" menu group launches

| Menu item | System folder / ROMs | Games | Kind |
|---|---|---|---|
| Daphne | `E:\NextLevel\systems\Daphne` (`*.wsquashfs`; game ROM zips in `Daphne\roms`) | 19 | Hypseus, mounted |
| Singe | `E:\roms\Singe` → `R:\singe` (symlink) `*.wsquashfs`; `E:\NextLevel\systems\Singe\*.hypseus\` folders | 106 + 2 | Hypseus Singe, mounted or folder |
| American Laser Games (collection) | games live in the Singe system (folder `_README.txt`: "Roms are in Singe folder now") | 7 | covered by Singe |
| WoW Action Max | `<game>.txt` + `<game>.singe` + shared `actionmax.zip` | 5 | Hypseus Singe, plain files |
| Mattel Captain Power | `<game>.txt` + shared `captainpower.zip` | 5 | Hypseus Singe, plain files |
| Sega Video Driver | `<game>.txt` + shared `videodriver.zip` (see risk R2) | 6 | Hypseus Singe, plain files |
| Pioneer LaserActive | `Hyperion.bat` | 1 | Script |
| VM Labs Nuon | `<game>.bat` (+ folder per game) | 6 | Script |

Plus: the menu group shows in the launcher again (it is hidden today; find out why while building —
likely because no system in it has a launchable profile — and fix the cause, not the symptom).

### Non-goals (this round)

- **Pong / Coleco Telstar**: next round. The Script preset built here is what it needs; only the
  menu/system wiring remains.
- **WSL mounting**: dropped. Mounting uses the WinFsp-based tool only.
- Other squashfs users (e.g. Nintendo SNES MSU-1 per-game `.wsquashfs`, PC games): the hook is
  generic, but wiring those systems is a later round.
- TeknoParrot, AAE, Demul, Model 2/3, pinball.
- Shipping the mount tool or WinFsp with the launcher (licence unknown; see §4.1).

### Anti-goals (would be a failure even if games launch)

- A drive letter left mounted after the game exits, the launcher crashes, or the launch fails
  half-way. Every exit path unmounts.
- Writes outside the launcher's own folder (portable rule): the overlay folder must live under the
  launcher's data folder, never `%TEMP%`/AppData/next to the images.
- Re-introducing a free-form command string or a shell (ADR-004): argv arrays only, no `cmd /c`
  except where a `.bat` is the game itself (§4.4).
- Requiring the owner to edit 100+ gamelist entries (no `squashfs_exe`-style per-game values).
- Hard-coding `E:\` or any drive letter.
- **Changing, moving or deleting anything under `E:\NextLevel\systems`** (owner rule: some files
  were hard to find). The launcher, tests and manual checks only read there; mounts write to the
  overlay in the launcher's data folder, never into the image's folder.

**WSL:** not needed. The WinFsp mount tool was tested on the owner's PC (mount ≈ 0.4 s, kill
unmounts), and it is the only mount method.

## 3. Constraints

- Monorepo conventions in `CLAUDE.md`/`AGENTS.md`: TDD, FR ids in test names, lint/typecheck/
  test/test:e2e, one fresh reviewer, PR, owner OK before squash-merge.
- Everything stays editable in **Settings → Emulators** (owner asked): presets become ordinary
  profiles with editable argument templates; the new mount setting is a profile field like
  `archives`.
- Branch state: `tools/launch-compare` (worktree, unpushed) changes `presets.json` and the
  importer; `feat/gamelist-export` (7689108) is unmerged. **Builder's call:** branch off
  `origin/main`, and rebase onto whichever of those lands first; keep preset additions in their own
  block to keep conflicts small.

## 4. Design (decided parts)

### 4.1 The mount tool

- `mountsquashfs.exe` ("squashoverlay v0.1.0", from RetroBat; needs WinFsp ≥ 1.10, installed on the
  owner's PC). Usage: `mountsquashfs.exe -drive <X:> -overlay <dir> <image>`; it runs until killed,
  killing it unmounts. Measured on the owner's PC: drive appears in ~0.4 s; killing it removes the
  drive.
- **Location (owner decision):** the owner moves it to `E:\NextLevel\tools\`. The launcher finds it
  at `<NextLevel root>\tools\mountsquashfs.exe` (the root that holds `emulators\`; reuse whatever
  emulator auto-detection already uses as root), and Settings has a "squashfs mount tool" path
  field to point elsewhere. Not bundled.
- Missing tool or missing WinFsp → a launch error with a "Fix in Settings" link (existing
  `fix` mechanism), not a crash. Detect WinFsp absence from the tool's exit/output.

### 4.2 Mount as a launch step (FR-EMU-9, squashfs only)

- New profile field next to `archives`, e.g. `squashfs: 'pass' | 'mount'` (default `pass`).
  A `.wsquashfs` ROM with `mount` is mounted before the command is built; otherwise passed as-is.
- Lives beside `prepareRom` (archives.ts) and returns the same shape: a path plus `cleanup()`.
  LaunchService already calls `cleanup()` on every exit path — mount cleanup = kill the tool and
  wait for the drive to disappear (bounded wait, log if it doesn't).
- Drive letter: first free letter from a fixed preference list (high letters first), checked at
  mount time. One game at a time is already enforced, so no letter juggling between games.
- Overlay: `<data>\squashfs-overlay\<systemId>\<image name>\` — persistent, so Hypseus high scores
  and settings survive between plays (decided: keep writes, like the old launcher's read-write
  preference). Created on demand.
- Start-up cleanup: if a previous run crashed, a stray mount process of ours may still hold a
  drive. On start, kill leftover `mountsquashfs.exe` processes we started (record PID + drive in
  `<data>\temp\mounts.json` while mounted; remove on cleanup).
- Test launch (FR-EMU-5) mounts and unmounts the same way and shows the mounted command.

### 4.3 Finding what to launch inside an image or folder

No per-game values. After mounting (or for a `.hypseus` folder, or a plain `.txt`), the launcher
looks for the game's files by name in the **game root** = mount drive root, or the `.hypseus`
folder, or the ROM's own folder:

- `{romName}` = the image/folder/file name without extension (`astron`, `Agent328OB`, `maddog-hd`,
  `cpower1`).
- Hypseus conventions (RetroBat / hypseus_singe_data): `<name>.txt` framefile; Singe games add
  `<name>.singe` (script) or `<name>.zip` (Lua zip); Daphne adds an optional `<name>.commands`
  holding extra arguments.

Decided behaviour per profile (see §4.5 for argv):

- **Daphne:** `<root>\<name>.txt` framefile; append the contents of `<root>\<name>.commands` when
  present (split on whitespace).
- **Singe:** `<root>\<name>.singe` → `-script` it; else `<root>\<name>.zip` → `-zlua` it; else a
  clear launch error naming what was looked for. Agent328OB has both `.singe` and `.zip`:
  `.singe` wins (matches Hypseus docs: the zip is the packed form of the same script).
- **Shared-zip systems** (Captain Power, Video Driver, Action Max): `<game>.txt` framefile, the
  system's one Lua zip with `-usealt <name>` (hypseus_singe_data `00-zip-roms` convention). WoW
  Action Max has per-game `.singe` files too; use them if `-usealt` turns out not to apply there
  (builder verifies with a real launch).

**Mechanism is the builder's call**, with these limits: the rules stay visible/editable in
Settings (not hidden in code paths the owner can't see), and adding a token must follow FR-EMU-3
(validated on save, documented). A suggested shape: new tokens for the game root (`{gameDir}`) and
an "entry" list on the profile — ordered `{ file: '{romName}.singe', args: ['-script', '{entry}'] }`
rules, first existing file wins, rendered where an `{entryArgs}` token sits; `.commands` handled as
one more rule kind.

### 4.4 Script preset

- One "Script" emulator preset: the ROM itself is the executable (`.bat`/`.cmd`), cwd = the ROM's
  folder. Since a `.bat` cannot be spawned without `cmd.exe`, this preset alone spawns
  `cmd.exe /d /c <rom>` with the ROM path as one argv element (Node `spawn` with `shell: false`).
  Document this as the only allowed `cmd` use.
- `.exe` games could use the same preset later (spawned directly) — not needed now.

### 4.5 Presets (FR-EMU-7)

One **Hypseus** emulator (`hypseus.exe`, auto-detected under `<root>\emulators\hypseus_singe\`),
profiles (args are the starting point the builder verifies against a real launch on the owner's PC;
old-launcher reference in brackets):

| Profile | Systems | Args (sketch) |
|---|---|---|
| `hypseus:daphne` | Daphne | `{romName} vldp -framefile {gameDir}\{romName}.txt -fullscreen -opengl -fastboot -force_aspect_ratio` + `.commands` [HypseusEmulatorLauncher] |
| `hypseus:singe` | Singe | `singe vldp -framefile {gameDir}\{romName}.txt` + `-script`/`-zlua` entry `-fullscreen -opengl` (+ `-manymouse` for gun games; builder decides default) |
| `hypseus:singe-zip` | Captain Power, Video Driver, Action Max | `singe vldp -framefile {rom} -zlua {systemDir}\<zip> -usealt {romName} -fullscreen -opengl` (zip name per system: a per-system profile or an editable value) |

Daphne game ROM zips sit in `E:\NextLevel\systems\Daphne\roms`; Hypseus defaults to its own
`roms\`. Builder checks whether `-romdir`/`-homedir` is needed and keeps Hypseus' own config files
(`hypinput.ini`) working; any writes Hypseus makes into its own folder are its business, not ours.

Plus the **Script** preset (§4.4) for Pioneer LaserActive and VM Labs Nuon.

### 4.6 Systems and import

- System catalog entries for these systems already exist (`daphne`, `singe`, `mattel-captain-power`,
  `sega-video-driver`, `wow-action-max`, `pioneer-laseractive`, `vm-labs-nuon`, per
  `docs/04-quality/launch-comparison.md`). Add the new presets as their suggested emulators and add
  extensions `wsquashfs`, `hypseus` (folder), `txt`, `bat` where missing.
- `.hypseus` entries are **folders**: the scanner must accept a folder with that extension as a
  game. Check how the scanner treats directories today.
- Importer: map NextLevelOS `hypseus`, `hypseus_singe` and `script` (for these systems) to the new
  profiles instead of reporting them. Existing imported games just need their system default
  profile set — no re-import should be required if the owner only enables the presets; say in the
  CHANGELOG what the owner must do.

## 5. Risks

- **R1 Mount tool behaviour under load / crash:** WinFsp drive stuck after a hard kill. Mitigate
  with the PID file + start-up sweep; verify by killing the launcher mid-game.
- **R2 (resolved):** `videodriver.zip` is present in `E:\NextLevel\systems\Sega Video Driver`.
- **R3 Hypseus argument details** (`-usealt`, `-romdir`, `-manymouse`) are from docs and the old
  launcher, not yet proven per system. Every preset gets one real launch on the owner's PC before
  the PR (the owner runs them; the builder prepares a checklist).
- **R4 `E:\roms\Singe` is a symlink to `R:\singe`:** ROM location and scanning must follow it (they
  likely already do; verify).

## 6. Left to the builder

- Exact schema for the mount field and entry rules (within §4.3 limits), token names, i18n keys.
- Drive-letter preference list; bounded wait times (suggest ≤ 10 s mount, ≤ 5 s unmount).
- Test seams: the mount tool behind an interface like `Extractor`, so unit tests use a fake
  (temp folder as "drive"); one integration test may use the real tool when present (skipped in CI).
- e2e: one Library launch of a fake mounted game through the fake mounter.
- Docs: amend ADR-004 (squashfs moved before 1.0), FR-EMU-9 priority note, emulator guide section
  "Laserdisc and VHS", roadmap row, CHANGELOG.
