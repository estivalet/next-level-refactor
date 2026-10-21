# Coding standards

Applies to all packages. Tooling enforces what it can (ESLint, Prettier, `tsc --strict`); this
document covers the rest. Agent-specific rules are in [CLAUDE.md](../../CLAUDE.md).

## Language & types

- TypeScript `strict: true`, plus `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`.
- No `any`. Use `unknown` + Zod parsing at boundaries (IPC input, HTTP input, files, external APIs).
- Types for persisted or transported data come from Zod schemas (`z.infer`) in `packages/shared`.
  Don't hand-write a second interface for the same shape.
- Prefer discriminated unions over optional-field soup (`{ kind: 'theme'; themeId } | { kind: 'desktop' }`).
- ES modules everywhere, including Electron main and preload (bundled by `electron-vite`).

## Naming

| Thing | Convention | Example |
|---|---|---|
| Files: React components | `PascalCase.tsx` | `GameList.tsx` |
| Files: other modules | `camelCase.ts` | `launchProfile.ts` |
| Tests | next to the file, `.test.ts(x)` | `launchProfile.test.ts` |
| Types / components | `PascalCase` | `EmulatorProfile` |
| Functions / variables | `camelCase` | `resolveProfile` |
| Constants | `UPPER_SNAKE` only for true constants | `MAX_BACKUPS` |
| IPC channels | `area.action` / `area.sub.action` | `library.games.setFlags` |
| API routes | plural nouns, kebab-case | `/v1/catalog/items/:id/downloads` |
| DB tables/columns | `snake_case` | `game_user_state.last_played_at` |
| Error codes | `UPPER_SNAKE` | `NO_PROFILE` |
| System ids | lowercase slug | `nintendo-64`, `microsoft-msx2-plus` |

## Structure

- Organize by **feature**, not by kind: `renderer/features/library/{components,hooks,api}.ts`.
- A file over **400 lines** or a component over **200 lines** needs a reason in review; split it.
  (The current `GameLibrary.tsx` is 2,445 lines — the rebuild must not repeat that.)
- Pure logic (resolution, parsing, reducers, token rendering) lives in plain functions with no
  React, Electron or I/O imports, so it is trivially unit-tested.
- Services receive dependencies via constructor (`new LaunchService({ spawn, fs, clock, settings, library })`).
- No module-level mutable state except explicit caches with an invalidation function.

## Errors

- Expected failures return `Result<T>`; exceptions are for bugs.
- Every `AppError.code` is listed in `packages/shared/src/errors.ts` with a user-facing message key.
- Never swallow errors: log with context (`log.warn({ gameId, code }, 'launch failed')`) and surface to UI.
- UI messages say what happened and what to do; link to the setting that fixes it.

## React

- Function components + hooks. Server/IPC state via TanStack Query; local UI state via `useState`/`useReducer`; no global store unless shared across apps (then a small context).
- Components don't call `window.nextlevel` directly — they use feature `api.ts` hooks.
- Lists over 100 items are virtualized.
- Accessibility: semantic elements, labelled controls, visible focus ring, no click-only interactions.
- Styling: Tailwind utilities; theme-specific CSS scoped by a theme class prefix (current convention `.bigbox-*`).
- All user-visible strings via `t('key')`.

## Electron

- Renderer: `contextIsolation`, `sandbox`, no `nodeIntegration`, strict CSP.
- Never build shell command strings; always `spawn(file, argv, { shell: false })`.
- File writes are atomic (tmp + rename) and go through one helper.
- Long work (scan, hashing, extraction) runs off the main thread (worker threads).

## API

- One Fastify plugin per module; routes declare Zod schemas for params, query, body and response.
- DB access only through module repositories (Drizzle); no SQL in route handlers.
- Every admin mutation writes `audit_log` in the same transaction.
- No secrets in code or repo; config via environment variables validated at startup.

## Git

- Trunk-based: short branches `feat/…`, `fix/…`, `docs/…`, `chore/…`; squash-merge.
- Conventional Commits (`feat(launcher): add test launch`); scopes: `launcher`, `api`, `admin`, `themes`, `shared`, `catalog`, `docs`, `ci`.
- Small PRs (one story or a slice of one); PR description links the requirement and story IDs.
- Docs and CHANGELOG updated in the same PR as behavior changes.

## Comments & docs

- Comment *why*, not *what*. Public functions in `packages/*` get a one-line TSDoc.
- Each package has a short `README.md`: purpose, public API, how to test.
