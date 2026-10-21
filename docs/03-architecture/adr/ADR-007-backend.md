# ADR-007: Fastify + Drizzle + SQLite backend, Postgres-ready

- **Status:** Accepted
- **Date:** 2026-10-20 (amended 2026-10-21: Node 22 → 24 LTS, owner decision)

## Context
The owner wants to start with a local backend and a simple database. Traffic is small (one
operator, a modest number of subscribers). Sharing TypeScript types with the launcher is valuable.

## Decision
Node 24 LTS + Fastify with a Zod type provider; Drizzle ORM over SQLite (`better-sqlite3`) with
versioned migrations. File storage behind a `FileStore` interface (`LocalDiskStore` → `S3Store`).
Runs locally in development and as one Docker container in production.

## Consequences
- No external services needed until billing and public downloads.
- Moving to Postgres later is a Drizzle dialect change plus a data migration; avoid SQLite-only SQL.
- SQLite means a single API instance (fine at this scale); backups are file snapshots.

## Alternatives considered
- **Express**: familiar, but no built-in schema validation/serialization; Fastify's plugin model fits modules.
- **Supabase/Firebase**: fast start, but vendor lock-in and less to teach.
- **Postgres from day one**: more setup for no early benefit.
