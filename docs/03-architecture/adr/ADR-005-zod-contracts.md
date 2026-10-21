# ADR-005: Zod schemas are the single source for settings, IPC and API contracts

- **Status:** Accepted
- **Date:** 2026-10-20

## Context
The current IPC surface grew method by method (`window.electronAPI?.x`) with hand-written types
and `any` props; config files have no schema, so typos such as `"disply"` survive.

## Decision
All data crossing a boundary has a Zod schema in `packages/shared`: settings, system catalog,
IPC channel inputs/outputs, HTTP bodies/responses. Types are inferred from schemas. Settings
forms read labels/help/defaults from schema metadata. OpenAPI is generated from the API schemas.

## Consequences
- One change updates validation, types, forms and docs together.
- Runtime validation cost at boundaries (negligible at our volumes).
- Schemas must stay readable: split per domain, no clever generics.

## Alternatives considered
- **TypeScript types only**: no runtime validation of files or untrusted input.
- **JSON Schema + codegen**: more tooling for the same result.
