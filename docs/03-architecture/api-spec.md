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
- **Auth:** launcher → `Authorization: Bearer <accessToken>` (JWT, 15 min; a revoked device's token is refused at once). Every route declares a role (`public`, `device`, `admin`); registering one without a role fails at start. Admin console →
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
| `NOT_ALLOWED` | 403 | Sign-up mode doesn't admit this Google account (D22) |
| `INTERNAL` | 500 | Logged with `requestId` |

## 2. Endpoints

### Auth

| Method & path | Who | Body → Response |
|---|---|---|
| `GET /v1/auth/launcher-config` | launcher | → `{ authorizeUrl, clientId, scopes, banner }` (Google's authorize URL and the Desktop client id; with `AUTH_STUB=1` the stub's) |
| `POST /v1/auth/google/exchange` | launcher | `{ code, codeVerifier, redirectUri (http://127.0.0.1:<port>/callback), device: { name, platform, appVersion } }` → `{ accessToken, refreshToken, deviceId, user, entitlement, banner }`; a new account needs sign-up mode to admit it (`NOT_ALLOWED`); the plan's device limit reached → `409 DEVICE_LIMIT` with `details: { ticket, devices }` |
| `POST /v1/auth/complete` | launcher | `{ ticket, revokeDeviceId, device }` → same as exchange: revokes that device and finishes the sign-in (ticket valid 5 min, once) |
| `POST /v1/auth/refresh` | launcher | `{ refreshToken, deviceId }` → `{ accessToken, refreshToken }` (rotated; reuse revokes the device) |
| `POST /v1/auth/logout` | launcher | `{ refreshToken }` → `204`; revokes the device (frees its slot) |
| `GET /v1/auth/stub/authorize` | browser | Development only (`AUTH_STUB=1`): persona picker (`admin`, `subscriber`, `suspended`, `outsider`), or straight back to `redirect_uri` with `login_hint=<persona>` |
| `GET /v1/auth/google/start` | admin (browser) | → `302` to Google with state cookie |
| `GET /v1/auth/google/callback` | admin (browser) | → sets `nl_session`, `302 /` (admins only; others get an error page) |
| `POST /v1/auth/session/logout` | admin | → clears cookie |

### Me

| Method & path | Body → Response |
|---|---|
| `GET /v1/me` | → `{ user, entitlement }` |
| `GET /v1/me/entitlement` | → `{ entitlement, banner }` (launcher polls hourly and after checkout) |
| `GET /v1/me/devices` | → `Device[]`: the devices not revoked, oldest first; `current` marks the caller |
| `DELETE /v1/me/devices/:id` | → `204`; another user's device → `NOT_FOUND`; the calling device → `CONFLICT` (`details.reason: 'current'`, sign out instead) |
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

Auth endpoints 10/min/IP; download URL issue 60/hour/user; everything else 300/min (counted per address: the limit runs before authentication). `RATE_LIMITED` carries `Retry-After`.

### Logging

Requests are logged by method and path only (no query string: OAuth codes and states travel there; no client address). Tokens, codes and emails never appear in a log line.

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
Object inputs use `z.strictObject` so unknown keys fail validation; extra arguments and unknown
channels also return `VALIDATION_FAILED`.

| Area | Channels |
|---|---|
| Settings | `settings.get` (`ok` snapshot or `invalid` + latest backup id), `settings.save` (`baseRevision`; stale → `CONFLICT`), `settings.reset`, `settings.backups.list`, `settings.backups.restore`, `settings.export`, `settings.import`. No `settings.validate`: both processes validate with the shared schema |
| Systems | `systems.catalog` (definitions with `presetProfiles`, best first), `systems.list` (one `{ id, enabled, games, missing, review }` per catalog system; `review` since M6d: games needing review, hidden ones left out; `games` includes missing ones) |
| Library | Since M2c: `library.games.list` (`{ scope: { kind: 'system', systemId } \| { kind: 'collection', collectionId }, tab: all\|favorites\|hidden\|missing\|needsReview, sort?, text?, offset, limit ≤ 1000 }` → `{ total, offset, games }`; All leaves hidden games out; missing rows carry `expectedPath`), `library.games.get` (`{ gameId }` → details with `lockedFields`, `filters`, `collectionIds`; since M6b also `scrape` (last scrape status or null) and `media` (indexed kind → file version)), `library.games.updateMetadata` (`{ gameId, changes }`; edited fields join `lockedFields`), `library.games.setFlags` (`{ gameIds, flags: { favorite?, hidden?, userRating? } }`), `library.games.relink` (`{ missingGameId, replacementGameId }`: the missing row takes the other game's file, the other row is deleted), `library.games.reveal` (`{ gameId }`; path resolved from the library, never from input), `library.search` (`{ text, limit? ≤ 200 }` → `{ games, more }`; FTS5 prefix match, hidden games excluded, < 2 characters → empty). Since M3: `library.games.launchOverride` (`{ gameId }` → `{ profileId, core, extraArgs }`, empty when unset) and `library.games.setLaunchOverride` (`{ gameId, override }`; an empty override removes it; emits `library.changed`). Later: `library.menu.get` |
| Collections | Since M2c: `collections.list`, `collections.create` (`{ name }`), `collections.update` (`{ id, name?, sort?: manual\|title\|year }`), `collections.delete`, `collections.addGames` / `collections.removeGames` (`{ id, gameIds }` → summary), `collections.reorder` (`{ id, gameId, swapWithGameId }` swaps two members, so Move up / Move down act on the rows shown even when hidden members sit between them). Names are unique ignoring case (`NAME_TAKEN`); unknown ids → `NOT_FOUND` |
| Front-end | Since M4a: `frontend.menu` (→ `{ title, items: MenuNode[] }`; until M5 menus this is the generated menu: manufacturer categories → enabled systems with present games → filter nodes when a system's games carry ≥ 2 filters, then Collections; node ids `m:<slug>`, `s:<systemId>`, `s:<systemId>:f:<filter>`, `c:<collectionId>`), `frontend.games` (`{ nodeId }` → every present game of that system, filter or collection as `ThemeGame` rows with `filters`, indexed `media` kinds and (since M6b) `mediaVersions` (kind → file version for the media URL); hidden games included and flagged; unknown or non-game node → `NOT_FOUND`), `frontend.artIndex` (`{ themeId, refresh? }` → `{ packFiles, assetsFiles, manifest, warnings }`: files under `<themesPath>/<themeId>` and the art folder, up to four levels, `_UNSORTED_DO_NOT_DELETE` skipped; the pack `theme.json` parsed leniently; `warnings` are `{ code, field? }` with code `folderUnreadable`, `manifestInvalidJson`, `manifestNotObject`, `manifestIdMismatch`, `manifestFallbackInvalid`, `manifestArtNotObject`, `manifestArtWrongType` or `manifestSettingsNotObject` (since M4d; Settings shows them through i18n); cached until `refresh` or a folder change) |
| Menus | `menus.list`, `menus.get`, `menus.save` (whole tree + base revision), `menus.create`, `menus.delete`, `menus.setActive` |
| Scan | `scan.start` (`{ systemIds? }`; while a scan runs it returns that scan's status), `scan.cancel`, `scan.status`; all return `{ running, progress, last }` (`last` = summary with per-system present/added/moved/restored/missing and `enabledSystemIds`). Without a library they fail with `LIBRARY_UNAVAILABLE` |
| Launch | Since M3: `launch.game` (`{ gameId }` → `{ launchId }` once the emulator started; exit arrives as `launch.finished`; one game at a time → `ALREADY_RUNNING`), `launch.test` (`{ emulator, profile, gameId }`, saved or draft → `{ executable, args, cwd, commandLine, exitCode, stderrTail, durationMs, error? }` after the emulator exits; never counted as a play), `launch.preview` (`{ emulator, profile, gameId? }` → rendered argv without checks; no game → an example ROM path), `launch.log` (`{ offset, limit ≤ 200 }` → `{ total, offset, entries }`, newest first), `launch.running` (→ `{ gameId, launchId }` or null). A draft whose `profile.emulatorId` isn't `emulator.id`, or whose templates have issues, fails with `VALIDATION_FAILED`. Errors: `NO_PROFILE`, `EMULATOR_MISSING`, `ROM_MISSING`, `CORE_MISSING`, `LAUNCH_FAILED` (`details.reason`: `script`, `emptyArchive`, `cwdMissing` or the spawn error code such as `ENOENT`; `details.path`, `exitCode`, `stderrTail`), each with `details.fix = { section, id? }` for **Fix in Settings**; the details are `LaunchErrorDetailsSchema` in `packages/shared` |
| Emulators | Since M3: `emulators.presets` (the shipped presets), `emulators.detect` (`{ folder }` → `{ presetId, executable }[]`, preset program names up to two folders deep, ignoring case) |
| Scraper | Since M6a: `scraper.credentials.status` (→ which of devId/devPassword/user/password are stored, and whether the OS store is available; never values), `scraper.credentials.set` (omitted = unchanged, null = removed), `scraper.test` (→ `{ user, requestsToday, maxRequestsPerDay }`). Since M6b: `scraper.systems` (`{ refresh? }` → ScreenScraper `{ id, name }[]`, cached 30 days; an empty answer is not cached), `scraper.search` (`{ gameId, title?, refresh? }` → `{ method: hash\|title, candidates: { providerGameId, name, year, region, similarity, thumb }[] }`; no `title` and a present file = ROM hash first; `thumb` is `nextlevel://scrape-thumb/<id>` for the first 8 candidates, never a ScreenScraper URL), `scraper.preview` (`{ gameId, providerGameId }` → per art kind `{ local, available }`, per field `{ current, scraped, locked }`), `scraper.apply` (`{ gameId, providerGameId, kinds, fields }` → `{ written, failed: { kind, code: notAvailable\|download\|write }[], game }`; ticked locked fields are written and stay locked, D19; a scan or import running, or another apply on the game → `BUSY`), `scraper.setSystemId` (`{ systemId, screenscraperId }` → saves `systems[id].screenscraperId`). Errors: `NO_SCRAPER_SYSTEM`, `NO_CREDENTIALS`, `SCRAPER_CREDENTIALS`, `SCRAPER_QUOTA`, `SCRAPER_UNAVAILABLE`, `SCRAPER_NETWORK`. Since M6c: `scraper.batch.start` (`{ scope: { systemIds } \| { gameIds ≤ 50,000 }, rules: { onlyMissing, kinds, fields (no title), regions } }` → `BatchStatus`; a job running or paused, or a scan or import running → `BUSY`), `scraper.batch.pause` (after the current game), `scraper.batch.resume`, `scraper.batch.cancel` (running: after the current game; paused: at once), `scraper.batch.status`; `BatchStatus` = `{ jobId, state: idle\|running\|paused\|finished, pausedReason: quota\|network\|credentials\|user\|media\|error\|null, resumeAt, total, done, applied, review, notFound, failed, current: { gameId, title }\|null, systemIds: string[]\|null }` (`systemIds`: the systems of a system-scope job, which **Show Needs review** opens; null for a selection) |
| Catalog | `catalog.list`, `catalog.get`, `catalog.install`, `catalog.uninstall`, `downloads.list`, `downloads.pause`, `downloads.resume`, `downloads.cancel` |
| Auth | `auth.state`, `auth.signIn`, `auth.cancelSignIn`, `auth.signOut`, `auth.refreshEntitlement`, `auth.openCheckout`, `auth.openPortal` |
| Import | Since M5d: `import.inspect` (`{ folder }` → `{ emulatorsFolder }`: `<parent of NextLevelOS's first storage location>\emulators` when it exists, else null; D14), `import.dryRun` (`{ folder, emulatorsFolder }` → `ImportReport`: `source`, `token`, `counts`, per-system `{ systemId, entries, withFile, missing, newFiles }`, `mapped` / `unmapped` / `willReplace` items `{ area, key, reason, detail?, count? }`; writes nothing), `import.apply` (`{ folder, emulatorsFolder, reportToken }` → `{ games: { matched, inserted, missing }, collections, menus, settingsBackupId, durationMs }`; folder changed since the dry run → `CONFLICT` with `details.reason: 'folderChanged'`, a scan or import running → `BUSY`, both before any write). Schemas in `packages/shared/src/import/` |
| System | `app.paths`, `app.openPath` (takes a folder key `data`/`backups`/`logs`, never a path), `app.pickFolder` (`{ title? }` → path or null; native dialog in main), `app.pickFile` (`{ kind: 'executable', title? }` → path or null; `.exe` filter), `app.version`, `app.quit`, `app.setKioskUnlocked` |

**Events (main → renderer):** `settings.changed`, `scan.progress`, `scan.finished`,
`launch.started`, `launch.finished`, `downloads.progress`, `downloads.finished`,
`auth.changed`, `library.changed` (`{ systems, gameIds? }`; `gameIds` names the games a metadata, flag or relink change touched). Since M2b
`scan.progress`, `scan.finished`, `settings.changed` and `library.changed` exist: schemas in
`packages/shared/src/ipc/events.ts`, sent on `event:<name>` channels after main validates the
payload, received with `window.nextlevel.on(event, listener)` (returns an unsubscribe function;
unknown events are ignored). Since M5d `import.progress` (`{ stage: settings|scan|games|collections|menus, done, total }`; the dry run reports `scan` while it walks). Since M6c `scraper.batch.progress` (`BatchStatus`, after every change of the batch job). Since M3 `launch.started` (`{ launchId, gameId }`) and `launch.finished` (`{ launchId, gameId, exitCode, durationMs, counted, error? }`; `counted` is false and `error` set when the exit code wasn't 0 within 10 s).

**Media (since M4a):** `nextlevel://media/<gameId>/<kind>` serves the file the media index
(`game_media`) holds for that game and kind; since M6b an optional `?v=<version>` (the file's
mtime in ms) makes a replaced file a new URL, and `nextlevel://scrape-thumb/<providerGameId>`
serves the box thumbnail of a candidate from the last searches (main downloads it; unknown ids
404); `nextlevel://art/assets/<rel>` and
`nextlevel://art/pack/<themeId>/<rel>` serve files under the art folder or that theme's pack
(`<rel>` segments are URL-encoded; `..`, `\`, `:` and empty segments are refused). The resolved
real path must stay inside its root, so links and junctions can't escape. Ranged requests get
206/416 with `Accept-Ranges: bytes`; anything else that doesn't resolve is 404, non-GET is 405. The
protocol never accepts raw file paths (`packages/shared/src/frontend/urls.ts` builds and parses
the URLs).
