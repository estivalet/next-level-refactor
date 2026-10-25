# @nextlevel/api

The backend shared by the launcher and the admin console (ADR-007): Fastify 5 with Zod schemas,
Drizzle over SQLite, run by Node 24 straight from TypeScript (type stripping, so this package uses
erasable syntax only: no enums, parameter properties or namespaces).

## Run

1. Copy `.env.example` to `.env` and set `JWT_SECRET` (the file says how to make one).
2. `npm run dev -w apps/api` (or `npm run dev` at the root for API + admin + launcher).
3. `GET http://localhost:4000/v1/health` → `{ "status": "ok", … }`; the OpenAPI document is at
   `/v1/openapi.json`.

The database file (`DATABASE_URL`, default `./data/nextlevel.db`) is created and migrated at
start. After changing `src/db/schema.ts`, run `npm run db:generate -w apps/api`, format the
generated files with Prettier, and commit them.

`AUTH_STUB=1` replaces Google with a local persona picker for development and tests; see
`docs/05-operations/environment-setup.md`.

## Test

`npx vitest run apps/api`. Route tests use Fastify `inject` on a temp SQLite file
(`test/testApp.ts`); nothing touches the network.
