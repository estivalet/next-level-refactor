# ADR-014: Bundle 7-Zip for archive extraction at launch

- **Status:** Accepted
- **Date:** 2026-10-21 (owner decision D3 in the M3 plan)

## Context
FR-EMU-8: when a profile can't read `.zip`/`.7z` files, the launcher extracts the archive to a
temp folder, launches the extracted file, and deletes the folder after the emulator exits. Node
has no built-in zip or 7z extraction. Many standalone emulators (Dolphin, PCSX2, DuckStation,
PPSSPP, Cemu, …) can't open archives.

## Decision
Use the `7zip-bin` package (MIT wrapper), which ships `7za.exe` (7-Zip, LGPL-2.1, unmodified). The
launch service runs it as a separate process with an argv array and `shell: false`
(`x -y -o<dest> <archive>`), like any other spawned program. It handles both `.zip` and `.7z`.

## Consequences
- One small dependency covers both formats; extraction runs outside the main process's event loop.
- The installer (M10) must ship `7za.exe` outside the asar archive (`asarUnpack` for
  `node_modules/7zip-bin/win/x64/7za.exe`) and list 7-Zip's LGPL notice in the licenses screen.
- Extraction needs free temp space up to the archive's uncompressed size. Start-up removes leftovers
  of launches the launcher never saw end.
- `7zip-bin` 5.2.0 ships 7za **21.07**, older than the 7-Zip fixes for CVE-2025-11001/11002
  (path traversal through symbolic links in crafted archives, fixed in 7-Zip 25.00). The risk here
  is low (the user's own archives, extracted into a fresh temp folder), but before the installer
  ships (M10) we update to a 7za ≥ 25.00 build or bundle one ourselves and note its version in the
  licenses screen.

## Alternatives considered
- **Pure-JS zip (`yauzl`) and pass `.7z` through:** no binary, but `.7z` games would fail with
  emulators that can't read them.
- **Defer FR-EMU-8:** it's priority S, but archive sets are common in the owner's library.
