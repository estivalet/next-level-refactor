# CLAUDE.md — NextLevel

Instructions for AI coding agents working in this repository. Product requirements and design
live in `docs/`; this file explains how to work with them. When this file and a doc disagree,
the doc wins; flag the conflict.

## What this is

A monorepo for a retro gaming launcher service:

- `apps/launcher`: Electron + React desktop launcher (Windows)
- `apps/admin`: React admin console (web)
- `apps/api`: Fastify + Drizzle + SQLite backend
- `packages/shared`: Zod schemas and types (settings, IPC contract, API contract, errors)
- `packages/system-catalog`: system definitions and emulator presets
- `packages/themes`: themes engine + themes (no Node/Electron imports)
- `packages/ui`: shared React primitives

## Before writing code

1. Find the requirement (`FR-…`/`NFR-…` in `docs/01-product/02-product-requirements.md`) and the
   story (`US-…` in `docs/01-product/03-user-stories.md`) you are implementing. If none exists,
   stop and ask; don't invent scope.
2. Read the relevant sections of `docs/03-architecture/05-architecture.md`,
   `docs/03-architecture/data-model.md` and `docs/03-architecture/api-spec.md`.
3. Check `docs/03-architecture/adr/` before choosing a library or pattern. Don't contradict an
   accepted ADR; propose a new ADR instead.

## The NextLevelOS reference

`../NextLevelOS` (`c:\lestivalet\NextLevelOS`) is the current app. The owner still uses and
develops it, so it changes independently of this repo.

- **Read-only from here.** Never edit, format, commit to, or run write scripts in it from a
  session working on this repo. Reading, searching and running its tests read-only is fine.
- **Port, don't copy wholesale.** Bring over a file only when the milestone that needs it starts,
  together with its tests, rewritten to this repo's structure and standards (TypeScript ESM,
  `ThemeHost` instead of `/data/*.json` fetches, typed IPC instead of `window.electronAPI`).
  What to port vs. use as reference vs. leave behind is in
  `docs/00-reference/current-nextlevelos.md`.
- **Read the live code, not the snapshot.** The reference doc describes it as of 2026-10-20; check
  the current files before porting.
- **No runtime dependency.** Nothing here may import, read at runtime, or build from
  `../NextLevelOS`. Seed data (e.g. system IDs from `launchers.json` / `screenscraper.json`) is
  copied into this repo through a script and committed.
- Note the source in the commit when porting: `ported from NextLevelOS src/themes/engine/navReducer.ts @ <commit>`.

## Rules

- **Contracts first.** Any new data crossing a boundary (file, IPC, HTTP) gets a Zod schema in
  `packages/shared` before the code that uses it.
- **No hand-edited config.** Every new option needs a schema default, a Settings UI field and
  validation. Never tell the user to edit a JSON file.
- **Tests with logic.** Write the failing test first for pure logic, services and API routes;
  name tests with the requirement/story ID. Never commit failing or skipped tests.
- **Respect boundaries.** `packages/*` never import from `apps/*`. `packages/themes` and
  `packages/ui` never import Node or Electron. The renderer only talks to main through the typed
  bridge (`window.nextlevel`).
- **Spawn safely.** Emulators are launched with argv arrays and `shell: false`. Never build
  command strings.
- **Write safely.** Use the atomic-write helper for files; use transactions for multi-row DB changes.
- **Authorization is server-side.** Every API route declares its role; catalog routes check scopes.
- **No commercial ROMs, BIOS files or links to them** in code, tests, fixtures, docs or examples.
- **No secrets** in code, tests, logs or commit history.
- Keep files small (see `docs/03-architecture/coding-standards.md`): split anything over 400 lines.
- All user-visible strings go through i18n (`t('…')`).

## Commands

| Command | Use |
|---|---|
| `npm run dev` | run everything |
| `npm run lint` · `npm run typecheck` · `npm test` | must pass before you say you're done |
| `npm run test:e2e` | when you touched flows covered by Playwright |
| `npm run db:generate -w apps/api` | after changing API DB schema; commit the migration |

## Definition of done

- [ ] Lint, typecheck and tests pass (show the output)
- [ ] Requirement/story IDs referenced in tests and the PR description
- [ ] Docs updated in the same change: data model, API spec, screen spec, ADR, roadmap status, `CHANGELOG.md` (Unreleased)
- [ ] No new `any`, no disabled lint rules without a comment explaining why

## Commit style

Conventional Commits with scopes `launcher`, `api`, `admin`, `themes`, `shared`, `catalog`,
`docs`, `ci` — e.g. `feat(launcher): add emulator test launch (FR-EMU-5)`.
