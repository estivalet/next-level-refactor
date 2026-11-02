# Laserdisc and VHS games

How the launcher runs the Laserdisc and VHS systems: Daphne, Singe (including the American Laser
Games titles), WoW Action Max, Mattel Captain Power, Sega Video Driver, Pioneer LaserActive and
VM Labs Nuon. Requirement FR-EMU-9; design `docs/superpowers/specs/2026-11-01-laserdisc-hypseus-design.md`.

## What you need

1. **Hypseus Singe** in the emulators folder (`<NextLevel>\emulators\hypseus_singe\hypseus.exe`).
   Settings → Emulators → *Find emulators in a folder…* (or Import NextLevelOS) adds it with its
   two profiles.
2. **WinFsp** installed (the installer is in `E:\NextLevel\tools\winfsp-*.msi`). It lets
   Windows show a game image as a drive.
3. **mountsquashfs.exe** (from RetroBat) in `<NextLevel>\tools\`. The launcher also looks in the
   `tools` folder next to the emulators folder; to use another copy, choose it under
   Settings → Emulators → *squashfs mount tool*. It is not shipped with the launcher.
4. For the script systems, nothing: the **Script (.bat/.cmd)** preset runs Windows' own
   `cmd.exe`, which *Find emulators in a folder…* adds.

After adding them, scan those systems (Game Library → *Scan for games*) so the new file types are
found. The "Laserdisc and VHS" menu group shows once its systems have games.

## Which profile runs what

| System | Games are | Profile |
|---|---|---|
| Daphne | `<game>.wsquashfs` images (holding `<game>.txt`, `<game>.commands`, video) | Hypseus (Daphne) |
| Singe | `<game>.wsquashfs` images, or `<game>.hypseus` folders | Hypseus Singe |
| WoW Action Max | `<game>.txt` + `<game>.singe` next to `actionmax.zip` | Hypseus Singe |
| Mattel Captain Power | `<game>.txt` next to `captainpower.zip` | Hypseus Singe |
| Sega Video Driver | `<game>.txt` next to `videodriver.zip` | Hypseus Singe |
| Pioneer LaserActive | `Hyperion.bat` | Script (.bat/.cmd) |
| VM Labs Nuon | `<game>.bat` | Script (.bat/.cmd) |

American Laser Games titles are Singe games (their files are in the Singe folder). In NextLevelOS
they were a collection; if the import made "American Laser Games" a system of its own, its
entries point at a folder without the games: add the Singe titles to an *American Laser Games*
collection instead (Game Library → select → *Add to collection…*).

## How a game starts

1. **Mount** (images only). The image is mounted as a drive (the first free letter from Z down).
   Anything the game writes — high scores, settings — goes to
   `<NextLevel>\data\squashfs-overlay\<system>\<game>\`, so it is kept, and the image and its
   folder are never changed.
2. **Find the game's files** by name, in the mounted drive, the `.hypseus` folder, or the game's
   folder (`{gameDir}`). The Hypseus Singe profile tries, in order:
   - `<game>.singe` → `-script <file>`
   - `<game>.zip` → `-zlua <file>`
   - any `*.zip` (the system's shared Lua zip) → `-zlua <file> -usealt <game>`

   Daphne reads `<game>.commands`, when present, as extra arguments.
3. **Run** Hypseus (`singe vldp -framefile <game>.txt … -fullscreen -opengl`, or for Daphne
   `<game> vldp -framefile <game>.txt … -fastboot -force_aspect_ratio`).
4. **Unmount** when the game ends, also when it fails to start. If the launcher itself was closed
   while a game was mounted, the next start releases the drive.

## Changing it

Everything above is an ordinary profile in Settings → Emulators: the arguments, the *squashfs
images* choice (pass or mount), the *Game files* rules (first file that exists wins; `*` matches
any characters; `{entry}` is the file found) and the *Arguments file*. The preview and *Test
launch* show the exact command; a mounted game shows its drive as `X:` in the preview.

Per-game options go in the game's *Launch options…* → *Extra arguments*, e.g. `-manymouse` for a
light-gun game; they are added at the end, after Hypseus' own arguments.

## When something goes wrong

| Message | What to do |
|---|---|
| The squashfs mount tool (mountsquashfs.exe) was not found | Put it in `<NextLevel>\tools\` or choose it in Settings → Emulators. |
| The game image could not be mounted | Install WinFsp; the tool's own message is shown under it. |
| The game's files were not found. Looked for: … | The image or folder lacks the files the rules name; check the game's files or edit the rules. |

## Pong (Coleco Telstar)

The same Script emulator runs the Pong group: Coleco Telstar and its models Alpha, Classic,
Colormatic, Colortron, Deluxe, Marksman, Ranger, Regent and Sportsman.

- **Games are folders.** Each game (`Tennis`, `Hockey`, `Jai-Alai`…) is a folder in the system
  folder holding its own set-up copy of WinArcadia (`wa.exe`). A scan lists exactly those
  folders; loose files (`*.COS`, `*.zip`, the old `.bat` files) and `_` folders are skipped.
- **Profile:** *WinArcadia (game folder)* runs `cmd.exe /d /s /c wa.exe` with the game folder as
  the working folder; quitting WinArcadia returns to the launcher.
- **Set-up:** *Find emulators in a folder…* adds the Script emulator with this profile. If Script
  is already set up, use its card's *Add from preset* and tick *WinArcadia (game folder)*. Then
  scan the Pong systems.
- The `handball.bat`, `hockey.bat` and `tennis.bat` files from NextLevelOS are not used: they
  change to a `c:\emudreams\…` folder that no longer exists. Entex Gameroom Tele-Pong has no game
  folders yet.
