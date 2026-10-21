# API & IPC specification

Two contracts, both defined as Zod schemas in `packages/shared` and documented here:

1. **HTTP API** (`apps/api`), used by the launcher, the admin console and later the web player.
   An OpenAPI 3.1 document is generated from the schemas at `GET /v1/openapi.json`; this page is
   the human summary.
2. **IPC contract** between launcher renderer and main process.

Entity shapes are defined in [data-model.md](data-model.md).

---

## 1. HTTP API conventions

- Base path `/v1`. JSON only (`Content-Type: application/json`), UTF-8.
- **Auth:** launcher → `Authorization: Bearer <accessToken>` (JWT, 15 min). Admin console →
  httpOnly `nl_session` cookie. Webhooks → provider signature.
- **IDs** are strings. **Timestamps** ISO-8601 UTC.
- **Pagination:** `?cursor=<opaque>&limit=<1..100>` → `{ items: [...], nextCursor: string | null }`.
- **Errors:** HTTP status + envelope:

```json
{ "error": { "code": "SUBSCRIPTION_REQUIRED", "message": "An active subscription is required.", "requestId": "01J…", "details": {} } }
```

| Code | HTTP | Meaning |
|---|---|---|
| `VALIDATION_FAILED` | 400 | Body/query failed schema; `details.issues[]` |
| `UNAUTHENTICATED` | 401 | Missing/expired token |
| `FORBIDDEN` | 403 | Role not allowed |
| `SUBSCRIPTION_REQUIRED` | 403 | No active/grace subscription |
| `SUSPENDED` | 403 | User suspended |
| `DEVICE_LIMIT` | 409 | Plan device limit reached; `details.devices[]` |
| `NOT_FOUND` | 404 | |
| `CONFLICT` | 409 | Revision mismatch (sync, admin edits) |
| `RATE_LIMITED` | 429 | `Retry-After` header set |
| `INTERNAL` | 500 | Logged with `requestId` |

## 2. Endpoints

### Auth

| Method & path | Who | Body → Response |
|---|---|---|
| `POST /v1/auth/google/exchange` | launcher | `{ code, codeVerifier, redirectUri, device: { id?, name, platform, appVersion } }` → `{ accessToken, refreshToken, deviceId, entitlement }` |
| `POST /v1/auth/refresh` | launcher | `{ refreshToken, deviceId }` → `{ accessToken, refreshToken }` (rotated; reuse revokes the device) |
| `POST /v1/auth/logout` | launcher | `{ refreshToken }` → `204` |
| `GET /v1/auth/google/start` | admin (browser) | → `302` to Google with state cookie |
| `GET /v1/auth/google/callback` | admin (browser) | → sets `nl_session`, `302 /` (admins only; others get an error page) |
| `POST /v1/auth/session/logout` | admin | → clears cookie |

### Me

| Method & path | Body → Response |
|---|---|
| `GET /v1/me` | → `{ user, entitlement }` |
| `GET /v1/me/entitlement` | → `Entitlement` (launcher polls hourly and after checkout) |
| `GET /v1/me/devices` | → `Device[]` |
| `DELETE /v1/me/devices/:id` | → `204` |
| `POST /v1/me/billing/checkout` | `{ planSlug, interval: 'month'|'year' }` → `{ url }` (Stripe Checkout) |
| `POST /v1/me/billing/portal` | → `{ url }` (Stripe Customer Portal) |
| `GET /v1/plans` | → public plan list (name, prices, device limit, scope names) |

### Catalog (subscriber; filtered by entitlement scopes)

| Method & path | Body → Response |
|---|---|
| `GET /v1/catalog/items?system=&q=&scope=&cursor=&limit=` | → page of `CatalogItemSummary` |
| `GET /v1/catalog/items/:id` | → `CatalogItem` (metadata, files with size+sha256, media URLs, license summary, `version`) |
| `POST /v1/catalog/items/:id/downloads` | `{ deviceId }` → `{ files: [{ fileId, filename, size, sha256, url, expiresAt }] }` |
| `GET /v1/catalog/changes?since=<ISO>` | → `{ updated: id[], removed: [{ id, onLapse }] }` (launcher sync of installed items) |

### Sync (M10)

| Method & path | Body → Response |
|---|---|
| `GET /v1/sync/:kind` | → `{ revision, data, updatedAt }` |
| `PUT /v1/sync/:kind` | `{ baseRevision, data }` → `{ revision }` or `409 CONFLICT` with server copy |

### Admin (role `admin`; every mutation writes `audit_log`)

| Method & path | Purpose |
|---|---|
| `GET /v1/admin/users?q=&status=&plan=` · `GET /v1/admin/users/:id` | List / detail |
| `PATCH /v1/admin/users/:id` | `{ role?, status?, suspendedReason? }` |
| `POST /v1/admin/users/:id/grants` | `{ planSlug, expiresAt, note }` complimentary subscription |
| `DELETE /v1/admin/users/:id/devices/:deviceId` | Revoke device |
| `GET/POST /v1/admin/plans` · `PATCH /v1/admin/plans/:id` | Plans |
| `GET/POST /v1/admin/scopes` · `PATCH /v1/admin/scopes/:id` | Catalog scopes |
| `GET/POST /v1/admin/catalog/items` · `GET/PATCH /v1/admin/catalog/items/:id` | Items |
| `POST /v1/admin/catalog/items/:id/files` | Start upload → `{ uploadUrl, fileId }`; `POST …/files/:fileId/complete` verifies size + sha256 |
| `POST /v1/admin/catalog/items/:id/media` | Upload art (same pattern) |
| `PUT /v1/admin/catalog/items/:id/license` | Attach/replace license record |
| `POST /v1/admin/catalog/items/:id/publish` · `…/unpublish` | Publish requires license + ≥1 file |
| `GET /v1/admin/audit?actor=&target=&cursor=` | Audit log |
| `GET/PATCH /v1/admin/settings` | Grace days, sign-up mode, allow-list, banner |
| `GET /v1/admin/stats` | Dashboard numbers |

### Webhooks & health

| Method & path | Notes |
|---|---|
| `POST /v1/webhooks/stripe` | Raw body, signature verified; idempotent via `stripe_events`; handles `checkout.session.completed`, `customer.subscription.created/updated/deleted`, `invoice.payment_failed` |
| `GET /v1/health` | `{ status: 'ok', version, db: 'ok' }` — no auth |
| `GET /v1/files/:token` | Dev only (`LocalDiskStore`): HMAC-signed download, supports Range |

### Rate limits (defaults)

Auth endpoints 10/min/IP; download URL issue 60/hour/user; everything else 300/min/user.

---

## 3. IPC contract (launcher)

Defined once in `packages/shared/src/ipc/contract.ts`:

```ts
export const ipcContract = {
  'settings.get':      { input: z.void(),                      output: SettingsSchema },
  'settings.save':     { input: z.object({ settings: SettingsSchema, baseRevision: z.number() }), output: SaveResultSchema },
  // …
} as const;
```

The preload exposes `window.nextlevel.invoke(channel, input)` typed from this object; the main
process router registers one handler per key and validates `input`. All calls return
`Result<T>` = `{ ok: true, value: T } | { ok: false, error: AppError }`.
Input that fails the schema returns `VALIDATION_FAILED` (with the Zod issues in `details`); a
handler that throws, or returns data that breaks the output schema, returns `INTERNAL` and is
logged in main. Codes and their message keys live in `packages/shared/src/errors.ts`.

| Area | Channels |
|---|---|
| Settings | `settings.get`, `settings.save`, `settings.validate`, `settings.backups.list`, `settings.backups.restore`, `settings.export`, `settings.import` |
| Systems | `systems.catalog` (definitions + presets), `systems.list` (merged with settings + game counts) |
| Library | `library.menu.get`, `library.games.list` (node + query + paging), `library.games.get`, `library.games.updateMetadata`, `library.games.setFlags`, `library.games.setLaunchOverride`, `library.search` |
| Collections | `collections.list`, `collections.get`, `collections.create`, `collections.update`, `collections.delete`, `collections.addGames`, `collections.removeGames`, `collections.reorder` |
| Menus | `menus.list`, `menus.get`, `menus.save` (whole tree + base revision), `menus.create`, `menus.delete`, `menus.setActive` |
| Scan | `scan.start` (systems?), `scan.cancel`, `scan.status` |
| Launch | `launch.game`, `launch.test` (profile + game → command + result), `launch.preview` (rendered argv, no spawn), `launch.log` |
| Emulators | `emulators.detect` (search common folders for preset executables) |
| Scraper | `scraper.search`, `scraper.preview`, `scraper.apply`, `scraper.batch.start`, `scraper.batch.cancel`, `scraper.credentials.set` |
| Catalog | `catalog.list`, `catalog.get`, `catalog.install`, `catalog.uninstall`, `downloads.list`, `downloads.pause`, `downloads.resume`, `downloads.cancel` |
| Auth | `auth.state`, `auth.signIn`, `auth.cancelSignIn`, `auth.signOut`, `auth.refreshEntitlement`, `auth.openCheckout`, `auth.openPortal` |
| Import | `import.nextlevelos.dryRun`, `import.nextlevelos.run` |
| System | `app.paths`, `app.openPath`, `app.pickFolder`, `app.pickFile`, `app.version`, `app.quit`, `app.setKioskUnlocked` |

**Events (main → renderer):** `settings.changed`, `scan.progress`, `scan.finished`,
`launch.started`, `launch.finished`, `downloads.progress`, `downloads.finished`,
`auth.changed`, `library.changed` (`{ gameIds?, systems? }`).

**Media:** `nextlevel://media/<gameId>/<kind>`, `nextlevel://menu-art/<themeId>/<kind>/<name>`,
`nextlevel://pack/<themeId>/<path>`. Only paths resolved from the library or settings are served;
the protocol never accepts raw file paths (fixes path traversal by construction).
