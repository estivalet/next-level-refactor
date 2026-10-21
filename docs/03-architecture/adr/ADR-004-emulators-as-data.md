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

## Consequences
- Adding an emulator needs no code; Test launch gives immediate feedback.
- Some per-system quirks from the runner must be re-expressed as presets; the importer reports
  any it cannot map.
- No more quoting bugs: arguments are never joined into one string.

## Alternatives considered
- **Keep the Python runner**: keeps the core problem.
- **Free-form command strings**: flexible but untestable, and the source of current quoting bugs.
