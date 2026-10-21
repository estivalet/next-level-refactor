# ADR-001: Monorepo with npm workspaces

- **Status:** Accepted
- **Date:** 2026-10-20

## Context
Launcher, admin console, API and (later) web player share types, validation schemas, the system
catalog, UI primitives and the themes engine. Separate repos would mean publishing packages for
every change.

## Decision
One repository with npm workspaces: `apps/*` and `packages/*`. TypeScript project references for
fast type-checking. No build orchestrator (Turborepo/Nx) until build times demand it.

## Consequences
- One PR can change a contract and both sides of it.
- CI runs per-workspace scripts; `packages/*` must stay free of app imports (lint rule).
- npm is what the owner already uses; fewer new tools to learn.

## Alternatives considered
- **pnpm workspaces**: faster and stricter, but another tool to explain; revisit if installs get slow.
- **Separate repos**: versioning overhead for a single developer.
