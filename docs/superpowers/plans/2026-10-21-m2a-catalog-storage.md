# M2a System Catalog, Storage and Systems Settings Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the system catalog: all 438 NextLevelOS systems with stable ids, built by a reproducible seed script. Users can add, order and rename storage locations, and enable systems and override a system's folder name and extensions, all in Settings.

**Architecture:**
- `packages/system-catalog` holds a committed, validated `data/systems.json` and a typed loader. The JSON is produced by `packages/system-catalog/scripts/seed.ts` from three inputs, each passed as a path argument: NextLevelOS `launchers.json`, NextLevelOS `config.json` (global extension list) and `screenscraper.json`, plus ES-DE's `es_systems.xml`. Nothing reads `../NextLevelOS` at runtime.
- Settings gains `storage.locations` and `systems`.
- The Settings app gets **Storage** and **Systems** sections built on a shared `useSettingsDraft` hook (draft + save bar), refactored out of `SettingsForm`.

**Tech Stack:** Existing stack, plus `@tanstack/react-virtual` for the system list and `fast-xml-parser` (dev-only, seed script).

**Spec:**
- FR-EMU-1, FR-LIB-1, FR-LIB-2, FR-SET-1, FR-SET-2, NFR-A11Y-1.
- Data model §1 (identity), §2 (settings: `storage`, `systems`) and §3 (system catalog).
- ADR-011 (stable ids) and ADR-004.
- IA §1 Settings sections (Storage, Systems).
- CLAUDE.md (seed data is copied through a script and committed).
- **Owner decisions 2026-10-21:**
  - All 438 NextLevelOS systems are enriched by the seed script.
  - Extensions come from ES-DE `es_systems.xml` (MIT) where names match, then the NextLevelOS per-system `romext`, then the global `scanExtensions`.
  - Manufacturer, year and kind are filled only where reliably known.
  - The Game Library keeps the NextLevelOS look (M2c).

## Global Constraints

- **System ids** are lowercase slugs of the NextLevelOS name: ASCII and digits, with runs of other characters collapsed into one `-` (`Nintendo 64` → `nintendo-64`). They are permanent once released (ADR-011). The original name goes into `aliases` and `defaultFolderName`.
- **Extensions** are lowercase, without the dot, unique per system, and every system has at least one.
- **`SystemDefinition` changes from data model §3** (doc updated in Task 1):
  - `manufacturer` becomes optional.
  - `kind` gains a value: it stays `'console' | 'handheld' | 'arcade' | 'computer' | 'pinball' | 'engine' | 'other'`, with `'other'` used when it is unknown.
  - `presetProfiles` is `[]` until M3.
- **Seeding:** the seed script is dev-only. It never runs in tests or CI against `../NextLevelOS`, and its pure mapping functions are tested on fixtures. `es_systems.xml` is downloaded by the developer to a scratch folder at a pinned ES-DE release, and the release tag is recorded in the generated file's `source` field. ES-DE's MIT notice goes in `packages/system-catalog/NOTICE.md`.
- **Storage locations:**
  - Fields are `{ id: uuidv7, name, path, priority }`.
  - Array order is priority, and `priority` is renumbered 1..n on save.
  - Paths must be absolute and unique, compared case-insensitively.
  - Names are 1–40 characters and unique.
- **System settings:** `systems: Record<systemId, { enabled: boolean; folderName?: string; extensions?: string[] }>`.
  - Unknown system ids are kept, not stripped, so a newer catalog's ids survive a downgrade.
  - `folderName` is 1–120 characters and contains none of `<>:"/\|?*`.
  - Extensions follow the catalog rule.
- New IPC channels: `systems.catalog` (input void, output `SystemDefinition[]`) and `app.pickFolder` (input `{ title?: string }`, output `string | null`).
- Strings go into both `en.json` and `pt-BR.json`. Components ≤ 200 lines. Tests carry requirement IDs. Branch `feat/m2a-catalog-storage`.

## Review Focus

1. **Two NextLevelOS names that slug to the same id** (`Sega Mega Drive` vs `Sega Mega-Drive`). The seed must fail loudly, never silently overwrite. Pinned in Task 2.
2. **The ES-DE fullname differs from the NextLevelOS name** (`Nintendo Entertainment System` vs `Nintendo NES`). The match uses normalized names plus a small explicit alias map in the script, and the seed report lists the unmatched systems. Pinned in Task 2.
3. **Adding a storage location** whose path differs from an existing one only by case or a trailing slash (`E:\roms` vs `e:/roms/`). Rejected as a duplicate with a field error. Pinned in Task 1.
4. **The Systems list with 438 rows on a keyboard.** Search filters it, the toggle is reachable by Tab, and the list is virtualized (no 438 mounted rows). Pinned in Task 7.
5. **Removing the last storage location** while systems are enabled. Allowed: settings stay valid, and Storage shows an empty-state hint. Scanning simply finds nothing (M2b). Pinned in Task 6.

---

### Task 1: Contracts: catalog schema, storage and systems settings, IPC, docs

**Files:**
- Create: `packages/shared/src/catalog/schema.ts` (+ test)
- Modify: `packages/shared/src/settings/schema.ts` (+ test), `packages/shared/src/ipc/contract.ts` (+ test), `packages/shared/src/index.ts`, both locale files
- Docs: `docs/03-architecture/data-model.md` §2 and §3, `docs/03-architecture/api-spec.md` §3

**Interfaces:**
- `SystemDefinitionSchema = z.object({ id: z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/), name, shortName?, manufacturer?, releaseYear?: int, kind: z.enum([...]), extensions: z.array(z.string().regex(/^[a-z0-9]+$/)).min(1), defaultFolderName, multiDisc?: boolean, scraper: { screenscraperId?: int }, presetProfiles: z.array(z.string()), aliases: z.array(z.string()) })`
- `type SystemDefinition`, `SystemCatalogSchema = z.object({ source: z.string(), systems: z.array(SystemDefinitionSchema) })`.
- `StorageLocationSchema = z.object({ id: z.uuid(), name: z.string().trim().min(1).max(40), path: z.string().min(3), priority: z.number().int().min(1) })`.
- Refinement on `storage.locations`:
  - Paths are absolute (`/^[a-zA-Z]:[\\/]/` or a UNC path starting `\\`).
  - Paths and names are unique, with paths compared by `normalizePath(p)` = lowercase, `/`→`\`, trailing `\` stripped.
  - Issues are reported at `['storage','locations',i,'path'|'name']`.
- `SystemSettingsSchema = z.object({ enabled: z.boolean().default(false), folderName: z.string().trim().min(1).max(120).regex(/^[^<>:"/\\|?*]+$/).optional(), extensions: z.array(z.string().regex(/^[a-z0-9]+$/)).min(1).optional() })`.
- `SettingsSchema` gains `storage: z.object({ locations: z.array(StorageLocationSchema).default([]) }).prefault({})` and `systems: z.record(z.string(), SystemSettingsSchema).default({})`.
- `normalizePath(path: string): string` and `orderedLocations(locations): StorageLocation[]`, which renumbers priority 1..n by array order, are exported from shared.
- Contract: `'systems.catalog'` and `'app.pickFolder'` as in Global Constraints.

- [ ] **Step 1: Write the failing tests:**
  - `'FR-EMU-1: catalog ids must be slugs'`.
  - `'FR-EMU-1: a system needs at least one lowercase, dotless extension'`.
  - `'FR-LIB-1: storage locations default to none'`.
  - `'FR-LIB-1: a duplicate path differing only by case or trailing slash is rejected at that location path'` (Review Focus 3).
  - `'FR-LIB-1: relative paths are rejected'`.
  - `'FR-LIB-2: a folder name with : is rejected'`.
  - `'FR-LIB-2: extension overrides must be lowercase without dots'`.
  - `'unknown system ids are kept'`.
  - `'orderedLocations renumbers priority by order'`.
  - Contract: `app.pickFolder` accepts `{}` and `{ title: 'x' }` and rejects `{ path: 'C:/' }`.
- [ ] **Step 2: Run them to see them fail.** Run `npx vitest run packages/shared`. Expected: FAIL.
- [ ] **Step 3: Implement.** Update the docs as listed.
- [ ] **Step 4: Run them to see them pass.** Run `npx vitest run packages/shared; npm run typecheck`. Expected: PASS. Launcher handlers for the new channels arrive in Task 4; `withUnimplemented` keeps tests compiling. `main/index.ts` uses `createHandlers`, so it needs real handlers for every channel to typecheck. Add `'systems.catalog': () => []` and `'app.pickFolder': () => null` as placeholders; Task 4 replaces them.
- [ ] **Step 5: Commit** `feat(shared): system catalog, storage location and system settings schemas (FR-EMU-1, FR-LIB-1, FR-LIB-2)`.

### Task 2: Seed mapping functions (pure, tested on fixtures)

**Files:**
- Create: `packages/system-catalog/scripts/mapping.ts`, `mapping.test.ts`, `packages/system-catalog/scripts/fixtures/` (tiny `launchers.json`, `config.json`, `screenscraper.json`, `es_systems.xml` with 4–5 systems)
- Modify: `packages/system-catalog/package.json` (devDep `fast-xml-parser`), `packages/system-catalog/tsconfig.json` (include `scripts`)

**Interfaces:**
- `slugify(name: string): string`
- `parseEsSystems(xml: string): EsSystem[]` with `EsSystem = { name: string; fullname: string; extensions: string[] }`. Extensions are lowercased, dots stripped and deduplicated.
- `ES_ALIASES: Record<string, string>` maps a NextLevelOS name to an ES-DE `name`, for known mismatches. Start with the mismatches the first real seed reports, and keep the map small and commented.
- `buildCatalog(input: { launchers: Record<string, { romext?: string[] | string }>; globalExtensions: string[]; screenscraper: Record<string, number>; esSystems: EsSystem[]; source: string }): { catalog: SystemCatalog; report: { unmatchedEs: string[]; fallbackExtensions: string[] } }`
  - Systems are sorted by name.
  - The extension precedence is: ES-DE match (normalized fullname, alias map, then ES `name`), then `romext`, then `globalExtensions`.
  - `manufacturer` comes from `KNOWN_MANUFACTURERS`, a list of name prefixes such as `Nintendo`, `Sega`, `Sony`, `Atari`, `NEC`, `SNK`, `Commodore`, `Amstrad`, `Acorn`, `Apple`, `Bandai`, `Microsoft`, `Philips`, `Mattel`, `Coleco`, `Magnavox`, `Fujitsu`, `Sharp`, `Panasonic`, `Texas Instruments`, `Tiger`, `Casio`, `Epoch`, `Emerson`, `Fairchild`, `Entex`, `Watara`, `VTech`, `Tandy`, `Sinclair`, `Thomson`, `Dragon`, `Oric`, `Enterprise`, `Exidy`, `Hartung`, `Funtech`, `GCE`, `Interton`, `RCA`, `Bally`, `Benesse`, `Konami`, `Capcom`, `Namco`, `Taito`, `Irem`, `Data East`, `Midway`, `Williams`, `Gottlieb`, `Stern`, `Zinc`.
  - `kind` is `'arcade'` when the name contains `Arcade`, `MAME`, `Naomi`, `Atomiswave`, `Model 2`, `Model 3`, `CPS` or `Neo Geo MVS`; `'pinball'` when it contains `Pinball`; otherwise `'other'`. Leave hand-curation for later.
  - `screenscraperId` comes from `screenscraper.json` by name.
  - It throws `Error('duplicate system id …')` on a slug collision.

- [ ] **Step 1: Write the failing tests** on the fixtures:
  - `'FR-EMU-1: slugs are lowercase hyphenated ascii'` (`'Nintendo 64'`→`'nintendo-64'`, `'Sega Mega-Drive / Genesis'`→`'sega-mega-drive-genesis'`, `'Pokémon Mini'`→`'pokemon-mini'`).
  - `'two names with the same slug fail the seed'` (Review Focus 1).
  - `'extensions come from ES-DE when the fullname matches, else romext, else the global list'`.
  - `'an alias maps a renamed system to its ES-DE entry'` (Review Focus 2).
  - `'the report lists systems that fell back to the global list'`.
  - `'known manufacturers and arcade kinds are filled; unknown ones stay empty/other'`.
  - `'the result validates against SystemCatalogSchema'`.
- [ ] **Step 2: Run them to see them fail.** Run `npx vitest run packages/system-catalog`. Expected: FAIL.
- [ ] **Step 3: Implement** `mapping.ts`.
- [ ] **Step 4: Run them to see them pass.** Run `npx vitest run packages/system-catalog`. Expected: PASS.
- [ ] **Step 5: Commit** `feat(catalog): system catalog seed mapping (FR-EMU-1)`.

### Task 3: Run the seed; commit the catalog and loader

**Files:**
- Create: `packages/system-catalog/scripts/seed.ts` (CLI: `node --experimental-strip-types seed.ts --launchers <p> --config <p> --screenscraper <p> --es-systems <p> --source "es-de vX.Y.Z" --out data/systems.json`; writes JSON and prints the report)
- Create: `packages/system-catalog/data/systems.json` (generated), `packages/system-catalog/src/index.ts` (loader), `src/index.test.ts`, `NOTICE.md`, `README.md` (how to regenerate)
- Modify: `packages/system-catalog/package.json` (`"seed"` script; export `./data/systems.json`)

**Interfaces:**
- `systemCatalog(): readonly SystemDefinition[]` parses `data/systems.json` with `SystemCatalogSchema` once (cached) and returns the systems.
- `getSystem(id: string): SystemDefinition | undefined`.
- `effectiveSystem(def: SystemDefinition, settings?: SystemSettings): { folderName: string; extensions: string[]; enabled: boolean }` (FR-LIB-2 defaults vs overrides).

- [ ] **Step 1: Write the failing tests** (`src/index.test.ts`):
  - `'FR-EMU-1: the shipped catalog is valid and has unique ids'`.
  - `'FR-EMU-1: it covers every NextLevelOS system'` (count equals 438, a constant documented in the README).
  - `'FR-LIB-2: effectiveSystem uses overrides, else catalog defaults'`.
  - `'nintendo-64 accepts z64'` (ES-DE match sanity check).
- [ ] **Step 2: Run them to see them fail.** Run `npx vitest run packages/system-catalog`. Expected: FAIL (no data).
- [ ] **Step 3: Seed.**
  - Download the pinned ES-DE `resources/systems/windows/es_systems.xml` into the scratchpad.
  - Run the seed with the read-only NextLevelOS paths.
  - Add aliases for the reported mismatches where an obvious ES-DE system exists, then re-run.
  - Commit the JSON. Paste the final report (counts) into the commit message.
- [ ] **Step 4: Run them to see them pass.** Run `npx vitest run packages/system-catalog`. Expected: PASS.
- [ ] **Step 5: Commit** `feat(catalog): seed 438 systems from NextLevelOS and ES-DE (FR-EMU-1)`.

### Task 4: Main handlers: `systems.catalog` and `app.pickFolder`

**Files:**
- Modify: `apps/launcher/src/main/handlers.ts` (+ test), `apps/launcher/src/main/index.ts`, `apps/launcher/package.json` (dep `@nextlevel/system-catalog`), `apps/launcher/electron.vite.config.ts` (bundle the workspace package)

**Interfaces:**
- `MainDeps` gains `catalog: () => readonly SystemDefinition[]` and `pickFolder: (title?: string) => Promise<string | null>`. The latter is `dialog.showOpenDialog({ properties: ['openDirectory'] })` in `index.ts`.

- [ ] **Step 1: Write the failing tests:** `'FR-EMU-1: systems.catalog returns the catalog'` and `'FR-LIB-1: app.pickFolder returns the chosen folder or null'`.
- [ ] **Step 2: Run them to see them fail.** Run `npx vitest run apps/launcher/src/main`. Expected: FAIL.
- [ ] **Step 3: Implement.** Remove the Task 1 placeholders.
- [ ] **Step 4: Run them to see them pass.** Run `npm run lint; npm run typecheck; npm test; npm run test:e2e`. Expected: all exit 0.
- [ ] **Step 5: Commit** `feat(launcher): systems.catalog and folder picker channels (FR-EMU-1, FR-LIB-1)`.

### Task 5: `useSettingsDraft` refactor

**Files:**
- Create: `features/settings/form/useSettingsDraft.ts`
- Modify: `features/settings/form/SettingsForm.tsx` (uses the hook; behavior unchanged)

**Interfaces:**
- `useSettingsDraft(snapshot: SettingsSnapshot, { onSaved, onNotice })` returns `{ draft, setDraft(update: (s: Settings) => Settings), errors: Record<string, string>, valid, dirty, save(), discard(), saving }`.
  - It carries the CONFLICT handling and focus-after-save from M1b.
  - `SaveBar` is rendered by the caller.
- `SettingsSection({ children })` is a wrapper that renders the keyed body, notice and `SaveBar`. A custom section only renders fields bound to `draft` and `setDraft`.

- [ ] **Step 1: Run the existing tests to confirm they're green before the refactor.** Run `npx vitest run apps/launcher/src/renderer/features/settings`. Expected: PASS.
- [ ] **Step 2: Refactor** `SettingsForm` onto `useSettingsDraft` and `SettingsSection`.
- [ ] **Step 3: Run them to confirm they're still green.** Run the same command. Expected: PASS, with no test changes.
- [ ] **Step 4: Commit** `refactor(launcher): extract useSettingsDraft for custom settings sections`.

### Task 6: Settings → Storage

**Files:**
- Create: `features/settings/StorageSection.tsx`, `StorageSection.test.tsx`
- Modify: `SettingsApp.tsx` (section order General, Storage, Systems, Backups, Data & logs, About), locales, `settingsApi.ts` (`usePickFolder` mutation)

**Interfaces:**
- **Location rows** show the priority number, a name `<input>` (aria-label "Name of location {{n}}") with its error, the path (read-only `<code>`), and Move up / Move down / Remove buttons. The aria-labels include the location name.
- **Add location…** calls `app.pickFolder`. On a path it appends `{ id: uuidv7(), name: <last path segment>, path, priority }` to the draft, and `orderedLocations` renumbers. Use `uuid` v11 `v7`, added as a launcher dependency.
- The section intro text explains priority ("the first location that contains a game wins").
- The empty state reads "No storage locations yet. Add the folders that hold your systems' ROM folders."
- Save goes through the normal save bar, and duplicate path errors appear under the row.

- [ ] **Step 1: Write the failing tests:**
  - `'FR-LIB-1: Add location picks a folder and adds a row named after it; Save sends it with priority 1'`.
  - `'FR-LIB-1: Move up reorders and renumbers priorities'`.
  - `'FR-LIB-1: a duplicate path shows a field error and disables Save'`.
  - `'removing the last location shows the empty state and still saves'` (Review Focus 5).
  - `'cancelling the folder picker changes nothing'`.
- [ ] **Step 2: Run them to see them fail.** Run `npx vitest run apps/launcher`. Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run them to see them pass.** Run `npx vitest run apps/launcher`. Expected: PASS.
- [ ] **Step 5: Commit** `feat(launcher): Settings Storage section (FR-LIB-1)`.

### Task 7: Settings → Systems

**Files:**
- Create: `features/settings/systems/SystemsSection.tsx`, `SystemRow.tsx`, `SystemEditor.tsx`, `filterSystems.ts` (+ tests), `SystemsSection.test.tsx`
- Modify: `settingsApi.ts` (`useSystemCatalog` query, `staleTime: Infinity`), launcher `package.json` (dep `@tanstack/react-virtual`), locales

**Interfaces:**
- `filterSystems(systems, query, settings, show: 'all' | 'enabled'): SystemDefinition[]` does a case-insensitive match on name, shortName, manufacturer or id.
- The section has a search input, an "Enabled only" toggle, a count ("{{enabled}} of {{total}} enabled"), and a virtualized list (`useVirtualizer`, row height 56).
- **Each row** shows the name, manufacturer · year, and the effective folder name, plus:
  - an enable switch with an aria-label including the system name;
  - an **Edit** button that expands an inline `SystemEditor`. The editor has a folder name input (placeholder = catalog default; empty means use the default) and an extensions input (comma-separated, normalized on blur to lowercase without dots; empty means use the default). Each shows its field errors from the draft and has a **Reset to defaults** button.
- Writing to the draft creates `systems[id]` lazily, and an entry equal to the defaults (`enabled: false`, no overrides) is removed so settings stay small.

- [ ] **Step 1: Write the failing tests:**
  - `filterSystems`: name, manufacturer and enabled-only cases.
  - `SystemsSection.test.tsx`:
    - `'FR-EMU-1: enabling a system and saving writes systems[id].enabled'`.
    - `'NFR-A11Y-1: search narrows the list and the list is virtualized'` (with 438 catalog entries, fewer than 60 rows are rendered; a jsdom row-size stub is needed, so set the scroll element's `clientHeight`).
    - `'FR-LIB-2: editing folder name and extensions saves overrides; invalid extension shows an error'`.
    - `'Reset to defaults removes the overrides'`.
- [ ] **Step 2: Run them to see them fail.** Run `npx vitest run apps/launcher`. Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run them to see them pass.** Run `npm run lint; npm run typecheck; npm test`. Expected: all exit 0.
- [ ] **Step 5: Commit** `feat(launcher): Settings Systems section with catalog search and overrides (FR-EMU-1, FR-LIB-2)`.

### Task 8: E2E and docs

**Files:**
- Modify: `apps/launcher/e2e/settings.spec.ts` (new test), `CHANGELOG.md`, `docs/01-product/roadmap.md` (M2 ◐), `packages/system-catalog/README.md`

- [ ] **Step 1: Write the e2e test** `'FR-EMU-1/FR-LIB-2: enable a system and override its folder; it persists across restart'`:
  - Open Settings → Systems, search "Nintendo 64", enable it, edit the folder name to `N64`, and save.
  - Restart with the same data dir. The row shows `N64` and is enabled.
  - Storage: add a location via a stubbed picker. In e2e, set `NEXTLEVEL_E2E_PICK_FOLDER=<temp dir>` so main's `pickFolder` returns it without a dialog, and only when not packaged. Save. The row shows that path.
- [ ] **Step 2: Run it.** Run `npm run test:e2e`. Expected: all pass, twice in a row.
- [ ] **Step 3: Update the docs.** The CHANGELOG entry covers the catalog (438 systems, ES-DE attribution) and the Storage and Systems sections. Mark roadmap M2 ◐.
- [ ] **Step 4: Verify everything.** Run `npm run lint; npm run typecheck; npm test; npm run test:e2e`. Expected: all exit 0.
- [ ] **Step 5: Commit** `test(launcher): e2e for systems and storage settings; docs: M2a`.
