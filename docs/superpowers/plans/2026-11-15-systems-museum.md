# Systems Museum Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A museum entry per system (seeded from the owner's scraped data, editable locally), a
Museum desktop app to browse and edit it, and a museum page in the themes (PS5 first).

**Architecture:** A Zod `SystemInfo` schema in `packages/shared`; a committed seed
`packages/system-catalog/data/system-info.json` produced by a one-off import script; local edits
as whole-entry JSON rows in the library DB table `system_info`, merged over the seed in main;
`systems.info.*` IPC for the Museum app and `ThemeHost.getSystemInfo` for themes.

**Tech Stack:** TypeScript ESM, Zod 4, Drizzle + better-sqlite3 (library DB), Electron typed IPC,
React + TanStack Query (launcher renderer), React + motion (themes), Vitest + Testing Library,
fast-xml-parser (script only, already a devDependency of system-catalog).

**Spec:** `docs/superpowers/specs/2026-11-15-systems-museum-design.md`

## Global Constraints

- Work on branch `feat/systems-museum` (main is protected by habit; never commit to main).
- Contracts first: every schema/channel/event/ThemeHost type lands in Task 1 before code uses it.
- `packages/themes` and `packages/ui` never import Node or Electron; themes reach data only via `ThemeHost`.
- `packages/*` never import from `apps/*`.
- Nothing reads `E:\NextLevel\assets\system-info` or `../NextLevelOS` at runtime or build time; the script takes the folder as an argument and its output is committed.
- No scraped text in tests: fixtures are synthetic.
- Multi-row DB writes in a transaction; library migration generated with `npm run db:generate -w apps/launcher` and committed.
- Code files under 400 lines; split by responsibility.
- Every user-visible string through `t('…')`, keys added to `packages/shared/src/i18n/en.json` and `pt-BR.json`.
- Tests named with the requirement ID: `FR-MUS-n: …`.
- No new `any`; no disabled lint rules without a comment.
- Commits: Conventional Commits with scopes `shared`, `catalog`, `launcher`, `themes`, `docs`, ending with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Done = `npm run lint`, `npm run typecheck`, `npm test` all pass (show output).

## Requirement IDs (added in Task 1)

- **FR-MUS-1** Every catalog and custom system has a museum entry: overview, story, hardware, models, related, top games, sources; seeded from the shipped data.
- **FR-MUS-2** The Museum app lists every system and edits every field of its entry; edits are saved locally and replace the shipped entry; Reset restores it.
- **FR-MUS-3** Top games are a curated, ordered list of titles; a title is "owned" when pinned to a library game or when its normalized title matches a present game of that system.
- **FR-MUS-4** Themes read an entry through `ThemeHost.getSystemInfo`; a museum page opens from a focused system (`open-info`), shows the entry, and launches owned top games.
- **FR-MUS-5** Entries credit their sources; the page and the app show a Sources line.
- Story **US-G1** "Browse a system's history from the couch" · FR-MUS-1, FR-MUS-4, FR-MUS-5; **US-G2** "Curate a system's museum entry" · FR-MUS-2, FR-MUS-3 (new Epic G — Systems museum).
- Decision **D67**: museum seed bundled in system-catalog, local edits in library DB (whole-entry override), Showcase art files kept as fallback.

## Review Focus

1. **A system with no seed entry and no edit** (most of the 447 have no scraped file matched): `systems.info.get` returns `{ entry: { systemId }, edited: false }`, the app shows empty fields, the theme page shows the name and "No information yet" — never NOT_FOUND. Test in Task 5.
2. **A system id that does not exist** (deleted custom system, typo): `get`/`save`/`reset` throw `NOT_FOUND`; a stale `system_info` row for a deleted custom system is ignored by `list`. Test in Task 5.
3. **A pinned `gameId` that was removed or is now missing**: falls back to the title match, and to `owned: null` when none; launching never targets a missing game. Test in Task 4.
4. **Library unavailable** (no library yet): `systems.info.list`/`get` still return seed data with `edited: false`; `save`/`reset` fail with `LIBRARY_UNAVAILABLE`. Test in Task 5.
5. **Offline or broken model image URL**: the app and the theme page show a placeholder, not a broken image icon, and the layout does not jump. Tests in Tasks 7 and 9.

---

### Task 1: Contracts, requirement IDs

**Files:**
- Create: `packages/shared/src/systems/info.ts`, `packages/shared/src/systems/info.test.ts`
- Create: `packages/shared/src/ipc/systemInfoContract.ts`
- Modify: `packages/shared/src/ipc/contract.ts` (spread `systemInfoContract` next to `menuContract`), `packages/shared/src/ipc/events.ts` (add event), `packages/shared/src/index.ts` (export `./systems/info.ts`), `packages/shared/src/ipc/contract.test.ts`
- Modify: `packages/themes/src/host/ThemeHost.ts`, `packages/themes/src/host/FakeThemeHost.ts`
- Modify: `docs/01-product/02-product-requirements.md` (new section `## 6a. Systems museum (FR-MUS)` with the five rows above, P = M, "*2026-11-15, owner request.*"), `docs/01-product/03-user-stories.md` (Epic G with US-G1, US-G2)

**Interfaces — Produces:**
```ts
// packages/shared/src/systems/info.ts
const text = (max: number) => z.string().trim().min(1).max(max).optional();
export const SystemInfoModelSchema = z.object({
  name: z.string().trim().min(1).max(120),
  releaseYear: z.number().int().min(1900).max(2100).optional(),
  launchPrice: text(60), cpu: text(200), ram: text(200), notes: text(4000),
  imageUrl: z.url({ protocol: /^https?$/ }).optional(),
});
export const SystemInfoTopGameSchema = z.object({
  title: z.string().trim().min(1).max(200),
  year: z.number().int().min(1900).max(2100).optional(),
  gameId: z.number().int().positive().optional(),
});
export const SystemInfoSourceSchema = z.object({
  name: z.string().trim().min(1).max(120),
  url: z.url({ protocol: /^https?$/ }).optional(),
});
export const SystemInfoSchema = z.object({
  systemId: z.string().min(1).max(100),
  fullName: text(200), manufacturer: text(200), country: text(80),
  releaseYear: z.number().int().min(1900).max(2100).optional(),
  discontinuedYear: z.number().int().min(1900).max(2100).optional(),
  generation: text(40), unitsSold: text(80),
  description: text(20000), history: text(20000), legacy: text(20000),
  cpu: text(300), ram: text(300), graphics: text(300), sound: text(300), media: text(300), display: text(300),
  models: z.array(SystemInfoModelSchema).max(100).default([]),
  predecessor: text(200), successor: text(200),
  peripherals: z.array(z.string().trim().min(1).max(200)).max(100).default([]),
  topGames: z.array(SystemInfoTopGameSchema).max(100).default([]),
  sources: z.array(SystemInfoSourceSchema).max(20).default([]),
});
export const SystemInfoSeedFileSchema = z.object({ source: z.string(), entries: z.array(SystemInfoSchema) });
export const SystemInfoSummarySchema = z.object({
  systemId: z.string(), name: z.string(), kind: z.enum(SYSTEM_KINDS),
  manufacturer: z.string().nullable(), releaseYear: z.number().int().nullable(), edited: z.boolean(),
});
/** Top game as the theme page sees it. */
export const ResolvedTopGameSchema = SystemInfoTopGameSchema.extend({ owned: z.object({ gameId: z.number().int().positive() }).nullable() });
export const ThemeSystemInfoSchema = SystemInfoSchema.omit({ topGames: true }).extend({ topGames: z.array(ResolvedTopGameSchema) });
export type SystemInfo / SystemInfoModel / SystemInfoTopGame / SystemInfoSource / SystemInfoSummary / ResolvedTopGame / ThemeSystemInfo = z.output<…>;
/** Lowercase, drop a trailing "(…)" / "[…]" tag group, strip punctuation, collapse spaces. */
export function normalizeTitle(title: string): string;
```
```ts
// packages/shared/src/ipc/systemInfoContract.ts
const systemId = z.string().min(1).max(100);
export const systemInfoContract = {
  'systems.info.list': { input: z.void(), output: z.array(SystemInfoSummarySchema) },
  'systems.info.get': { input: z.strictObject({ systemId }), output: z.object({ entry: SystemInfoSchema, edited: z.boolean() }) },
  'systems.info.save': { input: z.strictObject({ systemId, entry: SystemInfoSchema }), output: SystemInfoSchema },
  'systems.info.reset': { input: z.strictObject({ systemId }), output: SystemInfoSchema },
  /** FR-MUS-4: the merged entry with owned top games resolved; null for an unknown system. */
  'systems.info.forTheme': { input: z.strictObject({ systemId }), output: ThemeSystemInfoSchema.nullable() },
} as const;
// events.ts: 'systems.infoChanged': z.object({ systemId: z.string() })
```
```ts
// ThemeHost.ts — add:
/** FR-MUS-4: a system's museum entry, owned top games resolved; null when unknown. */
getSystemInfo(systemId: string): Promise<ThemeSystemInfo | null>;
// HostEvent — add: | { type: 'system-info-changed'; systemId: string }
// FakeThemeHost: constructor option `systemInfo?: Record<string, ThemeSystemInfo>`; getSystemInfo returns it or null.
```

- [ ] **Step 1: Create branch** — `git switch -c feat/systems-museum`
- [ ] **Step 2: Write failing tests** in `info.test.ts`:
  - `FR-MUS-1: an entry with only systemId parses with empty lists` → `models`, `peripherals`, `topGames`, `sources` equal `[]`.
  - `FR-MUS-1: blank text fields are rejected, not stored` → `{ systemId: 'nes', manufacturer: '  ' }` fails.
  - `FR-MUS-5: a source url must be http(s)` → `url: 'javascript:alert(1)'` fails, `https://en.wikipedia.org/wiki/X` passes.
  - `FR-MUS-3: normalizeTitle ignores case, tags and punctuation` → `normalizeTitle('Super Mario Bros. 3 (USA) [!]') === normalizeTitle('super mario bros 3')`, and `'Mega Man 2'` ≠ `'Mega Man 3'`.
  - In `contract.test.ts`: `FR-MUS-2: systems.info.save validates the entry` → `{ systemId: 'nes', entry: { systemId: 'nes', releaseYear: 1700 } }` fails.
- [ ] **Step 3: Run** `npx vitest run packages/shared/src/systems packages/shared/src/ipc/contract.test.ts` — Expected: FAIL (module not found).
- [ ] **Step 4: Implement** the files above; add the requirement rows and stories to the docs.
- [ ] **Step 5: Run** the same command — Expected: PASS. Then `npm run typecheck` — Expected: errors only in `LauncherThemeHost.ts` (missing `getSystemInfo`) and main handlers (missing channels). Make them compile now with stubs that throw `NOT_IMPLEMENTED` via the existing `apps/launcher/src/main/ipc/withUnimplemented.ts` pattern for the channels, and `getSystemInfo: () => Promise.resolve(null)` in `LauncherThemeHost.ts`, so the tree stays green. Run `npm run typecheck` — Expected: PASS.
- [ ] **Step 6: Commit** — `feat(shared): system museum entry schema, IPC contract and ThemeHost call (FR-MUS-1..5)`

---

### Task 2: Import normalizer (pure)

**Files:**
- Create: `packages/system-catalog/scripts/systemInfo/normalize.ts`, `normalize.test.ts`
- Create: `packages/system-catalog/scripts/systemInfo/match.ts`, `match.test.ts`
- Create: `packages/system-catalog/scripts/systemInfo/launchboxXml.ts`, `launchboxXml.test.ts`

**Interfaces — Produces:**
```ts
// normalize.ts
export interface NormalizeResult { entry: Omit<SystemInfo, 'systemId'>; dropped: string[] }
/** One scraped JSON object → entry fields. Never throws; unknown keys go to `dropped`. */
export function normalizeScraped(raw: unknown): NormalizeResult;
// match.ts
/** A source name → catalog system id: exact name, then alias, then launchboxPlatform; case/punctuation-insensitive. */
export function matchSystemId(name: string, systems: readonly SystemDefinition[]): string | null;
// launchboxXml.ts
export interface LaunchBoxPlatformInfo { name: string; alternateNames: string[]; releaseYear?: number; manufacturer?: string; cpu?: string; ram?: string; graphics?: string; sound?: string; display?: string; media?: string; notes?: string }
export function parseLaunchBoxPlatforms(xml: string): LaunchBoxPlatformInfo[];
/** Fills only fields `entry` lacks; adds the LaunchBox source when it filled description. */
export function fillFromLaunchBox(entry: Omit<SystemInfo,'systemId'>, lb: LaunchBoxPlatformInfo): Omit<SystemInfo,'systemId'>;
```
Key mapping `normalizeScraped` must apply (first present wins):
- `fullName` ← `full_name` · `manufacturer` ← `manufacturer`, `brand`, `fabricante` · `country` ← `country_of_origin`, `country`, `país_de_origem`
- `releaseYear` ← `release_year`, `initial_release_year`, `first_release`, `ano_de_lançamento`, year in `releaseDate`, first year of `release_year_range`
- `discontinuedYear` ← `discontinued_year`, `ano_de_descontinuação`, year in `discontinuedDate`
- `generation`, `unitsSold` ← `units_sold`, `sales` · `description` ← `description`, `descrição`
- `history` ← `history_and_impact`, `impact` · `legacy` ← `legacy`, `legacyImpact`, `legado`
- `cpu`, `ram`/`memory`, `graphics`, `sound`, `media` ← `storage_media`, `media`, `mídia_de_armazenamento`, `display`
- `models` ← `models`, `modelos`, `modelsAndVariants`: `model_name`/`model`/`name` → name; `release_year`/`released` → releaseYear; `price_at_launch`, `price_at_launch_usd`, `price_uk` → launchPrice; `cpu`; `ram`/`memory`; `notes`/`description` → notes; `image_example`/`image` → imageUrl (dropped if not http(s))
- `predecessor`; `successor` ← `successor`, `notable_successor`; `peripherals` ← `peripherals`, `input_devices`
- `topGames` ← `notable_games`, `games_library`, `notable_software` (array of strings or `{title|name, year}`)
- Arrays given where text is expected are joined with `"; "`; numbers given as strings (`"1981"`) are parsed; out-of-range years dropped.
- `sources` = `[{ name: 'Wikipedia' }]` when `description`, `history` or `legacy` was set.

- [ ] **Step 1: Write failing tests** (synthetic fixtures only):
  - `FR-MUS-1: normalizes snake_case, camelCase and Portuguese keys` → three inputs (`release_year: 1981`, `releaseDate: '1981-06-01'`, `ano_de_lançamento: 1981`) all give `releaseYear: 1981`.
  - `FR-MUS-1: models map name, year, price and http image only` → `image_example: 'ftp://x'` dropped; `price_at_launch: '£399'` kept.
  - `FR-MUS-1: unknown keys are reported as dropped` → `{ name: 'X', custom_chips: 'Y' }` → `dropped` contains `'custom_chips'`.
  - `FR-MUS-1: non-object input gives an empty entry` → `normalizeScraped(42)` → `entry.models` `[]`, no throw.
  - `FR-MUS-5: Wikipedia source only when story text exists`.
  - `FR-MUS-1: matchSystemId matches name, alias, launchboxPlatform; null otherwise` (two-system inline catalog).
  - `FR-MUS-1: parses a two-platform LaunchBox XML` → release year from `<ReleaseDate>1993-10-04T…`, alternate names collected.
  - `FR-MUS-5: fillFromLaunchBox keeps existing fields and credits LaunchBox when it filled description` → sources contain `{ name: 'LaunchBox Games Database' }`.
- [ ] **Step 2: Run** `npx vitest run packages/system-catalog/scripts/systemInfo` — Expected: FAIL.
- [ ] **Step 3: Implement** the three modules (XML via `fast-xml-parser`, as `launchboxPlatforms.ts` does).
- [ ] **Step 4: Run** — Expected: PASS.
- [ ] **Step 5: Commit** — `feat(catalog): normalize scraped system info and LaunchBox platform metadata (FR-MUS-1, FR-MUS-5)`

---

### Task 3: Import runner, committed seed, seed accessor

**Files:**
- Create: `packages/system-catalog/scripts/importSystemInfo.ts`, `scripts/systemInfo/runImport.ts`, `runImport.test.ts`
- Create: `packages/system-catalog/data/system-info.json` (generated), `packages/system-catalog/src/systemInfo.ts`, `systemInfo.test.ts`
- Modify: `packages/system-catalog/src/index.ts` (export), `packages/system-catalog/package.json` (script `"import:system-info": "node --experimental-strip-types scripts/importSystemInfo.ts"`, export `"./data/system-info.json"`), `packages/system-catalog/README.md` (how to re-run; CC BY-SA note)

**Interfaces:**
- Consumes: Task 2 functions; `systemCatalog()`.
- Produces:
```ts
// runImport.ts — pure over its inputs, so it is testable without the disk
export interface ImportReport { matched: number; unmatched: string[]; unparseable: string[]; dropped: Record<string, string[]> }
export function runImport(files: { name: string; text: string }[], launchBoxXml: string | null, systems: readonly SystemDefinition[]): { seed: SystemInfoSeedFile; report: ImportReport };
// src/systemInfo.ts
export function systemInfoSeed(systemId: string): SystemInfo | undefined; // validated once, cached
export function systemInfoSeedIds(): readonly string[];
```
Rules: file name without `.json` is the source name; `00_lb_metadata.xml` is the XML; a JSON that fails `JSON.parse` goes to `unparseable`; two files matching one system → keep the one with more non-empty fields and list the other in `unmatched` with suffix ` (duplicate of <id>)`; LaunchBox platforms also match systems without a JSON file (entry from XML alone); entries sorted by `systemId`; `source` = `"owner scrape 2026 + LaunchBox Metadata.xml"`. The CLI (`importSystemInfo.ts <folder>`) reads the folder, calls `runImport`, writes the seed with the atomic-write helper style used by `scripts/seed.ts`, prints the report as JSON to stdout.

- [ ] **Step 1: Write failing tests**:
  - `FR-MUS-1: runImport matches, reports unparseable and unmatched` (3 synthetic files: one ok, one `{bad`, one unknown name).
  - `FR-MUS-1: an XML-only platform still produces an entry`.
  - `FR-MUS-1: duplicates keep the richer file`.
  - `systemInfo.test.ts` → `FR-MUS-1: the shipped seed validates and every id is a catalog system` (`systemInfoSeedIds().every(id => getSystem(id))`).
- [ ] **Step 2: Run** `npx vitest run packages/system-catalog` — Expected: FAIL.
- [ ] **Step 3: Implement** runner, CLI and accessor.
- [ ] **Step 4: Generate the seed** — `npm run import:system-info -w packages/system-catalog -- "E:/NextLevel/assets/system-info" > ../scratch-report.json` (report outside the repo). Expected: `matched` ≥ 150; inspect `unmatched` and `unparseable` (4 known broken files) and paste the counts into the commit body.
- [ ] **Step 5: Run** `npx vitest run packages/system-catalog` — Expected: PASS.
- [ ] **Step 6: Commit** — `feat(catalog): system museum seed imported from the owner's scraped data (FR-MUS-1)` with the report counts in the body.

---

### Task 4: Library table and repository

**Files:**
- Modify: `apps/launcher/src/main/library/schema.ts` (table), generate migration `apps/launcher/src/main/library/migrations/0018_*.sql`
- Create: `apps/launcher/src/main/library/SystemInfoRepository.ts`, `SystemInfoRepository.test.ts`
- Modify: `apps/launcher/src/main/startLibrary.ts` (construct and expose `systemInfo` next to `smartFilters`)

**Interfaces — Produces:**
```ts
// schema.ts
/** Museum entries the user edited (FR-MUS-2); `entry` is a SystemInfo as JSON. Replaces the seed. */
export const systemInfo = sqliteTable('system_info', {
  systemId: text('system_id').primaryKey(),
  entry: text('entry').notNull(),
  updatedAt: text('updated_at').notNull(),
});
// SystemInfoRepository.ts
export class SystemInfoRepository {
  constructor(db: LibraryDb, clock: () => Date);
  /** The edited entry, or null. A row that no longer validates is treated as null and logged by the caller. */
  get(systemId: string): SystemInfo | null;
  editedIds(): Set<string>;
  save(entry: SystemInfo): SystemInfo;      // upsert
  reset(systemId: string): void;            // delete row
  /** FR-MUS-3: owned game per top game: pinned id if present and not missing, else first present game of the system whose normalizeTitle(title) matches; null otherwise. */
  resolveTopGames(systemId: string, topGames: readonly SystemInfoTopGame[]): ResolvedTopGame[];
}
```
`resolveTopGames` runs one query for the system's present games (`games.missing = 0`, joined to `game_metadata.title`), builds a `Map<normalizedTitle, gameId>` keeping the lowest id, then maps.

- [ ] **Step 1: Write failing tests** (use the in-memory library helper in `apps/launcher/src/main/library/testing.ts`):
  - `FR-MUS-2: save then get returns the entry; reset removes it`.
  - `FR-MUS-2: save replaces the whole entry` (second save without `models` → `models` `[]`).
  - `FR-MUS-3: a pinned game wins over a title match`.
  - `FR-MUS-3: a pinned game that is missing falls back to the title match, else null` (Review Focus 3).
  - `FR-MUS-3: title match ignores region tags and case`.
  - `FR-MUS-2: a corrupt stored row reads as null`.
- [ ] **Step 2: Run** `npx vitest run apps/launcher/src/main/library/SystemInfoRepository.test.ts` — Expected: FAIL.
- [ ] **Step 3: Add the table, run** `npm run db:generate -w apps/launcher`, **implement** the repository and wire it in `startLibrary.ts`.
- [ ] **Step 4: Run** the test and `npx vitest run apps/launcher/src/main/library/migrate.test.ts apps/launcher/src/main/library/schema.test.ts` — Expected: PASS.
- [ ] **Step 5: Commit** — `feat(launcher): system_info table and repository for museum edits (FR-MUS-2, FR-MUS-3)`

---

### Task 5: Main handlers and merge

**Files:**
- Create: `apps/launcher/src/main/systems/systemInfoHandlers.ts`, `systemInfoHandlers.test.ts`, `apps/launcher/src/main/systems/mergeSystemInfo.ts`, `mergeSystemInfo.test.ts`
- Modify: `apps/launcher/src/main/handlers.ts` (replace Task 1 stubs; spread `createSystemInfoHandlers`)

**Interfaces:**
- Consumes: `SystemInfoRepository` (Task 4), `systemInfoSeed` (Task 3), `allSystems()` in `handlers.ts`.
- Produces:
```ts
// mergeSystemInfo.ts
/** Base entry: the shipped seed, or for a custom system its settings fields (manufacturer, releaseYear, description); else { systemId }. */
export function baseSystemInfo(system: SystemDefinition, custom: CustomSystem | undefined): SystemInfo;
// systemInfoHandlers.ts
export function createSystemInfoHandlers(deps: {
  systems: () => readonly SystemDefinition[];          // allSystems()
  customSystems: () => readonly CustomSystem[];
  repo: () => SystemInfoRepository | null;               // null when the library is unavailable
  emit: EmitEvent;
}): Pick<IpcHandlers, `systems.info.${string}`>;
```
Behavior: unknown `systemId` → `notFound()`; `save` checks `entry.systemId === systemId` (else `VALIDATION_FAILED`), saves, emits `systems.infoChanged`; `reset` deletes, emits, returns the base entry; `list` sorted by name (case-insensitive), `manufacturer`/`releaseYear` from the merged entry, ignoring rows for unknown systems; `forTheme` merges, then `repo.resolveTopGames` (or all `owned: null` with no library). With `repo()` null: `list`/`get`/`forTheme` serve base entries, `save`/`reset` throw `LIBRARY_UNAVAILABLE`.

- [ ] **Step 1: Write failing tests**:
  - `FR-MUS-1: get on a system with no seed returns { entry: { systemId }, edited: false }` (Review Focus 1).
  - `FR-MUS-1: a custom system's base entry uses its settings fields`.
  - `FR-MUS-2: an edit replaces the seed and is flagged edited; reset restores the seed and emits systems.infoChanged`.
  - `FR-MUS-2: unknown system → NOT_FOUND; mismatched entry.systemId → VALIDATION_FAILED` (Review Focus 2).
  - `FR-MUS-2: list ignores rows for systems that no longer exist`.
  - `FR-MUS-2: without a library, get serves the seed and save fails LIBRARY_UNAVAILABLE` (Review Focus 4).
  - `FR-MUS-4: forTheme resolves owned top games`.
- [ ] **Step 2: Run** `npx vitest run apps/launcher/src/main/systems` — Expected: FAIL.
- [ ] **Step 3: Implement** and wire in `handlers.ts` (remove the Task 1 stubs).
- [ ] **Step 4: Run** the tests plus `npx vitest run apps/launcher/src/main/handlers.test.ts apps/launcher/src/main/traceability.test.ts` — Expected: PASS.
- [ ] **Step 5: Commit** — `feat(launcher): systems.info IPC with seed merge and local edits (FR-MUS-1, FR-MUS-2, FR-MUS-4)`

---

### Task 6: Museum app — list and read-only entry

**Files:**
- Create: `apps/launcher/src/renderer/features/museum/museumApi.ts`, `MuseumApp.tsx`, `SystemList.tsx`, `EntryView.tsx`, `MuseumApp.test.tsx`
- Modify: `apps/launcher/src/renderer/apps/registry.ts` (`AppId` + entry: `id: 'museum'`, `titleKey: 'apps.museum.title'`, icon `Landmark` from lucide-react, `defaultSize: { width: 1200, height: 760 }`, `singleInstance: true`), i18n `en.json`/`pt-BR.json` (`apps.museum.*`)

**Interfaces — Produces:**
```ts
// museumApi.ts (pattern: features/menus/menusApi.ts)
export const MUSEUM_KEY = ['museum'] as const;
export function useSystemInfoList(): UseQueryResult<SystemInfoSummary[]>;        // invalidated on systems.infoChanged and settings.changed
export function useSystemInfo(systemId: string | null): UseQueryResult<{ entry: SystemInfo; edited: boolean }>;
export function useSaveSystemInfo(): UseMutationResult<SystemInfo, Error, { systemId: string; entry: SystemInfo }>;
export function useResetSystemInfo(): UseMutationResult<SystemInfo, Error, { systemId: string }>;
```
Layout: left `SystemList` (search box filters by name/manufacturer, kind select from `SYSTEM_KINDS`, rows show name, manufacturer · year, a dot when `edited`); right `EntryView` shows sections Overview, Story, Hardware, Models, Related, Top games, Sources; empty sections show `t('apps.museum.empty')`.

- [ ] **Step 1: Write failing tests** (use `test-utils.tsx` bridge fake):
  - `FR-MUS-2: lists systems and filters by text and kind`.
  - `FR-MUS-2: selecting a system shows its sections and sources line` (FR-MUS-5 asserted too).
  - `FR-MUS-2: the app opens from the registry`.
- [ ] **Step 2: Run** `npx vitest run apps/launcher/src/renderer/features/museum` — Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** — Expected: PASS.
- [ ] **Step 5: Commit** — `feat(launcher): Museum app lists systems and shows their entries (FR-MUS-2, FR-MUS-5)`

---

### Task 7: Museum app — editing

**Files:**
- Create: `apps/launcher/src/renderer/features/museum/EntryForm.tsx`, `ModelsEditor.tsx`, `TopGamesEditor.tsx`, `GamePicker.tsx`, `SourcesEditor.tsx`, `ModelImage.tsx`, `EntryForm.test.tsx`, `TopGamesEditor.test.tsx`
- Modify: `EntryView.tsx` (Edit button switches to `EntryForm`), i18n

Behavior: Edit → form with every field; Save validates with `SystemInfoSchema` client-side (errors under fields, like Settings), calls `useSaveSystemInfo`; Discard asks to confirm when dirty (reuse `features/menus/ConfirmDialog.tsx`); "Reset to original" visible when `edited`, confirms, calls reset. Lists (models, peripherals, top games, sources): add, remove, move up/down. `GamePicker` lists the system's games via `library.games.list` with `{ scope: { kind: 'system', systemId }, text }` (check `GameListQuerySchema` for the exact scope shape) and sets `gameId`; a linked row shows a "In your library" badge and an Unlink button. `ModelImage` renders `<img>` in a fixed-size box and swaps to a placeholder icon on `error` or when `imageUrl` is absent.

- [ ] **Step 1: Write failing tests**:
  - `FR-MUS-2: editing a field and saving sends the whole entry`.
  - `FR-MUS-2: an invalid year shows an error and does not save`.
  - `FR-MUS-2: reset asks to confirm, then restores the shipped entry`.
  - `FR-MUS-3: top games can be added, reordered, linked to a library game and unlinked`.
  - `FR-MUS-2: a broken model image shows the placeholder in the same box` (fire `error` on the img; Review Focus 5).
- [ ] **Step 2: Run** `npx vitest run apps/launcher/src/renderer/features/museum` — Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** — Expected: PASS.
- [ ] **Step 5: Commit** — `feat(launcher): edit, reset and curate top games in the Museum app (FR-MUS-2, FR-MUS-3)`

---

### Task 8: ThemeHost implementation and Showcase description

**Files:**
- Modify: `apps/launcher/src/renderer/features/frontend/LauncherThemeHost.ts` (+ its test): `getSystemInfo` → `bridge.invoke('systems.info.forTheme', { systemId })`; map `systems.infoChanged` to `{ type: 'system-info-changed', systemId }`
- Modify: `packages/themes/src/components/useSystemInfo.ts`, `useSystemInfo.test.tsx`, `packages/themes/src/showcase/ShowcaseTheme.tsx:82`

**Interfaces — Produces:**
```ts
/** FR-MUS-4: the museum entry for a system node, refreshed on system-info-changed; null while loading or unknown. */
export function useThemeSystemInfo(systemId: string | null, settleMs?: number): ThemeSystemInfo | null;
/** Description for Showcase: the museum description when `systemId` has one, else the art file by `name`. */
export function useSystemInfo(node: { name: string; systemId: string | null } | null, settleMs?: number): { description: string | null };
```

- [ ] **Step 1: Write failing tests**:
  - `FR-MUS-4: useSystemInfo prefers the museum description for a system node`.
  - `FR-MUS-4: falls back to system-info/<name>.json when the entry has no description` (existing art test kept).
  - `FR-MUS-4: useThemeSystemInfo reloads on system-info-changed for that system`.
  - Launcher host test: `FR-MUS-4: getSystemInfo calls systems.info.forTheme`.
- [ ] **Step 2: Run** `npx vitest run packages/themes/src/components/useSystemInfo.test.tsx apps/launcher/src/renderer/features/frontend` — Expected: FAIL.
- [ ] **Step 3: Implement**; update the Showcase call to pass the focused node.
- [ ] **Step 4: Run** the above plus `npx vitest run packages/themes/src/showcase` — Expected: PASS.
- [ ] **Step 5: Commit** — `feat(themes): read system museum entries through ThemeHost; Showcase prefers them (FR-MUS-4)`

---

### Task 9: Museum page component (themes)

**Files:**
- Create: `packages/themes/src/components/MuseumPage.tsx`, `MuseumPage.test.tsx`, `museum.css` (CSS variables only: `--museum-bg`, `--museum-fg`, `--museum-accent`, `--museum-muted`)
- Modify: i18n (`themes.museum.*`)

**Interfaces — Produces:**
```ts
export function MuseumPage(props: {
  open: boolean;
  enabled?: boolean;                 // as KeyHelpOverlay
  systemId: string | null;
  title: string;                     // node label, shown while loading / when empty
  logoCandidates: string[];
  input: InputSettings;
  onClose: () => void;
  onLaunch: (gameId: number) => void;
  className?: string;
}): JSX.Element | null;
```
Behavior: uses `useThemeSystemInfo`; header = logo (or title), line `manufacturer · releaseYear · country` (missing parts skipped); then description, Hardware (definition list, only filled rows), Models (cards: image via a placeholder-on-error img, name, year, launch price), Top games (owned ones focusable buttons, others plain text), Sources line. Input via `useInputActions` on its panel: `up`/`down` move focus among focusable rows and scroll (`scrollIntoView({ block: 'nearest' })`, guarded for jsdom), `select` on an owned game → `onLaunch(gameId)`, `back`/`menu` → `onClose`. An entry with nothing but `systemId` shows `t('themes.museum.empty')`.

- [ ] **Step 1: Write failing tests** (FakeThemeHost with `systemInfo`):
  - `FR-MUS-4: shows manufacturer · year · country and the description`.
  - `FR-MUS-4: an empty entry shows the title and the empty message` (Review Focus 1).
  - `FR-MUS-4: select on an owned top game launches it; unowned games are not focusable`.
  - `FR-MUS-4: back closes the page`.
  - `FR-MUS-5: shows the sources line`.
  - `FR-MUS-4: a broken model image becomes a placeholder` (Review Focus 5).
- [ ] **Step 2: Run** `npx vitest run packages/themes/src/components/MuseumPage.test.tsx` — Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** — Expected: PASS.
- [ ] **Step 5: Commit** — `feat(themes): museum page for a system (FR-MUS-4, FR-MUS-5)`

---

### Task 10: `info` action, `open-info` intent, PS5 wiring

**Files:**
- Modify: `packages/shared/src/settings/input.ts` (append `'info'` to `INPUT_ACTIONS` after `'switchTheme'`; keyboard default `['KeyI']`, gamepad `[]`), `packages/shared/src/settings/input.test.ts`
- Modify: `packages/themes/src/engine/types.ts` (`| { kind: 'open-info' }`), `packages/themes/src/engine/intentLabels.ts` (label key `themes.intent.openInfo`)
- Modify: `packages/themes/src/ps5/keymap.ts` (`info: 'open-info'`; add `'open-info'` to `HOME_HELP_INTENTS`), `packages/themes/src/ps5/Ps5Theme.tsx`, `packages/themes/src/ps5/HomeView.tsx`, `packages/themes/src/ps5/ps5.css`, `packages/themes/src/ps5/Ps5Theme.test.tsx`
- Modify: the Settings → Input UI only if it does not already render every `INPUT_ACTIONS` entry (check `apps/launcher/src/renderer/features/settings/`); add label `settings.input.actions.info`

Behavior (PS5 home only): `open-info` on a focused node with a `systemId` opens `MuseumPage` (theme input paused while open, like `KeyHelpOverlay`); on a node without one it does nothing. Hero gains a "…" button (`aria-label={t('themes.ps5.moreInfo')}`) after Explore. Home focus zones: `shelf` (default) and `hero`; `focus-down` from shelf → hero with Explore focused; `focus-next`/`focus-prev` move between Explore and "…"; `focus-up` → shelf; `enter` on Explore = current activate, on "…" = open museum page. `onLaunch` uses the engine's existing launch path (the one game levels use). If `Ps5Theme.tsx` would pass 400 lines, move the home zone logic into `ps5/useHomeZones.ts`.

- [ ] **Step 1: Write failing tests**:
  - `input.test.ts` → `FR-MUS-4: info defaults to I and no gamepad button; settings without it still parse` (old settings object lacking `info` gets the default).
  - `Ps5Theme.test.tsx` → `FR-MUS-4: I opens the museum page for a focused system and Back closes it`.
  - `FR-MUS-4: Down then Right then Select reaches the museum page`.
  - `FR-MUS-4: Up from the hero returns to the shelf with the same focus`.
  - `FR-MUS-4: open-info on a category does nothing`.
- [ ] **Step 2: Run** `npx vitest run packages/shared/src/settings/input.test.ts packages/themes/src/ps5` — Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** the above plus `npx vitest run packages/themes apps/launcher/src/renderer/features/settings` — Expected: PASS.
- [ ] **Step 5: Commit** — `feat(themes): open the museum page from the PS5 home (FR-MUS-4)`

---

### Task 11: Docs and full verification

**Files:**
- Modify: `docs/02-design/screen-specifications.md` (Museum app screen; PS5 home hero zones and museum page), `docs/02-design/themes-guide.md` (`system-info` art files are now a fallback; `open-info` intent), `docs/03-architecture/data-model.md` (`system_info` table; seed file), `docs/03-architecture/05-architecture.md` / `api-spec.md` IPC table (`systems.info.*`, `systems.infoChanged`), `docs/01-product/roadmap.md` (D67 and status), `CHANGELOG.md` (Unreleased: Systems museum)

- [ ] **Step 1: Update the docs** listed above, citing FR-MUS-1..5, US-G1/G2, D67, and the CC BY-SA note.
- [ ] **Step 2: Run** `npm run lint` — Expected: no errors.
- [ ] **Step 3: Run** `npm run typecheck` — Expected: no errors.
- [ ] **Step 4: Run** `npm test` — Expected: all pass, none skipped.
- [ ] **Step 5: Run** `npm run test:e2e` if any Playwright spec covers the PS5 home or the shell app list (check `apps/launcher/e2e`); Expected: pass.
- [ ] **Step 6: Commit** — `docs: systems museum requirements, screens, data model and D67 (FR-MUS-1..5)`
