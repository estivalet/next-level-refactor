# Linked Catalog Files Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A catalog file can be a Google Drive or archive.org link that the API verifies once (size + SHA-256, no copy kept) and the launcher downloads directly from the host.

**Architecture:** Shared contracts first (link normalizing, admin file `link` state, grant `linked`, new pause/failure reasons). The API stores the normalized link on `catalog_files`, verifies it in the background with an injectable `fetch`, and hands the link out in the download grant. The launcher maps host refusals of linked files to a `hostLimit` pause (only the player resumes it) or a `linkGone` failure. The admin console gets Add link, Retry and Check again.

**Tech Stack:** TypeScript ESM, Zod (`packages/shared`), Fastify + Drizzle + SQLite (`apps/api`), Electron main (`apps/launcher`), React (`apps/admin`), vitest.

**Spec:** `docs/superpowers/specs/2026-11-14-linked-catalog-files-design.md`

## Global Constraints

- Requirement ID **FR-CAT-9** (new; FR-CAT-8 is the license record) and decision **D65**; every new test name carries `FR-CAT-9`.
- No new npm dependencies (`npm install` is broken in this tree): `fetch`, `node:crypto`, existing libs only.
- Contracts first: every new field/route has its Zod schema in `packages/shared` before code uses it.
- Admin routes: `config: { role: 'admin' }`, every change audited (`audited(...)`).
- Download/link URLs are never logged (API or launcher).
- Old launchers (1.0.0-beta.1) keep working: grant additions are optional fields.
- No real network in tests; fixtures use dummy bytes (`NEXTLEVEL TEST FIXTURE …`), never commercial ROMs or links to them.
- Files ≤ 400 lines (`DownloadService.ts` is 512 today: Task 4 splits it).
- All user-visible strings in en and pt-BR.
- Run tests from PowerShell in the repo root with `$env:CI=1`; after `npm run db:generate -w apps/api`, commit the migration.

## Review Focus

1. Drive answers verification with a **200 HTML page** (virus-scan or quota page) → the link fails `linkNotFile`; no checksum of the HTML is ever recorded. (Task 2 test)
2. The link **redirects off-host or to http** → fails `linkHost`; nothing recorded. (Task 2 test)
3. A **failed Check again** on a ready file leaves its size, checksum and the item version untouched. (Task 2 test)
4. A **failed or still-checking link** never replaces or removes a ready file of the same name, and the daily clean-up never deletes a linked row. (Task 2 tests)
5. A linked file answered **403 or 200 HTML** in the launcher pauses `hostLimit` after exactly one grant; `networkBack()` doesn't restart it. (Task 4 tests)

---

### Task 1: Requirement and shared contracts

**Files:**
- Modify: `docs/01-product/02-product-requirements.md` (add FR-CAT-9 row after FR-CAT-8: "A catalog file can be a link to a copy on Google Drive or archive.org instead of an upload; the API verifies it once (size, SHA-256) and the launcher downloads it from the host. Owner request 2026-11-14, D65: linked URLs are public and don't expire." Priority S. Add to FR-CAT-6: "Linked files (FR-CAT-9) are the exception.")
- Create: `packages/shared/src/api/linkedFiles.ts`, test `linkedFiles.test.ts`
- Modify: `packages/shared/src/api/catalog.ts` (AdminCatalogFile, DownloadGrant), `packages/shared/src/ipc/catalogContract.ts` (reasons), `packages/shared/src/index.ts`

**Interfaces:**
- Produces: `LINK_HOSTS = ['drive', 'archive'] as const`, `type LinkHost`
- Produces: `normalizeLink(input: string): { ok: true; host: LinkHost; url: string } | { ok: false; reason: 'linkHost' | 'linkFile' }`
- Produces: `isLinkHost(url: string): boolean` — https and host `drive.usercontent.google.com`, `drive.google.com`, `*.googleusercontent.com`, `archive.org` or `*.archive.org`
- Produces: `LINK_ERRORS = ['linkHost', 'linkFile', 'linkStatus', 'linkNotFile', 'linkNetwork', 'tooLarge'] as const`
- Produces: `AddLinkSchema = z.strictObject({ filename, role: FileRoleSchema, link: z.string().max(2000) })` (filename rule as `StartUploadSchema`)
- Produces: `AdminCatalogFileSchema.link: z.object({ host, url, state: z.enum(['checking', 'failed']).nullable(), error: z.enum(LINK_ERRORS).nullable() }).nullable()`
- Produces: `DownloadGrantSchema.files[].linked: z.boolean().optional()`
- Produces: `PAUSED_REASONS` + `'hostLimit'`; `DOWNLOAD_FAILURES` + `'linkGone'`

- [ ] **Step 1: Write the failing tests** in `linkedFiles.test.ts`:
  - `FR-CAT-9: Drive share links become the direct download link` — `/file/d/ABC_123-x/view?usp=sharing`, `/open?id=ABC_123-x` and `/uc?id=ABC_123-x&export=download` all → `{ ok: true, host: 'drive', url: 'https://drive.usercontent.google.com/download?id=ABC_123-x&export=download&confirm=t' }`.
  - `FR-CAT-9: archive.org details and download links with a file path become /download/` — `https://archive.org/details/nl-demo/Star%20Hopper.nes` → `https://archive.org/download/nl-demo/Star%20Hopper.nes`.
  - `FR-CAT-9: other hosts, http and file-less archive.org links are refused` — `http://drive.google.com/file/d/x/view` and `https://example.com/a.nes` → `linkHost`; `https://archive.org/details/nl-demo` → `linkFile`; `https://drive.google.com/drive/folders/x` → `linkFile`.
  - `FR-CAT-9: isLinkHost accepts Google and archive.org download hosts only` — `https://ia800.us.archive.org/1/items/x/a.nes` true; `https://doc-0s.googleusercontent.com/x` true; `https://archive.org.evil.com/x` false; `http://archive.org/x` false.
  - In `catalog.test.ts`: `FR-CAT-9: a grant file may say linked; without it, it parses as before`.
- [ ] **Step 2: Run** `npx vitest run packages/shared/src/api/` — Expected: FAIL (module not found).
- [ ] **Step 3: Implement** the Interfaces above. Builder: confirm the Drive direct form against Drive's current behaviour before Task 2 depends on it; if it differs, change it here and in the spec, and ledger a Ruling.
- [ ] **Step 4: Run** `npx vitest run packages/shared/` and `npm run typecheck` — Expected: PASS (fix fixtures that need `link: null`).
- [ ] **Step 5: Commit** `feat(shared): linked catalog file contracts (FR-CAT-9, D65)`.

### Task 2: API — store, verify and re-check linked files

**Files:**
- Modify: `apps/api/src/db/schema.ts` (`catalog_files`: `link_url text`, `link_state text enum('checking','failed')`, `link_error text`, all nullable); migration via `npm run db:generate -w apps/api`
- Modify: `apps/api/src/context.ts` (`fetch: typeof fetch`, default global; tests inject)
- Create: `apps/api/src/catalog/linkedFiles.ts`, test `linkedFiles.test.ts`
- Modify: `apps/api/src/catalog/files.ts` (extract the ready/replace step of `completeUpload` into `markReady`; `toAdminFile` adds `link`; `removeFile` skips the store for `storageKey === ''`)
- Modify: `apps/api/src/catalog/maintenance.ts` (the stale `pending` prune skips rows with `link_url` set)

**Interfaces:**
- Consumes: `normalizeLink`, `isLinkHost`, `AddLinkSchema`, `LINK_ERRORS` (Task 1)
- Produces: `markReady(ctx, actorId, item, row, action: 'item.file.add' | 'item.file.recheck'): AdminCatalogFile` in `files.ts` — the existing replace-same-name, `lastFile` guard, audit and `touch` logic of `completeUpload`, reused unchanged by it
- Produces: `addLink(ctx, actorId, itemId, input: AddLink): AdminCatalogFile` — row `status 'pending'`, `storageKey ''`, `link_url`, `link_state 'checking'`; starts a check
- Produces: `checkLinkAgain(ctx, actorId, itemId, fileId): AdminCatalogFile` — Retry (pending+failed) and Check again (ready); `CONFLICT reason 'checking'` while one runs; `NOT_FOUND` for a non-linked file
- Produces: `linkChecksIdle(ctx): Promise<void>` (tests wait on it)
- Verification: GET `link_url` with `ctx.fetch`, `redirect: 'follow'`; the final `response.url` (or the link when empty) must pass `isLinkHost`; stream through SHA-256 with a byte cap of `ctx.limits.upload`; at most 2 checks at once per context (queue the rest); timeout 30 min.

- [ ] **Step 1: Write the failing tests** (`linkedFiles.test.ts`, fake `ctx.fetch` returning `new Response(stream, { headers })`):
  - `FR-CAT-9: an added Drive link is checked, then ready with the size and checksum of the bytes` — admin view shows `link.host 'drive'`, `state null`; audit `item.file.add`.
  - `FR-CAT-9: a 200 HTML page is linkNotFile and nothing is recorded` (Review Focus 1) — status stays `pending`, `sha256 ''`, `link.state 'failed'`.
  - `FR-CAT-9: a redirect off Google/archive.org is linkHost` (Review Focus 2) — fake response with `url: 'https://evil.example/x'`.
  - `FR-CAT-9: a 404 is linkStatus; a dropped body is linkNetwork; more than the upload limit is tooLarge`.
  - `FR-CAT-9: a ready link replaces a ready file of the same name; a failed one leaves it` (Review Focus 4).
  - `FR-CAT-9: Check again with the same bytes changes nothing; with new bytes it updates size and checksum and bumps a published item's version` — audit `item.file.recheck`.
  - `FR-CAT-9: a failed Check again keeps the ready file's size, checksum and the item version` (Review Focus 3).
  - `FR-CAT-9: Check again while a check runs is CONFLICT checking`.
  - In `maintenance.test.ts`: `FR-CAT-9: the daily clean-up keeps linked files that are checking or failed` (Review Focus 4).
  - In `files` tests: `FR-CAT-9: removing a linked file deletes nothing from the store`.
- [ ] **Step 2: Run** `npx vitest run apps/api/src/catalog/` — Expected: FAIL.
- [ ] **Step 3: Implement**: schema columns + migration, `ctx.fetch`, `markReady` extraction (completeUpload tests stay green), `linkedFiles.ts`, maintenance and removeFile changes. A link URL never goes into logs or audit `before/after` other than through `toAdminFile`'s `link.url` (admin-only).
- [ ] **Step 4: Run** `npx vitest run apps/api/` and `npm run typecheck` — Expected: PASS.
- [ ] **Step 5: Commit** `feat(api): linked catalog files verified once (FR-CAT-9, D65)` (migration included).

### Task 3: API — routes and download grant

**Files:**
- Modify: `apps/api/src/routes/adminCatalogFiles.ts`, test `adminCatalogFiles.test.ts`
- Modify: `apps/api/src/catalog/downloads.ts`, test `downloads.test.ts` (or the existing grant tests)
- Modify: `apps/api/src/routes/files.ts` test if needed

**Interfaces:**
- Consumes: `addLink`, `checkLinkAgain` (Task 2)
- Produces: `POST /v1/admin/catalog/items/:id/links` body `AddLinkSchema` → `AdminCatalogFile`; `POST /v1/admin/catalog/items/:id/files/:fileId/check` → `AdminCatalogFile`. Both role `admin`.
- Produces: grant files of linked rows: `url = link_url`, `linked: true`; uploaded rows unchanged (no `linked` key).

- [ ] **Step 1: Write the failing tests:**
  - `FR-CAT-9: POST links adds a checking link; a non-admin gets 403; a bad link is VALIDATION_FAILED linkHost`.
  - `FR-CAT-9: POST check on a linked file starts a check; on an uploaded file it is NOT_FOUND`.
  - `FR-CAT-9: a grant hands a linked file's link with linked: true and still logs the download`.
  - `FR-CAT-9: /v1/files/:token never serves a linked file` (token for a linked file id → 404).
- [ ] **Step 2: Run** `npx vitest run apps/api/src/routes/ apps/api/src/catalog/downloads` — Expected: FAIL.
- [ ] **Step 3: Implement** routes and grant change.
- [ ] **Step 4: Run** `npx vitest run apps/api/` — Expected: PASS.
- [ ] **Step 5: Commit** `feat(api): add-link and check routes; grants hand out links (FR-CAT-9)`.

### Task 4: Launcher — host refusals of linked files

**Files:**
- Modify: `apps/launcher/src/main/catalog/downloadFile.ts`, test `downloadFile.test.ts`
- Modify: `apps/launcher/src/main/catalog/DownloadService.ts` — first split it under 400 lines (move folder housekeeping `#dropUnreadable`/`#sweepOrphans`/`#removeFolder`/`diskFree`/`SAFE_ID` to `downloadFolders.ts`, and `#verify` to `verifyParts.ts`, or an equivalent cut; no behaviour change, its tests stay green), then the changes below; tests in `DownloadService.test.ts`
- Modify: `apps/launcher/src/main/catalog/fakeFilesServer.ts` (respond with a chosen status or an HTML 200 for a token)
- Modify: `packages/shared/src/i18n/en.json`, `pt-BR.json` (`catalog.downloads.paused.hostLimit`: "The game's host is busy or over its daily limit — try again later" / "O servidor do jogo está ocupado ou no limite diário — tente mais tarde"; the failed `linkGone`: "The game's file is no longer at its host" / "O arquivo do jogo não está mais no servidor")

**Interfaces:**
- Consumes: grant `linked`, `PAUSED_REASONS 'hostLimit'`, `DOWNLOAD_FAILURES 'linkGone'` (Task 1)
- Produces: `downloadFile({ …, linked?: boolean })` → `'done' | 'expired' | 'network' | 'hostLimit' | 'gone'`. For `linked`: 403/429 or a 200/206 whose `content-type` starts with `text/` → `hostLimit` (nothing written); 404/410 → `gone`. Unlinked behaviour unchanged.

- [ ] **Step 1: Write the failing tests:**
  - `downloadFile.test.ts`: `FR-CAT-9: a linked file answered 403 or 429 is hostLimit`; `FR-CAT-9: a linked file answered 200 text/html is hostLimit and the part is untouched`; `FR-CAT-9: a linked file answered 404 is gone`; `FR-CAT-9: an unlinked 403 is still expired`.
  - `DownloadService.test.ts`: `FR-CAT-9: a linked file refused by its host pauses hostLimit after one grant` (Review Focus 5: `state.grantCalls === 1`); `FR-CAT-9: networkBack does not restart a hostLimit pause; Resume does`; `FR-CAT-9: a linked file gone from its host fails linkGone`.
- [ ] **Step 2: Run** `npx vitest run apps/launcher/src/main/catalog/` — Expected: FAIL.
- [ ] **Step 3: Implement**: split, then `downloadFile` + `DownloadService` (`networkBack` skips `'user'` and `'hostLimit'`), strings, and the Downloads tab shows the new reason/failure through the existing `catalog.downloads.paused.*` / failed keys.
- [ ] **Step 4: Run** `npx vitest run apps/launcher/src/main/catalog/ apps/launcher/src/renderer/features/catalog/` — Expected: PASS; `wc -l` of `DownloadService.ts` < 400.
- [ ] **Step 5: Commit** `feat(launcher): linked catalog files pause on host limits (FR-CAT-9)` (the split may be its own earlier `refactor(launcher)` commit).

### Task 5: Admin console — Add link, Retry, Check again

**Files:**
- Modify: `apps/admin/src/api/catalog.ts`, `apps/admin/src/pages/catalog/FilesTab.tsx` (split if it passes 400 lines), admin i18n strings (en + pt-BR, where the admin's other catalog strings live)
- Test: `apps/admin/src/pages/catalog/catalogFiles.test.tsx`

**Interfaces:**
- Consumes: routes from Task 3, `AdminCatalogFile.link`, `normalizeLink` (Task 1) for inline validation

- [ ] **Step 1: Write the failing tests:**
  - `FR-CAT-9: Add link sends name, role and link, and the file shows Checking link…`.
  - `FR-CAT-9: a link the API would refuse shows the reason before sending` (example.com → "Only Google Drive and archive.org links").
  - `FR-CAT-9: a failed link shows its reason with Retry and Remove; a ready link shows its host and Check again`.
  - `FR-CAT-9: while any link is checking, the files list refreshes until it settles` (poll every 3 s while a file has `link.state 'checking'`).
- [ ] **Step 2: Run** `npx vitest run apps/admin/src/pages/catalog/` — Expected: FAIL.
- [ ] **Step 3: Implement** the form beside **Upload file**, states and buttons; reason texts for each `LINK_ERRORS` value.
- [ ] **Step 4: Run** `npx vitest run apps/admin/` — Expected: PASS.
- [ ] **Step 5: Commit** `feat(admin): add catalog files as Drive or archive.org links (FR-CAT-9)`.

### Task 6: Docs and full verification

**Files:**
- Create: `docs/03-architecture/adr/ADR-015-linked-catalog-files.md` (context: no paid storage now; decision: option A; consequences: links public and permanent, FR-CAT-6 exception, Drive limits; alternatives: B streaming, automatic upload)
- Modify: `docs/03-architecture/api-spec.md` (two routes, grant `linked`), `docs/03-architecture/data-model.md` (three columns), `docs/06-legal/security-and-privacy.md` (threat row "download URL shared": linked files are public by design), `docs/02-design/screen-specifications.md` (admin Files tab, launcher Downloads reasons), `docs/01-product/roadmap.md`, `CHANGELOG.md` (Unreleased → Added)

- [ ] **Step 1: Write docs** as listed.
- [ ] **Step 2: Run** `npm run lint`, `npm run typecheck`, `npm test` (PowerShell, `$env:CI=1`), and `npm run test:e2e` (unset `ELECTRON_RUN_AS_NODE`) — Expected: all pass; the traceability test finds FR-CAT-9 in tests.
- [ ] **Step 3: Commit** `docs: linked catalog files — ADR-015, api-spec, data model, security (FR-CAT-9, D65)`.
