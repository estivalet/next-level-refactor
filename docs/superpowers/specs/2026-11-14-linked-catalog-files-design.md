# Linked catalog files (Google Drive, archive.org) — design

Date: 2026-11-14 · Owner decision: D65 · Requirement: FR-CAT-9 (new) · ADR: ADR-015 (to write)

## Intent

The owner doesn't want to pay for AWS/R2 storage right now (R2 is on hold, `FILE_STORE=local`)
and wants **free places to keep catalog game files**. This is not a migration: files uploaded to
the API's disk keep working exactly as today. A catalog file can now **either** be uploaded
(as today) **or** be a link to a copy the owner put on Google Drive or archive.org.

Success: the owner uploads a homebrew game to Drive or archive.org, pastes its share link on the
item in the admin console, publishes the item, and a subscriber installs it from the launcher
with the same checks as an uploaded file (subscription, device, logging, checksum before install).

## Goals

- A catalog file can be a **link** (Google Drive or archive.org) instead of an upload.
- The API verifies a linked file once: downloads it, records its **size and SHA-256**, keeps no copy.
- The launcher downloads a linked file **directly from the host** (owner choice A, 2026-11-14) and
  checks the checksum before installing, as today.
- Clear failures: a link that can't be verified is never "ready"; a host refusing a download
  (Drive's daily limit, a removed file) pauses or fails the install with a reason, not a loop.
- An item can mix uploaded and linked files.

## Non-goals

- Automatic upload to Drive/archive.org (no Google or archive.org credentials on the server).
- Periodic link health checks (a later "Check links" button may come).
- Other hosts (Dropbox, OneDrive, GitHub releases…) — later, if wanted.
- Linked **art/media** or license **evidence**: those stay in the store.
- Changing R2/S3 code (on hold, untouched).

## Anti-goals (a failure even if it "works")

- Installing a file whose bytes don't match the checksum recorded at verification.
- The launcher hammering the API for new grants when a host refuses (rate-limit spiral).
- Publishing an item without its license record (ADR-012 is unchanged).
- Secrets or the user's identity sent to Drive/archive.org (the launcher sends no API token
  to a linked host).
- Commercial ROMs or links to them anywhere in code, tests, fixtures or docs (fixtures use fake
  hosts and dummy bytes).

## Constraints

- ADR-012: rights-cleared content only; license record required to publish.
- Contracts first: new fields/routes get Zod schemas in `packages/shared` before code.
- Admin routes declare role `admin`; every change audited.
- No new npm dependencies (`npm install` is broken in this tree): use `fetch`, `node:crypto`.
- Old launchers (1.0.0-beta.1) must keep working against the new API: additions to the download
  grant are optional fields they ignore.
- Download URLs are never logged (existing rule) — linked URLs included, in the API and launcher.

## Approaches (decided in conversation)

- **A — launcher downloads straight from the link (picked).** Free in disk and bandwidth. The API
  still checks subscription and device and logs the grant, but the link is public and
  permanent: a subscriber could share it and the 10-minute expiry (FR-CAT-6) doesn't apply to
  linked files. Acceptable because catalog content is rights-cleared and shareable by license.
- **B — the API streams the file from the host.** Keeps links private and FR-CAT-6 intact, but
  every download costs server bandwidth and time: saves disk only. Rejected — not actually free.
- **Automatic upload to the host via their APIs.** Rejected (non-goal): needs OAuth/S3 keys on
  the server for little gain over pasting a link.

## The design

### Admin console (FR-ADM-3)

In an item's **Files** section, beside **Upload file**, an **Add link** form: file name (validated
like an upload's), role (rom/disc/extra) and the share link. Saving creates the file in
**Checking link…**; it becomes **Ready** (size and checksum shown, host shown as "Google Drive" or
"archive.org") or **Link failed — <reason>** with **Retry** and **Remove**. Publishing keeps today's rule
(`publishBlockers`: a license, an on-lapse choice and at least one ready rom/disc file); a file
that isn't ready is simply never handed out, and the admin sees its state on the item. *(Builder
check; my call: no new publish blocker.)* A linked file that is checking or failed must stay out
of the daily clean-up of abandoned `pending` uploads, which deletes store objects.

Accepted links (the API normalizes them; anything else is refused with `VALIDATION_FAILED`
`reason: 'linkHost'`):

- Google Drive: `https://drive.google.com/file/d/<id>/…`, `https://drive.google.com/open?id=<id>`,
  `https://drive.google.com/uc?id=<id>…` → direct link
  `https://drive.usercontent.google.com/download?id=<id>&export=download&confirm=t`
  (**builder: verify this direct form against Drive at implementation time**; it is what skips
  the large-file virus-scan page today).
- archive.org: `https://archive.org/details/<identifier>/<path>` or
  `https://archive.org/download/<identifier>/<path>` → `https://archive.org/download/<identifier>/<path>`.
  A `details` link without a file path is refused (`reason: 'linkFile'`).

### Verification (API)

Runs in the background after **Add link** and on **Retry**: `GET` the direct link (redirects
followed, HTTPS only, final host must be a Google or archive.org host), stream it through
SHA-256 counting bytes, keep nothing. Refused (file stays not-ready with the reason):
an HTTP error (`linkStatus`), an HTML/text response (Drive's warning or quota page:
`linkNotFile`), more than the upload limit (`tooLarge`), a timeout or dropped connection
(`linkNetwork`). On success the file is `ready` with `size`, `sha256`; audited like an upload.
One verification at a time per file; the server never verifies more than a few links at once
(builder's call on the number).

**Check again** (owner choice, 2026-11-14): a ready linked file also has **Check again**. It
re-verifies the link the same way. Same size and checksum: nothing changes. A different file:
the new size and checksum replace the old ones only once the new copy verified, the item's
version is bumped like a replaced upload (installed copies see **Update available**, D42), and
the change is audited. While a re-check runs, the file stays ready with its old checksum; a
failed re-check leaves it ready and shows the reason (the old copy may still be at the host).

### Data (API DB, `catalog_files`)

New nullable `link_url` (the normalized direct link) and `link_error` (last failure reason).
A linked file has no store object: `storage_key` is empty for it (or the builder's equivalent),
the orphan sweep and file removal skip the store for linked files. Migration committed
(`npm run db:generate -w apps/api`). Data model doc updated.

### Download grant (shared contract)

`DownloadGrant.files[]` gains optional `linked: boolean` (absent = false). For a linked file
`url` is the `link_url` and `expiresAt` is the grant's usual time (the launcher keeps using it
to decide when to re-ask). Grants are still logged per user/device/file with the IP HMAC.
`/v1/files/:token` never serves a linked file (it has no store object).

### Launcher

`downloadFile` today maps 401/403/404/410 to `expired` (re-request the grant). For a **linked**
file: 403, 429 and a 200 answer that is HTML/text (Drive's limit or warning page) are **host
limit** → the download pauses with a new reason `hostLimit` ("The game's host is busy or over its
daily limit; try again later"); 404/410 → **failed** with `linkGone`; other errors as today
(`network`). A `hostLimit` pause is **not** resumed automatically (`networkBack()` skips it, like
a player's pause): only the player's Resume restarts it, which asks for one new grant. A share the
owner revoked also answers 403, so it shows as `hostLimit` until the player cancels — accepted.
*(Builder check; my calls.)* No API headers are sent to a
linked host. Resume uses Range as today; a host that ignores Range restarts the file (existing
behaviour). Checksum check before install is unchanged. New strings in en and pt-BR.

### Docs

ADR-015 (linked files, choice A and its trade-off), a new requirement **FR-CAT-9** "Catalog files
can be links to Google Drive or archive.org (owner request 2026-11-14, D65)" — tests are named
with it — plus notes on FR-ADM-3 and FR-CAT-6 (linked URLs don't expire), security doc (threat row "download URL shared": linked files are
public by design), api-spec (Add link / Retry / Check again routes, grant `linked`), data model, admin screen
spec, CHANGELOG.

## Left to the builder

Route names/shapes for Add link, Retry and Check again (following the existing admin catalog routes), how the
background verification is scheduled within the one API process, the concurrency number, the
exact Drive direct-link form after checking it, test fakes for the hosts (an in-process server
standing in for Drive/archive.org; no real network in tests), and the admin UI layout within the
existing Files section.
