# ADR-004: Emulators and launch profiles are data; one TypeScript launch service

- **Status:** Accepted
- **Date:** 2026-10-20

## Context
Today `launchers.json` points every system at `nextlevel-launcher.exe`, a 3,500-line Python
script compiled with PyInstaller, holding hard-coded emulator paths per drive letter and
per-system argument functions. Changing an emulator means editing Python and rebuilding an exe.

## Decision
- Emulators (executables) and **profiles** (argv templates with a fixed token set, cwd, env, core,
  archive handling) are stored in settings and edited in the Settings app.
- Presets for common emulators ship in `packages/system-catalog`.
- One `LaunchService` resolves the profile, renders the argv array, pre-flights and spawns
  **without a shell**.
- Special flows (squashfs/WSL mounting) become optional **hooks** after 1.0.
  *Amended 2026-11-01:* squashfs mounting moved before 1.0 for the Laserdisc and VHS systems, as
  profile data rather than a hook: `squashfs: 'mount'` mounts a `.wsquashfs` with the WinFsp tool
  (`mountsquashfs.exe`, not bundled) for the length of the game; `entries` and `argsFile` find the
  game's files by name. WSL mounting is dropped. `.bat`/`.cmd` games run through the Script
  preset (`cmd.exe` with verbatim arguments) — the only program that gets a command line instead
  of Node's argv quoting. See `docs/superpowers/specs/2026-11-01-laserdisc-hypseus-design.md`.
  *Amended 2026-11-02:* `pointerExtensions` (profile data, not a hook) follows Xbox 360 `.m3u` and
  XBLA `.xbox360` pointer files: their first line names the game file inside the system folder,
  which is launched as `{rom}` (NextLevelOS's runner did the same in `_resolve_m3u`).

## Consequences
- Adding an emulator needs no code; Test launch gives immediate feedback.
- Some per-system quirks from the runner must be re-expressed as presets; the importer reports
  any it cannot map.
- No more quoting bugs: arguments are never joined into one string.

## Alternatives considered
- **Keep the Python runner**: keeps the core problem.
- **Free-form command strings**: flexible but untestable, and the source of current quoting bugs.
