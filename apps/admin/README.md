# @nextlevel/admin

The operator's web console (ADR-008, S13): users, settings and the audit log since M7; plans,
catalog content and the dashboard come later. Vite + React + TanStack Query, `packages/ui`
primitives, English and pt-BR (`packages/shared/src/i18n/admin.*.json`).

- `npm run dev -w apps/admin` — Vite on http://localhost:5174, `/v1` proxied to the API on :4000
  (start it with `npm run dev -w apps/api`, or everything with `npm run dev`). Set
  `ADMIN_ORIGIN=http://localhost:5174` in `apps/api/.env` so sign-in returns here.
- `npm run build -w apps/admin` — static files in `dist/`; the API serves them with
  `ADMIN_DIST=../admin/dist`.
- Tests: `npx vitest run apps/admin`; end to end `npm run test:e2e -w apps/admin` (builds, then
  runs the real API with the sign-in stub on a temp database; needs `npx playwright install chromium` once).
