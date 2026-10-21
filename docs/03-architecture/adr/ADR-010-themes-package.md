# ADR-010: Themes engine as a platform-neutral package behind a host interface

- **Status:** Accepted
- **Date:** 2026-10-20

## Context
The current themes engine is already headless (reducer, level model, input, art resolution) but
fetches `/data/*.json` and calls `window.electronAPI` directly. A future web player must reuse
the same themes.

## Decision
`packages/themes` contains the engine, shared components and the six themes. It has no Node or
Electron imports and reaches the outside world only through a `ThemeHost` interface (see
[architecture §4.4](../05-architecture.md)). The launcher provides `LauncherThemeHost` (IPC); the
web player will provide a web host.

## Consequences
- Themes are testable with a fake host and fixtures.
- Art resolution moves to the host (paths are pre-resolved from the media index), so themes
  never probe the disk.

## Alternatives considered
- **Themes inside the launcher app**: blocks reuse by the web player.
