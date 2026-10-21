# Test strategy & test plan

## 1. Principles

- **Test behavior, not implementation.** Tests are written against requirements (`FR-…`) and
  acceptance criteria (`US-…`); test names reference them: `it('US-D1: rejects unknown token {romm}')`.
- **Pure logic first.** Resolution, template rendering, parsing, reducers, migrations and
  entitlement rules are pure functions with exhaustive unit tests. Most bugs in this domain live there.
- **Fakes at boundaries.** Services take injected `fs`, `spawn`, `clock`, `http`; tests use fakes,
  not mocks of internals.
- **TDD for logic, test-after allowed for layout.** Visual details of themes are checked by
  screenshot tests and manual review, not by asserting class names.

## 2. Test levels

| Level | Tool | Scope | Runs |
|---|---|---|---|
| Unit | Vitest | Pure functions, reducers, schemas, services with fakes | every commit (CI) |
| Component | Vitest + Testing Library (jsdom) | React components and hooks: forms, lists, theme views with a fake `ThemeHost` | every commit |
| Integration (launcher main) | Vitest (node) | Services against a real temp SQLite DB and temp folders: scan, import, launch (spawning a fake emulator script), settings save/backup/migrate | every commit |
| Integration (API) | Vitest + Fastify `inject` | Routes with a real SQLite file, fake Google/Stripe clients | every commit |
| Contract | Vitest | Every IPC channel and API route has schema round-trip tests; OpenAPI snapshot | every commit |
| End-to-end launcher | Playwright (`_electron`) | Boot routing, first-run wizard, browse with keyboard, launch fake emulator, settings save | PR to main + nightly |
| End-to-end admin | Playwright | Sign-in (stubbed OAuth), create/publish item, grant comp | PR to main |
| Visual | Playwright screenshots | One screenshot per theme per level with fixture data | PR to main (diff reviewed) |
| Performance | Vitest bench + script | NFR-PERF targets with a generated 200k-game library | weekly + before release |
| Manual | Checklist | Real emulators, real gamepads, real Google/Stripe test mode, installer | before release |

Coverage target: **90% lines** for `packages/shared`, `packages/themes/engine`, launcher services
and API modules; no target for presentational components.

## 3. Test data

| Fixture | Contents | Used by |
|---|---|---|
| `fixtures/library-small` | 3 systems, 30 games, media files, 2 collections, 1 menu | unit/component/e2e |
| `fixtures/library-200k` | Generator script (not committed data) producing 440 systems / 200k games | perf |
| `fixtures/nextlevelos-legacy` | Trimmed copy of current `public/data` (config, launchers, 2 menus, 5 gamelists incl. typos like `disply`, a collection, themes, screenscraper) | importer |
| `fixtures/fake-emulator` | Node script that records its argv/cwd to a file and exits with a chosen code | launch tests, e2e |
| `fixtures/catalog` | 5 items with license records, small homebrew ROM files with known SHA-256 | catalog/download tests |
| Fake OAuth | Local stub issuing deterministic codes/ID tokens | API + e2e |
| Stripe | Stripe CLI test mode + recorded webhook payloads | billing integration |

No commercial ROMs are ever committed or used in tests. ROM fixtures are homebrew/public-domain
or zero-filled dummy files.

## 4. Critical scenarios (must never regress)

| # | Scenario | Refs |
|---|---|---|
| C1 | Settings save is atomic; corrupt file → restore backup offered; never silently overwritten | FR-SET-2/3, NFR-REL-1 |
| C2 | Launch builds the exact argv for each preset (snapshot per preset) and never uses a shell | FR-EMU-3/7, ADR-004 |
| C3 | Storage priority picks the right copy when a game exists on two locations | FR-LIB-1 |
| C4 | Scan never deletes data; disconnected drive marks games missing, reconnect restores them (`ScanService.test.ts`, `e2e/scan.spec.ts`) | FR-LIB-4 |
| C5 | Import of the legacy fixture is idempotent and matches expected counts | FR-IMP-1/2 |
| C6 | Entitlement + grace: online/offline/expired/suspended/admin matrix | FR-AUTH-3/5/7 |
| C7 | Refresh-token rotation and reuse detection | ADR-006 |
| C8 | Catalog scope filtering: a user never sees or downloads out-of-plan items | FR-CAT-1/6 |
| C9 | Download checksum mismatch deletes the file and reports | FR-CAT-3 |
| C10 | Publishing without a license is impossible (API and UI) | FR-CAT-8, ADR-012 |
| C11 | Admin mutation without an audit entry fails the transaction | FR-ADM-5 |
| C12 | `nextlevel://` serves only resolved library/settings paths; traversal attempts get 404 | NFR-SEC-1 |
| C13 | Every theme is fully navigable with the gamepad mapping | FR-THM-3 |
| C14 | Webhook replay is idempotent | FR-SUB-3 |

## 5. Environments

| Env | Launcher | API | Google | Stripe | Storage |
|---|---|---|---|---|---|
| Local dev | `npm run dev` | local, SQLite file | real test OAuth client or stub | off (FR-SUB-5) or test mode | `LocalDiskStore` |
| CI | headless Electron (xvfb not needed on Windows runner) | in-process | stub | recorded payloads | temp dir |
| Staging | signed build, `beta` channel | Docker on VPS, `staging` DB | test OAuth client | test mode | R2 bucket `staging` |
| Production | signed build, `stable` channel | Docker on VPS | production client | live | R2 bucket `prod` |

## 6. Release criteria

A release ships only when the [release checklist](release-checklist.md) passes: CI green, all
critical scenarios green, perf targets met on the reference PC, manual checklist done, no open
bugs labelled `severity:critical` or `severity:high`.

## 7. Bug handling

Every bug fix starts with a failing test that reproduces it (labelled with the issue number).
Severity: **critical** (data loss, security, cannot launch any game) → fix before anything else;
**high** (feature broken, no workaround); **medium** (workaround exists); **low** (cosmetic).
