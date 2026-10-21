# Changelog

All notable changes are recorded here. Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/);
versions follow [SemVer](https://semver.org/) (`0.<milestone>.<patch>` until 1.0).

## [Unreleased]

### Added
- M0 foundations (NFR-MAINT-1): npm-workspaces monorepo (`apps/launcher`, `apps/api` and
  `apps/admin` stubs, `packages/shared`, `system-catalog`, `themes`, `ui`, `config`); strict
  TypeScript with project references; ESLint (incl. package boundary rules), Prettier, Vitest.
- Shared `Result`, `AppError` and the typed IPC contract with its first channel, `app.version`.
- Launcher: Electron window built with electron-vite, sandboxed renderer, typed
  `window.nextlevel` bridge, Zod-validated IPC router, i18n "Hello" screen showing the version.
- Playwright Electron smoke test and a GitHub Actions workflow on `windows-latest`.
- Project documentation: vision, requirements, user stories, roadmap, glossary, information
  architecture, screen specs, architecture, data model, API/IPC spec, coding standards, ADR-001…013,
  test strategy, release checklist, environment setup, deployment & operations, security & privacy,
  content policy, optional series plan, CLAUDE.md / AGENTS.md.

### Changed
- Node 24 LTS is the baseline (was 22) for the launcher tooling and the API.
