# Architecture decision records

One file per decision: `ADR-NNN-short-title.md`. ADRs are never edited after acceptance except
to change **Status** to `Superseded by ADR-XXX`; write a new ADR instead.

| ADR | Decision | Status |
|---|---|---|
| [001](ADR-001-monorepo.md) | Monorepo with npm workspaces | Accepted |
| [002](ADR-002-keep-current-stack.md) | Keep React, TypeScript, Vite, Electron, Tailwind | Accepted |
| [003](ADR-003-local-storage.md) | Library in SQLite, settings in a validated JSON file | Accepted |
| [004](ADR-004-emulators-as-data.md) | Emulators and launch profiles are data; one TypeScript launch service | Accepted |
| [005](ADR-005-zod-contracts.md) | Zod schemas are the single source for settings, IPC and API contracts | Accepted |
| [006](ADR-006-google-sign-in.md) | Google sign-in via system browser + PKCE; API issues its own tokens | Accepted |
| [007](ADR-007-backend.md) | Fastify + Drizzle + SQLite backend, Postgres-ready | Accepted |
| [008](ADR-008-admin-console.md) | Separate admin web console; roles enforced by the API | Accepted |
| [009](ADR-009-stripe.md) | Stripe hosted Checkout/Portal for billing | Accepted |
| [010](ADR-010-themes-package.md) | Themes engine as a platform-neutral package behind a host interface | Accepted |
| [011](ADR-011-stable-ids.md) | Stable slug IDs for systems | Accepted |
| [012](ADR-012-rights-cleared-catalog.md) | The catalog holds rights-cleared content only | Accepted |
| [013](ADR-013-single-runtime.md) | One runtime: drop Python, port the scraper to TypeScript | Accepted |
| [014](ADR-014-bundled-7zip.md) | Bundle 7-Zip for archive extraction at launch | Accepted |

## Template

```markdown
# ADR-NNN: Title

- **Status:** Proposed | Accepted | Superseded by ADR-XXX
- **Date:** YYYY-MM-DD

## Context
What forces are at play; what problem we're solving.

## Decision
What we will do.

## Consequences
What gets easier, what gets harder, what we must now do.

## Alternatives considered
Option — why not.
```
