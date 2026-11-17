# Museum Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Personal notes, an emulator list, a hardware hero image, a copied-in image gallery, a
Home page, and a Claro-style layout with a pinned action bar for the launcher's Museum app.

**Architecture:** Notes and gallery are a new per-system "personal" record (`system_personal`
table), stored apart from the museum entry so Reset never touches them. Gallery files are copied
into `<dataDir>/museum/<systemId>/` by main and served as `nextlevel://museum-image/…`. The
emulator list comes from settings already in the renderer, and the hardware image uses the
existing `nextlevel://art/assets/…` URL. Renderer work splits the current
`EntryView`/`EntryForm` into a hero, scrolling sections and a pinned footer.

**Tech Stack:** TypeScript ESM, Zod, Electron main + IPC router, better-sqlite3/Drizzle
migrations, React + TanStack Query + Tailwind, react-i18next, Vitest + Testing Library.

**Spec:** [docs/superpowers/specs/2026-11-16-museum-redesign-design.md](../specs/2026-11-16-museum-redesign-design.md)

## Global Constraints

- Requirement IDs: FR-MUS-6 (notes), FR-MUS-7 (emulators), FR-MUS-8 (hardware image + gallery),
  FR-MUS-9 (layout, Home, pinned bar), story US-G3. Every new test name starts with one of them.
- Notes: trimmed, ≤ 20000 chars, optional. Gallery: ≤ 50 images per system; caption trimmed
  ≤ 200, optional.
- Image files: extensions `png, jpg, jpeg, webp, gif` (case-insensitive); ≤ 20 MB (20 × 1024 ×
  1024 bytes) each; stored as `<uuid>.<lowercased ext>` in `<dataDir>/museum/<systemId>/`.
- Hardware image path: `art/hardware/<system display name>.png` under the assets root, built
  with `hardwarePaths(name)[0]` from `@nextlevel/themes` and `artUrl({ kind: 'assets' }, rel)`
  from `@nextlevel/shared`.
- Reset restores only the museum entry. Notes and gallery are never touched by Reset.
- "Edited" = a `system_info` row exists (unchanged meaning). "Changed" = the later of the
  `system_info` / `system_personal` `updated_at`.
- Contracts first (Zod in `packages/shared`), typed IPC only, atomic file writes, every string
  through `t()` with en + pt-BR keys, files < 400 lines, no new `any`.
- The renderer never sees a disk path: only file names (`<uuid>.<ext>`) and `nextlevel://` URLs.
  Rejected file reports carry the file's base name only.
- Commits: Conventional Commits, scopes `shared`, `launcher`, `docs`. End each message with
  `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. **A notes-only save must not create a `system_info` row.** Otherwise the entry is marked
   edited and frozen against seed updates. (Test in Task 6.)
2. **`museum-image` URLs with traversal or foreign names** (`..`, `%2e%2e`, backslashes, a file
   name not matching `<uuid>.<ext>`, an unknown system id) must 404 and never resolve outside
   `<dataDir>/museum/<systemId>/`. (Tests in Tasks 1 and 3.)
3. **Picking a mix of good and bad files** (one 25 MB PNG, one `.bmp`, two valid JPGs) adds the
   valid ones and reports the others by base name. Nothing half-copied is left behind. (Test in
   Task 3.)
4. **Switching system or going Home with unsaved notes/gallery** asks before discarding. On
   confirm, the files added in that session are cleaned up. (Test in Task 6.)
5. **System name with characters that are illegal in a URL or file name** (e.g. `Bandai Let's TV
   Play Classic`, `Acorn BBC Micro`) gets a correctly encoded hardware URL. A missing file shows
   the placeholder without layout shift. (Test in Task 5.)

---

### Task 1: Shared contracts

**Files:**
- Create: `packages/shared/src/systems/personal.ts`, `packages/shared/src/systems/personal.test.ts`
- Modify: `packages/shared/src/systems/info.ts` (summary schema), `packages/shared/src/ipc/systemInfoContract.ts`,
  `packages/shared/src/frontend/urls.ts`, `packages/shared/src/index.ts`,
  `packages/shared/src/ipc/contract.test.ts`, the existing urls test file next to `urls.ts`

**Interfaces:**
- Produces:
  - `MUSEUM_IMAGE_EXTENSIONS = ['png','jpg','jpeg','webp','gif'] as const`,
    `MUSEUM_IMAGE_MAX_BYTES = 20 * 1024 * 1024`, `MUSEUM_GALLERY_MAX = 50`
  - `MUSEUM_IMAGE_FILE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(png|jpg|jpeg|webp|gif)$/`
  - `SystemGalleryImageSchema = z.object({ file: z.string().regex(MUSEUM_IMAGE_FILE), caption: z.string().trim().min(1).max(200).optional() })`
  - `SystemPersonalSchema = z.object({ systemId: z.string().min(1).max(100), notes: z.string().trim().min(1).max(20000).optional(), gallery: z.array(SystemGalleryImageSchema).max(50).default([]) })`.
    Add a refine: gallery `file`s are unique.
  - `emptyPersonal(systemId: string): SystemPersonal` → `{ systemId, gallery: [] }`
  - Types `SystemGalleryImage`, `SystemPersonal`, `RejectedImage = { name: string; reason: 'type' | 'size' | 'unreadable' }`
  - `SystemInfoSummarySchema` gains `hasNotes: z.boolean()`, `changedAt: z.string().nullable()`
  - IPC channels (in `systemInfoContract`):
    - `'systems.personal.get'`: `{ systemId }` → `SystemPersonalSchema`
    - `'systems.personal.save'`: `{ systemId, personal: SystemPersonalSchema }` → `SystemPersonalSchema`
    - `'systems.personal.addImages'`: `{ systemId }` → `{ added: SystemGalleryImage[]; rejected: RejectedImage[] }`
    - `'systems.personal.cleanup'`: `{ systemId }` → `z.void()`
  - `museumImageUrl(systemId: string, file: string): string` → `nextlevel://museum-image/<encodeURIComponent(systemId)>/<file>`
  - `ParsedNextlevelUrl` gains `{ kind: 'museum-image'; systemId: string; file: string }`. The
    parse accepts only `systemId` matching the catalog `SYSTEM_ID` regex and `file` matching
    `MUSEUM_IMAGE_FILE`, with exactly two segments.

- [ ] **Step 1: Write failing tests**
  - `personal.test.ts`: `FR-MUS-6: notes are trimmed and capped at 20000` (20001 chars fails);
    `FR-MUS-8: gallery accepts <uuid>.png and rejects "../x.png", "a.bmp", duplicate files, 51 items`;
    `FR-MUS-8: caption is trimmed, ≤ 200`.
  - urls test: `FR-MUS-8: museumImageUrl round-trips through parseNextlevelUrl`; returns null for
    `nextlevel://museum-image/snes/..%2Fx.png`, `…/snes/notauuid.png`, `…/snes/<uuid>.png/extra`,
    `…/SNES!/<uuid>.png`.
  - `contract.test.ts`: the four new channels are in the contract, and the summary parses with
    `hasNotes`/`changedAt`.
- [ ] **Step 2: Run** `npm test -w packages/shared`. Expected: the new tests FAIL (missing exports).
- [ ] **Step 3: Implement** the schemas, constants, URL builder/parser branch, and contract
  entries above. Export from `index.ts`.
- [ ] **Step 4: Run** `npm test -w packages/shared && npm run typecheck`. Expected: shared tests
  PASS. Typecheck errors only in the launcher where `SystemInfoSummary` literals now lack
  `hasNotes`/`changedAt` and handlers lack the new channels. List them; Tasks 2–4 fix them.
  To keep each commit green, add `hasNotes: false, changedAt: null` to existing summary
  literals in tests now. Add stub handlers that throw `INTERNAL` for the four channels in
  `systemInfoHandlers.ts`; Task 4 replaces them.
- [ ] **Step 5: Run** `npm run typecheck && npm test`. Expected: PASS.
- [ ] **Step 6: Commit** `feat(shared): museum personal record, gallery image URLs (FR-MUS-6, FR-MUS-8)`

### Task 2: `system_personal` table and repository

**Files:**
- Modify: `apps/launcher/src/main/library/schema.ts` (add the table next to `systemInfo`, line ~269)
- Create: `apps/launcher/src/main/library/SystemPersonalRepository.ts`, `…/SystemPersonalRepository.test.ts`
- Create (generated): `apps/launcher/src/main/library/migrations/0019_*.sql` + meta
- Modify: `apps/launcher/src/main/library/SystemInfoRepository.ts` (add `updatedAtById()`)
- Modify: `apps/launcher/src/main/startLibrary.ts:248` (construct it) and the `library` type in `apps/launcher/src/main/handlers.ts` (`systemPersonal: SystemPersonalRepository`)

**Interfaces:**
- Consumes: `SystemPersonalSchema`, `emptyPersonal` (Task 1)
- Produces:
  - Table `system_personal (system_id TEXT PK, data TEXT NOT NULL, updated_at TEXT NOT NULL)`
  - `class SystemPersonalRepository { constructor(db: LibraryDb, clock: () => Date); get(systemId): SystemPersonal; save(personal: SystemPersonal): SystemPersonal; summary(): Map<string, { hasNotes: boolean; updatedAt: string }> }`.
    `get` returns `emptyPersonal` for a missing or invalid row. `save` of an empty record
    (no notes, empty gallery) deletes the row.
  - `SystemInfoRepository.updatedAtById(): Map<string, string>`

- [ ] **Step 1: Write failing tests** (same `tempLibrary` pattern as `SystemInfoRepository.test.ts`):
  `FR-MUS-6: get of an unknown system is the empty record`;
  `FR-MUS-6: save then get round-trips notes and gallery`;
  `FR-MUS-6: saving an empty record deletes the row (summary no longer lists it)`;
  `FR-MUS-6: a row that no longer validates reads as empty`;
  `FR-MUS-9: summary reports hasNotes and updatedAt`;
  `FR-MUS-9: SystemInfoRepository.updatedAtById lists edited entries' timestamps`.
- [ ] **Step 2: Run** `npx vitest run src/main/library/SystemPersonalRepository.test.ts -w apps/launcher` (or the package's test script with a filter). Expected: FAIL.
- [ ] **Step 3: Add the table to `schema.ts`, run `npm run db:generate -w apps/launcher`, implement the repository.**
- [ ] **Step 4: Run** the repository tests plus `src/main/library/migrate.test.ts` and `schema.test.ts`. Expected: PASS.
- [ ] **Step 5: Commit** `feat(launcher): store museum notes and gallery per system (FR-MUS-6)` including the migration.

### Task 3: Gallery image store and `museum-image` protocol

**Files:**
- Create: `apps/launcher/src/main/systems/MuseumImageStore.ts`, `…/MuseumImageStore.test.ts`
- Modify: `apps/launcher/src/main/protocol/register.ts` (new dep + branch), `apps/launcher/src/main/protocol/` tests for the handler
- Modify: `apps/launcher/src/main/index.ts` (construct the store with `join(dataDir, 'museum')`;
  wire `museumImage` into `createNextlevelHandler`; add `pickImages` next to `pickFile` at
  ~line 415, multi-select, filter `Images` with `MUSEUM_IMAGE_EXTENSIONS`, e2e override env
  `NEXTLEVEL_E2E_PICK_IMAGES`, a `;`-separated list, dev builds only)

**Interfaces:**
- Consumes: `MUSEUM_IMAGE_*`, `RejectedImage`, `SystemGalleryImage` (Task 1); `atomicWrite` is
  not used here (see Step 3)
- Produces:
  - `class MuseumImageStore { constructor(deps: { root: string; newId: () => string; fs?: … }); add(systemId: string, sources: readonly string[]): Promise<{ added: SystemGalleryImage[]; rejected: RejectedImage[] }>; path(systemId: string, file: string): Promise<string | null>; keepOnly(systemId: string, files: readonly string[]): Promise<void> }`
  - `NextlevelHandlerDeps.museumImage?: (systemId: string, file: string) => Promise<string | null>`. The handler serves the path with the existing `serveFile`, or 404.
  - `MainDeps.pickImages: (title?: string) => Promise<string[]>` (empty when cancelled)

- [ ] **Step 1: Write failing tests** (real temp dir):
  `FR-MUS-8: add copies a png into <root>/<systemId>/<uuid>.png and returns its file name`;
  `FR-MUS-8: add rejects .bmp as 'type', a 20 MB + 1 byte file as 'size', a missing path as 'unreadable', and still adds the valid ones` (Review Focus 3; rejected `name` is the base name);
  `FR-MUS-8: add uppercase .JPG stores .jpg`;
  `FR-MUS-8: a failed copy leaves no file and no .tmp behind`;
  `FR-MUS-8: path returns null for a file that doesn't exist or a name not matching MUSEUM_IMAGE_FILE`;
  `FR-MUS-8: keepOnly deletes unreferenced files and leaves the referenced ones`;
  `FR-MUS-8: keepOnly on a system with no folder is a no-op`.
  Protocol handler test: `FR-MUS-8: nextlevel://museum-image serves the stored file; traversal and unknown names 404` (Review Focus 2).
- [ ] **Step 2: Run** the new tests. Expected: FAIL.
- [ ] **Step 3: Implement.** Check the extension first, then `stat` size (reject before reading).
  Copy with `fs.copyFile` to `<target>.tmp`, then `rename`, removing the `.tmp` on failure.
  This is the binary equivalent of the atomic-write pattern and avoids loading 20 MB into
  memory. `mkdir -p` the system folder on first add. `path()` re-validates both segments and
  checks the resolved file is inside `<root>/<systemId>`. `keepOnly` logs and swallows errors.
- [ ] **Step 4: Run** the tests. Expected: PASS.
- [ ] **Step 5: Commit** `feat(launcher): copy museum gallery images into the data folder (FR-MUS-8)`

### Task 4: Personal IPC handlers and the summary fields

**Files:**
- Modify: `apps/launcher/src/main/systems/systemInfoHandlers.ts` (deps + four channels + list
  fields). If it passes 400 lines, move the personal channels to
  `apps/launcher/src/main/systems/systemPersonalHandlers.ts`, spread into the same place in
  `handlers.ts`.
- Modify: `apps/launcher/src/main/systems/systemInfoHandlers.test.ts`, `apps/launcher/src/main/handlers.ts:200-209`

**Interfaces:**
- Consumes: Tasks 1–3
- Produces handler deps: `personal: () => SystemPersonalRepository | null`,
  `images: Pick<MuseumImageStore, 'add' | 'keepOnly'>`, `pickImages: () => Promise<string[]>`
- Behavior:
  - `systems.info.list`: each row also has `hasNotes` and `changedAt = max(info updatedAt, personal updatedAt)` (ISO strings compare lexically), or null.
  - `systems.personal.get`: unknown system → `notFound`; without a library → `emptyPersonal`.
  - `systems.personal.save`: unknown system → `notFound`; `personal.systemId !== systemId` →
    `VALIDATION_FAILED`; no library → `LIBRARY_UNAVAILABLE`. Saves, then
    `images.keepOnly(systemId, gallery files)`, then emits `systems.infoChanged`.
  - `systems.personal.addImages`: unknown system → `notFound`. Calls `pickImages()`, then
    `images.add`. Does not save the record (the renderer's draft owns it until Save).
  - `systems.personal.cleanup`: `images.keepOnly(systemId, stored gallery files)`.

- [ ] **Step 1: Write failing tests** in `systemInfoHandlers.test.ts`, with the fake image store
  as a `vi.fn` object:
  `FR-MUS-9: list reports hasNotes and changedAt from both tables`;
  `FR-MUS-6: personal.save stores notes, prunes images and emits systems.infoChanged`;
  `FR-MUS-6: reset leaves the personal record untouched`;
  `FR-MUS-6: personal.save with a mismatched systemId fails VALIDATION_FAILED`;
  `FR-MUS-8: addImages returns added/rejected and does not save`;
  `FR-MUS-8: addImages when the dialog is cancelled returns empty lists`;
  `FR-MUS-8: cleanup keeps only the stored gallery's files`.
- [ ] **Step 2: Run** them. Expected: FAIL.
- [ ] **Step 3: Implement**, replacing the Task 1 stubs, and wire deps in `handlers.ts`
  (`personal: () => deps.library?.systemPersonal ?? null`, `images: deps.museumImages`,
  `pickImages: deps.pickImages`). Add `museumImages` to `MainDeps`.
- [ ] **Step 4: Run** `npm run typecheck && npm test -w apps/launcher`. Expected: PASS.
- [ ] **Step 5: Commit** `feat(launcher): museum notes and gallery IPC (FR-MUS-6, FR-MUS-8)`

### Task 5: Layout: left menu with Home, hero, pinned action bar

**Files:**
- Modify: `apps/launcher/src/renderer/features/museum/MuseumApp.tsx`, `SystemList.tsx`, `EntryView.tsx`, `EntryForm.tsx`
- Create: `apps/launcher/src/renderer/features/museum/HardwareImage.tsx`, `SystemHero.tsx`, `EntrySections.tsx` (the read-only sections moved out of `EntryView.tsx`), `ActionBar.tsx`
- Modify tests: `MuseumApp.test.tsx`, `EntryForm.test.tsx`; Create `HardwareImage.test.tsx`
- i18n: `packages/shared/src/i18n/en.json` and `pt-BR.json` under `apps.museum` (`home`, `noImage` already exists)

**Interfaces:**
- Produces:
  - `HardwareImage({ name, size: 'thumb' | 'card' | 'hero' })`: `<img src={artUrl({kind:'assets'}, hardwarePaths(name)[0])}>`, `loading="lazy"` for thumb/card. On error, or for an empty name, it shows a fixed-size placeholder with the system's initial (`data-testid="hardware-placeholder"`).
  - `SystemHero({ name, subtitle, action?: ReactNode })`
  - `ActionBar({ children })`: a non-scrolling footer (`shrink-0 border-t`), rendered as a
    sibling **after** the scroll container, never inside it.
  - `MuseumApp` view state: `type MuseumView = { kind: 'home' } | { kind: 'system'; systemId: string }`, initial `{ kind: 'home' }`. The dirty guard covers any view change.
  - `EntryForm` no longer renders its own buttons. It takes `formId: string` and the parent
    renders `ActionBar` with `<button type="submit" form={formId}>`. Alternatively, `EntryView`
    owns the save/discard handlers and passes them down. Either way, the bar lives outside the
    scrolling element.
- Layout: `EntryView` root is `flex min-w-0 flex-1 flex-col`: `SystemHero` (shrink-0), then
  `<div className="min-h-0 flex-1 overflow-y-auto p-5">` sections, then `ActionBar` in edit
  mode. Left menu: Home button (lucide `House`) above search, selected item/Home uses a filled
  rounded pill (`rounded-lg bg-white text-slate-900` style, as in the Claro reference), and
  each row has `HardwareImage size="thumb"`. The left column must not cause horizontal scroll
  at narrow widths (`min-w-0`, `truncate`).

- [ ] **Step 1: Write failing tests**
  `FR-MUS-9: the Museum opens on Home with the Home item current` (`aria-current="page"` on Home);
  `FR-MUS-9: picking a system shows its hero with name and "manufacturer · year"`;
  `FR-MUS-9: in edit mode Save/Discard are outside the scrolling region` (the `region`/scroll
  element with `data-testid="museum-scroll"` does not contain the Save button);
  `FR-MUS-9: going Home with unsaved edits asks before discarding`;
  `FR-MUS-8: HardwareImage builds nextlevel://art/assets/art/hardware/Bandai%20Let's%20TV%20Play%20Classic.png` (Review Focus 5, exact `artUrl` output) and `shows the placeholder after an image error`.
  Existing `MuseumApp.test.tsx` / `EntryForm.test.tsx` tests keep passing (update selectors only where the structure moved).
- [ ] **Step 2: Run** `npx vitest run src/renderer/features/museum` in `apps/launcher`. Expected: new tests FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** the museum tests, then `npm run lint && npm run typecheck`. Expected: PASS.
- [ ] **Step 5: Commit** `feat(launcher): museum home item, hero and pinned action bar (FR-MUS-9)`

### Task 6: Notes and Emulators sections; combined save/discard

**Files:**
- Create: `apps/launcher/src/renderer/features/museum/NotesSection.tsx`, `EmulatorsSection.tsx`, `EmulatorsSection.test.tsx`, `personalApi.ts`
- Modify: `museumApi.ts` (if shared helpers fit there), `EntryView.tsx`, `EntryForm.tsx`, `EntrySections.tsx`, tests
- i18n: `apps.museum.sections.notes`, `.sections.emulators`, `.field.notes`, `.emulatorsEmpty` (points to Settings → Emulators), `.resetMessage` updated to say notes and images are kept

**Interfaces:**
- Consumes: Task 1 channels, `useSettings()` from `../settings/settingsApi.ts`
- Produces:
  - `personalApi.ts`: `useSystemPersonal(systemId)`, `useSavePersonal()`, `useAddImages()`, `cleanupImages(systemId): Promise<void>`. Query key under `MUSEUM_KEY`, invalidated by the same events.
  - `emulatorsFor(settings: Settings, systemId: string): Array<{ emulator: Emulator; profiles: EmulatorProfile[] }>`, a pure function in `EmulatorsSection.tsx` (or a sibling `.ts`), ordered by emulator name, profiles by name.
  - `EntryForm` draft becomes `{ entry: SystemInfo; personal: SystemPersonal }`. Dirty means
    either one differs. Save validates both. It calls `systems.info.save` **only if the entry
    changed**, then `systems.personal.save` only if personal changed. Discard (button, or a
    confirmed switch/Home) calls `cleanupImages(systemId)` when personal was dirty.
- Section order (read and edit): Notes, Emulators, Overview, Story, Hardware, Models, Gallery
  (Task 7), Related, Top games, Sources. Emulators is read-only in edit mode too. Notes in read
  mode keep line breaks (`whitespace-pre-line`). In edit mode Notes is a textarea with at least
  8 rows.

- [ ] **Step 1: Write failing tests**
  `FR-MUS-7: emulatorsFor groups every profile listing the system under its emulator`;
  `FR-MUS-7: a system with no profiles shows the Settings hint`;
  `FR-MUS-7: an emulator listed by two profiles appears once with both profile names`;
  `FR-MUS-6: notes show first on the page`;
  `FR-MUS-6: saving only notes calls systems.personal.save and never systems.info.save` (Review Focus 1);
  `FR-MUS-6: discarding after adding images calls systems.personal.cleanup` (Review Focus 4);
  `FR-MUS-6: switching system with unsaved notes asks first`.
- [ ] **Step 2: Run** them. Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** museum tests + `npm run lint && npm run typecheck`. Expected: PASS.
- [ ] **Step 5: Commit** `feat(launcher): museum notes and emulator list (FR-MUS-6, FR-MUS-7)`

### Task 7: Gallery

**Files:**
- Create: `apps/launcher/src/renderer/features/museum/GallerySection.tsx` (read grid + viewer), `GalleryEditor.tsx`, `GalleryEditor.test.tsx`
- Modify: `EntryForm.tsx`, `EntrySections.tsx`
- i18n: `apps.museum.sections.gallery`, `.addImages`, `.caption`, `.galleryEmpty`, `.galleryFull`, `.imageRejected.type|size|unreadable` (with `{{name}}`), `.viewer.prev|next|close`

**Interfaces:**
- Consumes: `museumImageUrl` (Task 1), `useAddImages` (Task 6), the existing `RowControls` + `listOps.ts`, and the existing modal pattern in `../library/Modal.tsx`
- Produces: `GalleryEditor({ systemId, gallery, onChange })`, `GallerySection({ systemId, gallery })`
- Behavior: Add is disabled at 50 images. Added images append in pick order. If adding would
  pass 50, keep the first ones up to 50 and show `galleryFull`. Rejected files are listed
  inline with their reason. The viewer opens on a thumbnail click; ←/→ move, Esc closes, and
  focus returns to the thumbnail.

- [ ] **Step 1: Write failing tests**
  `FR-MUS-8: Add images appends returned files and shows rejected ones by name and reason`;
  `FR-MUS-8: captions edit and rows reorder/remove via RowControls`;
  `FR-MUS-8: Add is disabled at 50 images`;
  `FR-MUS-8: the viewer opens on click, arrows move, Esc closes`.
- [ ] **Step 2: Run** them. Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** museum tests + lint + typecheck. Expected: PASS.
- [ ] **Step 5: Commit** `feat(launcher): museum image gallery (FR-MUS-8)`

### Task 8: Home page

**Files:**
- Create: `apps/launcher/src/renderer/features/museum/MuseumHome.tsx`, `museumHome.ts` (pure selectors), `museumHome.test.ts`, `MuseumHome.test.tsx`
- Modify: `MuseumApp.tsx`
- i18n: `apps.museum.home`, `.recentlyChanged`, `.hasNotes`, `.counts` (`{{systems}}`, `{{edited}}`, `{{notes}}`, pluralized), `.featured`

**Interfaces:**
- Consumes: `SystemInfoSummary` with `hasNotes`/`changedAt` (Task 1), `HardwareImage`, `SystemHero` (Task 5)
- Produces:
  - `featuredSystem(systems): SystemInfoSummary | null` returns the max `changedAt`, else the first
    alphabetically (the list already arrives sorted), else null.
  - `recentlyChanged(systems, limit = 12)` sorts by `changedAt` desc, excluding nulls.
  - `withNotes(systems)` keeps the list order.
  - `MuseumHome({ systems, onOpen(systemId) })`: hero for the featured system (click opens
    it), the counts line, then the two card rows (horizontal scroll inside the row only; rows
    with no items are hidden).

- [ ] **Step 1: Write failing tests**
  `FR-MUS-9: featuredSystem prefers the latest changedAt, falls back to the first system, null when empty`;
  `FR-MUS-9: recentlyChanged sorts desc, caps at 12, skips never-changed`;
  `FR-MUS-9: Home hides empty rows and opens a system from a card`;
  `FR-MUS-9: counts show systems, edited and with-notes totals`.
- [ ] **Step 2: Run** them. Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** museum tests + lint + typecheck. Expected: PASS.
- [ ] **Step 5: Commit** `feat(launcher): museum home page (FR-MUS-9)`

### Task 9: Docs and final verification

**Files:**
- Modify: `docs/01-product/02-product-requirements.md` (FR-MUS-6…9 rows after FR-MUS-5, text
  from the spec's "Requirements to add", tagged `*2026-11-16, owner request.*`, priority M),
  `docs/01-product/03-user-stories.md` (US-G3 after US-G2), `docs/03-architecture/data-model.md`
  (`system_personal`, `<dataDir>/museum/`), `docs/03-architecture/api-spec.md` (four IPC
  channels, summary fields), `docs/03-architecture/05-architecture.md` (`museum-image` URL kind),
  `docs/02-design/screen-specifications.md` (Museum app section ~line 137: menu, hero, Home,
  sections order, pinned bar), `docs/01-product/roadmap.md` (status), `CHANGELOG.md` (Unreleased)

- [ ] **Step 1: Update the docs above.**
- [ ] **Step 2: Run** `npm run lint`, `npm run typecheck`, `npm test`. Expected: all PASS; capture the output for the PR.
- [ ] **Step 3: Run** `npm run test:e2e` if any Playwright spec covers the Museum (`grep -ril museum apps/launcher/e2e`). Expected: PASS, or no Museum spec.
- [ ] **Step 4: Launch** `npm run dev`, open the Museum, and check by eye: Home, picking a
  system, hero image, edit mode with the bar pinned while scrolling, adding 2 images,
  discarding (files removed from `<dataDir>/museum/<id>/`), saving notes (no blue dot
  appears), and a narrow window (no horizontal scroll).
- [ ] **Step 5: Commit** `docs: museum notes, emulators, gallery and home (FR-MUS-6..9, US-G3)`
