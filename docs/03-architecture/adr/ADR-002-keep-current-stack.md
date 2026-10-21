# ADR-002: Keep React, TypeScript, Vite, Electron, Tailwind

- **Status:** Accepted
- **Date:** 2026-10-20

## Context
The current app's problems are structural (config model, runner, component size), not caused by
the stack. The owner knows the stack, and the rebuild is about structure, not tool churn.

## Decision
Keep React 19, TypeScript, Vite, Electron, Tailwind 4, Motion, Lucide, TanStack Virtual. Add:
`electron-vite` (one build for main/preload/renderer, TS + ESM in main), Zod, TanStack Query,
`better-sqlite3` + Drizzle, i18next, Playwright. Remove from the launcher: Express,
`@google/genai`, `dotenv`.

## Consequences
- The existing themes engine and its tests port with modest changes.
- Electron's footprint stays (~150 MB installer); acceptable for a desktop front-end.
- The native module (`better-sqlite3`) must be rebuilt for Electron during packaging.

## Alternatives considered
- **Tauri**: smaller binaries, but Rust in the main process, a rewrite of all main-process code, and WebView2 differences in video/media handling.
- **Hand-rolled Vite + Electron build**: more config to maintain than `electron-vite`.
