# Security, privacy & compliance

> This document describes engineering measures. It is not legal advice. Before charging real
> customers, have the privacy policy, terms of service and content policy reviewed by a lawyer
> in the operator's jurisdiction.

## 1. Assets to protect

| Asset | Where | Threat |
|---|---|---|
| User accounts & sessions | API DB, launcher secrets | account takeover, session theft |
| Subscription access | API | sharing accounts, bypassing payment |
| Catalog files | R2 | unauthorized download, hotlinking |
| License evidence | R2 | loss (legal exposure) |
| User's PC | launcher | malicious input → code execution, path traversal |
| User's local library | launcher | data loss from bugs or bad updates |
| Admin console | API | privilege escalation, CSRF |

## 2. Authentication & authorization

- Google OAuth only; PKCE + system browser + loopback for the launcher ([ADR-006](../03-architecture/adr/ADR-006-google-sign-in.md)).
- Verify Google ID tokens: signature, `aud`, `iss`, `exp`, `email_verified`.
- Access JWT 15 min (HS256 with `kid` rotation); refresh token 30 days, opaque, stored as SHA-256
  hash, rotated on each use, **reuse revokes the device**.
- Launcher stores the refresh token with Electron `safeStorage` (DPAPI on Windows). Never in
  `settings.json`, logs or crash reports.
- Admin session: httpOnly, `Secure`, `SameSite=Strict` cookie, 8 h idle timeout; state-changing
  admin requests also require an `X-CSRF-Token` header (double-submit).
- Authorization in the API only. Every route declares `role` and, for catalog, checks scopes from
  the computed entitlement. The UI hiding something is never the control.
- Device limits per plan; revocation takes effect within one access-token lifetime.
- Rate limits on auth and download endpoints (see [api-spec](../03-architecture/api-spec.md#rate-limits-defaults)).

### Secrets on the device

The launcher keeps secrets in one file, `secrets.bin` in its data folder, encrypted with
Electron `safeStorage` (DPAPI on Windows) and written atomically. DPAPI ties the file to the
Windows user: a NextLevel folder copied to another PC or user can't decrypt it, so the launcher
reads it as empty (sign in again, re-enter ScreenScraper credentials) and logs that once (D50). They never appear in
`settings.json`, backups, IPC outputs, logs or crash reports, and the renderer never sees a value.

| Key | Since | Holds |
|---|---|---|
| `screenscraper.devId`, `screenscraper.devPassword` | M6a | ScreenScraper developer credentials (D15) |
| `screenscraper.user`, `screenscraper.password` | M6a | The user's ScreenScraper account |
| `auth.session` | M7b | The sign-in: device id, refresh token, profile, last entitlement and when it was checked (JSON). The 15-minute access token is kept in memory only |

## 3. Launcher hardening (Electron)

- `contextIsolation: true`, `sandbox: true`, `nodeIntegration: false`, `webSecurity: true`.
- Strict CSP: `default-src 'self'; img-src 'self' nextlevel: data:; media-src 'self' nextlevel:; connect-src 'self' <api origin>`.
- No remote content loaded in app windows; external links open in the system browser after a URL allow-list check.
- IPC: every channel validates input with Zod; no generic "run command" or "read file" channel.
- `nextlevel://` serves only paths resolved from the library or settings; requests carry IDs, not
  paths (prevents traversal by construction — critical scenario C12).
- Emulator launch: `spawn` with argv arrays, `shell: false`. Executables are chosen by the user via
  a file picker; the launcher never downloads and runs executables without explicit user action.
- Downloads: HTTPS only, SHA-256 verified before install, written to the managed location only,
  file names sanitized.
- Auto-update feed and installer signed; `electron-updater` verifies signatures.
- Electron kept within supported majors (security fixes).

## 4. API hardening

- Input validation on every route (Zod), output serialization schemas (no accidental field leaks).
- Parameterized queries only (Drizzle).
- Stripe webhooks: verify signature on raw body; idempotent processing.
- Presigned download URLs: 10-minute expiry, per user/file, logged.
- Security headers (`@fastify/helmet`), CORS limited to admin origin in dev, same-origin in prod.
- Secrets only in environment; validated at boot; never logged.
- Dependency scanning (Dependabot + `npm audit`) and pinned lockfile.
- Admin actions audited (append-only `audit_log`).

## 5. Data inventory & privacy

| Data | Purpose | Source | Retention |
|---|---|---|---|
| Google subject ID, email, name, avatar URL | account identity, contact | Google | while account exists + 30 days |
| Subscription state, Stripe customer/subscription IDs | access control, billing | Stripe | while account exists; invoices per tax law (Stripe holds them) |
| Devices (name, platform, app version, last seen) | device limits, security | launcher | until revoked + 90 days |
| Download log (user, file, time, hashed IP) | abuse detection, license reporting | API | 12 months |
| Audit log | accountability | API | 3 years |
| Synced settings/menus/collections/game state (M10) | sync feature | launcher (opt-in) | while sync enabled; deleted on disable |
| Crash reports | stability | launcher (opt-in) | 90 days |

**Not collected:** payment card data (Stripe only), local ROM file lists (unless sync is enabled,
and then only game identifiers/metadata, never files), browsing analytics without opt-in.

### Data subject rights (LGPD / GDPR)

- **Access/export:** Account screen → "Download my data" (JSON of all rows tied to the user).
- **Deletion:** Account screen → "Delete account" → cancels subscription, deletes user rows,
  pseudonymizes audit and download logs, deletes sync documents within 30 days.
- As built (M8e, D36): **Download my data** (`GET /v1/me/export`) returns the profile, every
  device (revoked ones too), the subscriptions and the audit entries about the account, without
  token hashes, Google ids, console sessions or who made a change. **Delete account**
  (`DELETE /v1/me`, or an admin's `DELETE /v1/admin/users/:id`) needs the account's email typed
  again; admins must be demoted first. A Stripe subscription still billing is cancelled at once
  (no automatic refund; refunds by hand in Stripe); if Stripe can't be reached nothing is deleted
  (`BILLING_UNAVAILABLE`, try again). Then in one transaction: refresh tokens, devices, console
  sessions and the user's subscriptions are deleted, audit snapshots about the account lose
  email, name, avatar and suspension reason, and the user row is deleted — or, when the audit log
  or another user's grant points at it (a former admin), kept as a tombstone with no email,
  name, avatar or Google id (signing in again makes a new account). An admin's deletion is
  audited as `user.delete` without the email. The launcher's local library is not touched.
- **Correction:** profile data comes from Google; refreshed at each sign-in.
- Legal basis: contract (account, billing), legitimate interest (security logs), consent
  (crash reports, sync).
- Processors to list in the privacy policy: Google (auth), Stripe (payments), Cloudflare (CDN,
  storage), VPS provider, optional Sentry.

## 6. Compliance checklist (before charging money)

Still open after M8 (D31): billing runs in Stripe test mode only; these items are the go-live
steps in M10, before live keys.

- [ ] Privacy policy published (data above, processors, rights, contact)
- [ ] Terms of service (subscription terms, acceptable use, account sharing, termination, content rules)
- [ ] Content policy enforced ([content-policy.md](content-policy.md))
- [ ] Consumer-law items for subscriptions in the operator's country (cancellation, renewal notice, refund policy)
- [ ] Tax registration / invoicing approach decided ([ADR-009](../03-architecture/adr/ADR-009-stripe.md))
- [ ] DMCA / takedown contact published and process in [operations](../05-operations/deployment-and-operations.md#remove-a-catalog-item-urgently-takedown)
- [ ] Trademarks: "NextLevel" name search; no console makers' logos used as product branding
- [ ] Third-party licenses: Electron, React, emulator presets (we reference emulators; we don't bundle them in v1), EmulatorJS (GPL-3.0) review before the web player
- [ ] Art assets in themes: own or licensed; scraped art stays on the user's machine and is not redistributed

## 7. Threat model summary (STRIDE, top items)

| Threat | Mitigation |
|---|---|
| Spoofing: stolen refresh token | DPAPI storage, rotation + reuse detection, device revoke |
| Tampering: modified launcher skips entitlement | Server enforces everything that matters (catalog, downloads, sync). Local-only play after tampering is accepted risk |
| Repudiation: admin denies change | Append-only audit log |
| Information disclosure: download URL shared | 10-min expiry, per-user logging, rate limits |
| DoS: download abuse | Rate limits, Cloudflare in front, R2 egress free |
| Elevation: subscriber calls admin route | Role guard on every route, contract tests |
