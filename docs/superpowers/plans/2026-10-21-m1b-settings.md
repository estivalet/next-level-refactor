# M1b Settings Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Launcher settings that live in `settings.json`, are validated by one Zod schema, are saved atomically with 10 rotating backups, and can be restored, exported and imported. They are edited in a schema-driven Settings app (General, Backups, Data & logs, About), with live English/Português switching and a recovery screen when the file is unreadable. This completes M1.

**Architecture:**
- `SettingsSchema` in `packages/shared` defines the shape, the defaults and the form metadata (`.meta({ labelKey, helpKey })`).
- `SettingsService` in main owns the file. It loads, migrates and validates; it saves atomically with a backup of the previous file; it keeps an in-memory `revision` so stale saves return `CONFLICT`. It takes its dependencies through the constructor (`dir`, `fs`, `clock`, dialogs).
- The renderer reads and writes through TanStack Query hooks. Forms are generated from schema metadata, and the same schema validates in the renderer (field errors) and in main (authoritative).

**Tech Stack:** Existing stack plus `electron-log`.

**Spec:**
- FR-SET-1..4 and FR-SET-7, US-D3, NFR-REL-1, NFR-I18N-1 (pt-BR now, owner decision 2026-10-21), NFR-A11Y-1.
- Data model §2 and §2.2 (settings rules).
- API spec §3 (settings channels).
- Screen spec S1 (splash) and S9 (Settings), IA §1 (Settings sections).
- Architecture §4.2 (SettingsService) and §7 (logging, config versioning).
- Reference only: NextLevelOS `electron/settingsFiles.cjs` (conflict-on-save + backup behaviour).
- **Owner decisions 2026-10-21:** ship pt-BR translations now; `general.bootTarget` is deferred to M4, and the launcher always boots to the desktop until then.

## Global Constraints

- **Settings file:** `<userData>/settings.json`, with backups in `<userData>/backups/settings-<stamp>.json`, where `<stamp>` is the ISO time with `:` and `.` replaced by `-`.
  - Keep the newest **10**.
  - An empty `{ "schemaVersion": 1 }` is valid; every field has a default.
  - The file never contains secrets.
- **Atomic writes (NFR-REL-1):** write `<file>.tmp`, `fsync`, then `rename`. Every launcher file write goes through `atomicWrite`.
- **Load rules (data model §2.2):**
  - A missing file means defaults.
  - Unparsable JSON, a schema failure or a newer `schemaVersion` means `invalid`. The app never overwrites the file silently; it offers *Restore latest backup* or *Reset to defaults*.
  - Migrations take a backup first.
- **Conflicts:** `settings.save` with a stale `baseRevision` returns error code `CONFLICT`. The revision starts at 0 on load and goes up by 1 on every successful write (save, restore, import, reset).
- **Errors:** new codes `CONFLICT` → `errors.conflict`, `NOT_FOUND` → `errors.notFound`, `INVALID_SETTINGS` → `errors.invalidSettings`, each with en and pt-BR messages.
- **i18n:**
  - `en.json` and `pt-BR.json` in `packages/shared/src/i18n/` have identical key sets; a test enforces this.
  - The language switches live, and `<html lang>` follows it.
- **Start with Windows** is applied with `app.setLoginItemSettings` only when `app.isPackaged`; in dev it is logged and skipped.
- **Security:**
  - `app.openPath` takes a path **key** (`'data' | 'backups' | 'logs'`), never a raw path.
  - Export and import paths come only from native dialogs opened in main.
- Components ≤ 200 lines, files ≤ 400. Services take dependencies through the constructor. Tests carry requirement IDs. Branch `feat/m1b-settings`.

## Review Focus

1. **A crash or power loss mid-save.** `settings.json` is either the old or the new full content, never partial, and a leftover `settings.json.tmp` is ignored and replaced on the next save. Pinned in Task 2.
2. **Hand-edited or corrupt `settings.json`** (invalid JSON, a typo like `"langauge"`, a wrong type, `schemaVersion: 99`). The app shows the recovery screen, never overwrites the file on boot, and *Restore latest backup* works. Pinned in Tasks 3 and 6. Unknown keys are stripped on load (not fatal), but wrong types are fatal.
3. **Restoring when 10 backups exist.** Backing up the current state first must not delete the backup being restored. Pinned in Task 4.
4. **Importing a file from another machine**: a different version, a huge file, or not JSON. It is validated and migrated like a load and rejected with `INVALID_SETTINGS`; files over 1 MB are rejected before parsing. A successful import makes a backup first. Pinned in Task 4.
5. **Switching language** while a Settings form has unsaved edits. The draft survives (language changes only after Save) and every visible string updates. Pinned in Task 7.

---

### Task 1: Settings schema, contract, errors and pt-BR

**Files:**
- Create: `packages/shared/src/settings/schema.ts`, `packages/shared/src/settings/schema.test.ts`, `packages/shared/src/settings/changedPaths.ts`, `packages/shared/src/settings/changedPaths.test.ts`, `packages/shared/src/i18n/pt-BR.json`, `packages/shared/src/i18n/locales.test.ts`
- Modify: `packages/shared/src/errors.ts`, `packages/shared/src/ipc/contract.ts` (+ test), `packages/shared/src/index.ts`, `packages/shared/package.json` (export `./i18n/pt-BR.json`), `docs/03-architecture/data-model.md` §2 (mark which sections exist since M1; `bootTarget` arrives in M4), `docs/03-architecture/api-spec.md` §3 (final settings channel list)

**Interfaces:**
- Produces (`settings/schema.ts`):
  - `LANGUAGES = ['en', 'pt-BR'] as const`, `type Language`.
  - `SettingsSchema = z.object({ schemaVersion: z.literal(1), general: GeneralSchema.default(...), experimental: z.record(z.string(), z.boolean()).default({}) })`.
    - `GeneralSchema = z.object({ language: z.enum(LANGUAGES).default('en').meta({ labelKey: 'settings.fields.general.language.label', helpKey: 'settings.fields.general.language.help' }), startWithWindows: z.boolean().default(false).meta({...}), setupCompletedAt: z.string().datetime().nullable().default(null) })`. `setupCompletedAt` has no meta, so it is not shown in forms.
    - Objects are plain `z.object`, so unknown keys are stripped, not fatal.
  - `type Settings = z.output<typeof SettingsSchema>`.
  - `defaultSettings(): Settings` returns `SettingsSchema.parse({ schemaVersion: 1 })`.
  - `CURRENT_SCHEMA_VERSION = 1`.
  - `FieldMeta = { labelKey: string; helpKey?: string }` and `fieldMeta(schema: z.ZodType): FieldMeta | undefined`, which reads `.meta()`.
- Produces (`settings/changedPaths.ts`): `changedPaths(before: unknown, after: unknown): string[]` returns sorted dotted leaf paths whose values differ (arrays compared as whole values).
- Produces (contract), with `SettingsSnapshotSchema = z.object({ settings: SettingsSchema, revision: z.number().int() })`:
  - `'settings.get'`: input void, output `z.discriminatedUnion('kind', [z.object({ kind: z.literal('ok'), snapshot }), z.object({ kind: z.literal('invalid'), reason: z.enum(['unreadable', 'invalid', 'newerVersion']), latestBackupId: z.string().nullable() })])`.
  - `'settings.save'`: input `z.strictObject({ settings: SettingsSchema, baseRevision: z.number().int() })`, output snapshot.
  - `'settings.reset'`: input void, output snapshot.
  - `'settings.backups.list'`: input void, output `z.array(z.object({ id: z.string(), createdAt: z.string(), size: z.number(), changes: z.array(z.string()) }))`.
  - `'settings.backups.restore'`: input `z.strictObject({ id: z.string() })`, output snapshot.
  - `'settings.export'`: input void, output `z.object({ status: z.enum(['saved', 'cancelled']) })`.
  - `'settings.import'`: input void, output `z.discriminatedUnion('status', [{ status: 'cancelled' }, { status: 'imported', snapshot }])`.
  - `'app.paths'`: input void, output `z.object({ data: z.string(), settings: z.string(), backups: z.string(), logs: z.string() })`.
  - `'app.openPath'`: input `z.strictObject({ key: z.enum(['data', 'backups', 'logs']) })`, output void.
  - Remove `settings.validate` from the api-spec channel list and note that validation runs on the shared schema in both processes.
- `ERROR_CODES` gains `CONFLICT`, `NOT_FOUND` and `INVALID_SETTINGS`.
- `errors.ts` also exports `class AppErrorException extends Error { readonly error: AppError }` (its message is the code). Main handlers throw it to return a specific error; renderer mutations throw it so TanStack Query errors keep the code.

- [ ] **Step 1: Write the failing tests.**
  - `schema.test.ts`:
    - `'FR-SET-2: an empty file with schemaVersion 1 is valid and gets defaults'` (language `en`, startWithWindows `false`).
    - `'FR-SET-2: wrong types fail with the field path'` (`general.language: 'xx'` → issue path `['general','language']`).
    - `'unknown keys are stripped'`.
    - `'schemaVersion other than 1 fails'`.
    - `'fieldMeta returns label keys for form fields only'`.
  - `changedPaths.test.ts`: `{a:{b:1,c:2}}` vs `{a:{b:1,c:3},d:true}` → `['a.c','d']`; identical → `[]`.
  - `locales.test.ts`:
    - `'NFR-I18N-1: pt-BR has exactly the same keys as en'` compares the flattened key sets.
    - `'every settings field labelKey exists in both locales'`.
  - `contract.test.ts`: `settings.save` rejects an extra key; `app.openPath` rejects `{ key: 'C:\\' }`.
- [ ] **Step 2: Run them to see them fail.** Run `npx vitest run packages/shared`. Expected: FAIL.
- [ ] **Step 3: Implement the schema, contract and errors.** Write `pt-BR.json` with natural Brazilian Portuguese for every existing key: shell, errors, settings, apps. Add the new `settings.fields.*`, `errors.*` and section keys to both files.
- [ ] **Step 4: Run them to see them pass.** Run `npx vitest run packages/shared; npm run typecheck`. Expected: PASS. The launcher typecheck fails until Task 5 adds the handlers. To keep `main` green, Task 1 adds temporary handlers in `main/index.ts` that return `err('INTERNAL', …)`; Task 5 replaces them.
- [ ] **Step 5: Commit** `feat(shared): settings schema, settings IPC contract and pt-BR locale (FR-SET-2, NFR-I18N-1)`.

### Task 2: Atomic write helper

**Files:**
- Create: `apps/launcher/src/main/fs/atomicWrite.ts`, `atomicWrite.test.ts`

**Interfaces:**
- Produces: `atomicWrite(file: string, data: string, fs?: AtomicFs): Promise<void>` with `interface AtomicFs { open, rename, rm }` (a subset of `node:fs/promises`, defaulting to it).
  - It writes `${file}.tmp` (flag `w`), calls `handle.sync()`, closes, then calls `rename(tmp, file)`.
  - On any failure it removes the tmp file (ignoring errors) and rethrows.

- [ ] **Step 1: Write the failing tests** (real temp dir via `fs.mkdtemp(os.tmpdir())`):
  - `'NFR-REL-1: writes the full content and leaves no tmp file'`.
  - `'NFR-REL-1: replaces an existing file'`.
  - `'NFR-REL-1: a stale .tmp from a crash is overwritten'`.
  - `'NFR-REL-1: if rename fails, the original file is untouched and the tmp is removed'`. Inject an `AtomicFs` whose `rename` rejects.
- [ ] **Step 2: Run them to see them fail.** Run `npx vitest run apps/launcher`. Expected: FAIL.
- [ ] **Step 3: Implement** as specified.
- [ ] **Step 4: Run them to see them pass.** Run `npx vitest run apps/launcher`. Expected: PASS.
- [ ] **Step 5: Commit** `feat(launcher): atomic file write helper (NFR-REL-1)`.

### Task 3: SettingsService load, save, conflicts and reset

**Files:**
- Create: `apps/launcher/src/main/settings/SettingsService.ts`, `SettingsService.test.ts`, `apps/launcher/src/main/settings/migrate.ts`, `migrate.test.ts`

**Interfaces:**
- Consumes: `SettingsSchema`, `defaultSettings`, `CURRENT_SCHEMA_VERSION`, `changedPaths` (Task 1), `atomicWrite` (Task 2), `err`/`ok`.
- Produces:
  - `migrate(raw: unknown): { kind: 'ok'; value: unknown; migrated: boolean } | { kind: 'newerVersion' }`. Version 1 passes through. A missing `schemaVersion` on an object is treated as 1. A higher version gives `newerVersion`.
  - `interface SettingsDeps { dir: string; clock: () => Date; log: { warn(ctx: object, msg: string): void } }`
  - `class SettingsService`, constructed with `new SettingsService(deps)`:
    - `load(): Promise<SettingsLoad>`, where `SettingsLoad` equals the `settings.get` output type. A missing file gives defaults and does not write. Otherwise it reads, parses, migrates (backing up first when migrating) and validates.
    - `get(): SettingsLoad` returns the last load result (in memory).
    - `save(settings: Settings, baseRevision: number): Promise<Result<SettingsSnapshot>>`. A stale revision returns `CONFLICT`. While in the invalid state it returns `INVALID_SETTINGS`, because only restore or reset may leave that state. Otherwise it validates, backs up the current file if one exists, writes with `atomicWrite`, increments the revision and prunes to 10.
    - `reset(): Promise<SettingsSnapshot>` backs up an existing file (even an invalid one), writes defaults, and increments the revision.
    - `paths: { settings: string; backups: string }`.
  - Backup file content is the exact previous file bytes, copied with `fs.copyFile` into `backups/settings-<stamp>.json`. The stamp comes from `clock()`. Add `-1`, `-2`… on a same-millisecond collision.

- [ ] **Step 1: Write the failing tests** (temp dir; fake clock that advances 1 s per call):
  - `'FR-SET-2: missing file loads defaults without writing'`.
  - `'FR-SET-2: invalid JSON loads as invalid/unreadable and the file is untouched'`.
  - `'FR-SET-2: a wrong type loads as invalid/invalid'`.
  - `'schemaVersion 99 loads as invalid/newerVersion'`.
  - `'FR-SET-2: save rejects invalid settings and writes nothing'`: cast-bypass the type, expect `INVALID_SETTINGS` and the file unchanged.
  - `'save with a stale revision returns CONFLICT'`.
  - `'FR-SET-3: each save backs up the previous file'`: after 3 saves there are 2 backups. The first save of a missing file creates none.
  - `'FR-SET-3: only the newest 10 backups are kept'`: 13 saves → 10 files, and the oldest stamps are gone.
  - `'save is refused while the file is invalid; reset backs up the bad file and writes defaults'`.
  - `'latestBackupId is reported when invalid'`.
- [ ] **Step 2: Run them to see them fail.** Run `npx vitest run apps/launcher`. Expected: FAIL.
- [ ] **Step 3: Implement** `migrate.ts` and `SettingsService.ts` (load/save/reset/prune). Keep backup listing and pruning helpers in `settings/backups.ts` if the service file approaches 200 lines.
- [ ] **Step 4: Run them to see them pass.** Run `npx vitest run apps/launcher`. Expected: PASS.
- [ ] **Step 5: Commit** `feat(launcher): SettingsService with atomic saves, backups and conflicts (FR-SET-2, FR-SET-3)`.

### Task 4: Backups list and restore, export and import

**Files:**
- Modify: `apps/launcher/src/main/settings/SettingsService.ts` (+ `backups.ts`), `SettingsService.test.ts` or a new `SettingsService.backups.test.ts`

**Interfaces:**
- `SettingsDeps` gains `dialogs: { pickExportPath(defaultName: string): Promise<string | null>; pickImportPath(): Promise<string | null> }`.
- Produces:
  - `listBackups(): Promise<BackupInfo[]>`, newest first. `changes` is `changedPaths(backup, nextNewer)`, where `nextNewer` is the next newer backup or the current settings; unreadable backups get `changes: []`.
  - `restore(id: string): Promise<Result<SettingsSnapshot>>`:
    - An id that is not in the list (no path traversal possible) gives `NOT_FOUND`.
    - A backup that fails migrate/validate gives `INVALID_SETTINGS`.
    - Otherwise it reads the backup **into memory first**, backs up the current file, writes, prunes and increments the revision. This works from the invalid state too.
  - `exportTo(): Promise<{ status: 'saved' | 'cancelled' }>` writes the current valid settings as pretty JSON with `atomicWrite`. The default name is `nextlevel-settings.json`.
  - `importFrom(): Promise<Result<{ status: 'cancelled' } | { status: 'imported'; snapshot }>>`. Files over 1 MB give `INVALID_SETTINGS` before reading. It parses and migrates, and then validates. It then saves through the same path as `save` (backup first), ignoring the revision.

- [ ] **Step 1: Write the failing tests:**
  - `'US-D3: after 3 saves Backups lists 2 entries newest first with what changed'`: change `general.language` and assert `changes` contains `'general.language'`.
  - `'US-D3: restoring backs up the current state first'`: the backup count goes up by 1, and the settings equal the restored ones.
  - `'restore with 10 backups restores the oldest even though a new backup is pruned'` (Review Focus 3).
  - `'restore of an unknown or ../ id returns NOT_FOUND'`.
  - `'FR-SET-4: export then import round-trips'`.
  - `'FR-SET-4: import rejects non-JSON, a newer version and files over 1 MB with INVALID_SETTINGS'`.
  - `'import cancelled returns cancelled and writes nothing'`.
- [ ] **Step 2: Run them to see them fail.** Run `npx vitest run apps/launcher`. Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run them to see them pass.** Run `npx vitest run apps/launcher`. Expected: PASS.
- [ ] **Step 5: Commit** `feat(launcher): settings backups restore, export and import (FR-SET-3, FR-SET-4, US-D3)`.

### Task 5: Main wiring: handlers, logging, paths, Start with Windows

**Files:**
- Create: `apps/launcher/src/main/handlers.ts`, `handlers.test.ts`, `apps/launcher/src/main/log.ts`
- Modify: `apps/launcher/src/main/index.ts`, launcher `package.json` (dep `electron-log`)

**Interfaces:**
- Produces:
  - `interface MainDeps { settings: SettingsService; appVersion: () => string; quit: () => void; paths: { data: string; logs: string }; openPath: (path: string) => Promise<string>; setOpenAtLogin: (enabled: boolean) => void }`.
  - `createHandlers(deps: MainDeps): IpcHandlers` maps every contract channel.
    - `Result`-returning service calls are unwrapped by throwing a typed `AppErrorException(error)`. The router maps it to that error instead of `INTERNAL`, so `router.ts` gains that branch, with a test.
    - After a successful `settings.save`, restore, import or reset, it calls `setOpenAtLogin(settings.general.startWithWindows)`.
  - `log.ts` exports `log` (electron-log, file transport in `app.getPath('logs')`), matching `RouterLogger` plus `warn` and `info`.
  - `main/index.ts`:
    - Constructs `SettingsService` with `dir: app.getPath('userData')` and dialogs via `dialog.showSaveDialog` / `showOpenDialog` (JSON filter), and awaits `settings.load()` before creating the window.
    - Its `setOpenAtLogin` only calls `app.setLoginItemSettings({ openAtLogin })` when `app.isPackaged`; otherwise it logs at info.
    - `openPath` comes from `shell.openPath`, and a non-empty return string is logged as a warning.

- [ ] **Step 1: Write the failing tests** (`handlers.test.ts`, with a real `SettingsService` on a temp dir and fakes for the rest):
  - `'FR-SET-1: settings.save round-trips through handlers'`.
  - `'CONFLICT from the service reaches the renderer as CONFLICT, not INTERNAL'`, called through `createIpcRouter(createHandlers(deps), log).handle(...)`.
  - `'FR-SET-7: app.paths returns data, settings, backups and logs'`.
  - `'FR-SET-7: app.openPath opens only known keys'`: `'logs'` calls `openPath` with the logs path.
  - `'saving startWithWindows calls setOpenAtLogin(true)'`.
- [ ] **Step 2: Run them to see them fail.** Run `npx vitest run apps/launcher`. Expected: FAIL.
- [ ] **Step 3: Implement.** Remove Task 1's temporary handlers.
- [ ] **Step 4: Run them to see them pass.** Run `npm run lint; npm run typecheck; npm test; npm run test:e2e`. Expected: all exit 0.
- [ ] **Step 5: Commit** `feat(launcher): settings IPC handlers, file logging and data paths (FR-SET-1, FR-SET-7)`.

### Task 6: Renderer settings data, language sync and boot gate

**Files:**
- Create:
  - `features/settings/settingsApi.ts`, which replaces nothing; `api.ts` keeps `useAppVersion`
  - `features/boot/BootGate.tsx`, `features/boot/BootGate.test.tsx`, `features/boot/RecoveryScreen.tsx`, `features/boot/Splash.tsx`
- Modify: `apps/launcher/src/renderer/i18n.ts` (add pt-BR resources), `main.tsx` (render `BootGate` around the shell), `test-utils.tsx`

**Interfaces:**
- Produces:
  - `useSettings(): UseQueryResult<SettingsLoad>` (key `['settings']`).
  - `useSaveSettings()`, `useResetSettings()`, `useRestoreBackup()`, `useImportSettings()`: mutations that unwrap `Result` (throwing `AppErrorException`) and `setQueryData(['settings'], { kind: 'ok', snapshot })` on success, and invalidate `['settings.backups']`.
  - `useBackups()` (key `['settings.backups']`), `useExportSettings()`, `useAppPaths()`, `useOpenPath()`.
  - `BootGate({ children })`:
    - While loading, it shows `Splash` (logo text plus `t('boot.loadingSettings')`, `role="status"`).
    - For `kind: 'invalid'`, it shows `RecoveryScreen`: the reason text, **Restore latest backup** (disabled when `latestBackupId` is null), **Reset to defaults**, and **Open data folder**.
    - For `ok`, it renders its children and keeps `i18n.changeLanguage(settings.general.language)` and `document.documentElement.lang` in sync.
    - On a query error it shows `RecoveryScreen` in its `unreadable` form, with the restore button disabled.

- [ ] **Step 1: Write the failing tests** (`BootGate.test.tsx`, fake bridge):
  - `'FR-SET-2: an invalid settings file shows recovery instead of the desktop'`.
  - `'US-D3: Restore latest backup calls settings.backups.restore with the latest id and then shows the desktop'`.
  - `'Reset to defaults calls settings.reset'`.
  - `'NFR-I18N-1: language pt-BR switches the UI and html lang'`, which expects the pt-BR text of `shell.desktop.apps`.
- [ ] **Step 2: Run them to see them fail.** Run `npx vitest run apps/launcher`. Expected: FAIL.
- [ ] **Step 3: Implement.** Make `renderInShell` take an optional settings-load fixture and default to `ok` with defaults.
- [ ] **Step 4: Run them to see them pass.** Run `npx vitest run apps/launcher`. Expected: PASS.
- [ ] **Step 5: Commit** `feat(launcher): boot gate with splash, settings recovery and live language (FR-SET-2, NFR-I18N-1)`.

### Task 7: Schema-driven form, save bar and the General section

**Files:**
- Create: `features/settings/form/fields.ts`, `fields.test.ts`, `features/settings/form/SettingsForm.tsx`, `features/settings/form/SaveBar.tsx`, `features/settings/GeneralSection.tsx`, `features/settings/GeneralSection.test.tsx`
- Modify: `features/settings/SettingsApp.tsx` (sections General, Backups, Data & logs, About; switch to `aria-current="page"` from the M1a minors)

**Interfaces:**
- Produces:
  - `type FieldDescriptor = { path: string; kind: 'boolean' } | { path: string; kind: 'enum'; options: readonly string[] }`, plus `labelKey`, `helpKey?`.
  - `fieldsOf(section: z.ZodObject, prefix: string): FieldDescriptor[]` keeps only fields with `fieldMeta` and unwraps `.default()`. Other kinds throw `Error('unsupported field kind')` so new kinds get a widget on purpose.
  - `issuesByPath(error: z.ZodError): Record<string, string>` maps dotted paths to the first message key. Zod messages go through `errors.validation.<code>` keys; add `invalid_type`, `invalid_value`, `too_small`, `too_big` and a `default` to both locales.
  - `SettingsForm({ sectionKey: 'general' })`:
    - Keeps a local draft starting from the snapshot, renders a switch (`role="switch"`) or a `<select>` per descriptor with label and help (`aria-describedby`), and validates the whole draft with `SettingsSchema.safeParse` on every change.
    - Shows the field error under the field.
    - `SaveBar` appears when the draft differs: **Save** (disabled while invalid or saving) and **Discard**.
    - On `CONFLICT` it shows `t('settings.saveBar.conflict')`, refetches and resets the draft.
    - Option labels for `language` come from `settings.fields.general.language.options.<value>`.
  - `GeneralSection` renders `SettingsForm sectionKey="general"`.

- [ ] **Step 1: Write the failing tests.**
  - `fields.test.ts`:
    - `fieldsOf(GeneralSchema, 'general')` → `[language enum ['en','pt-BR'], startWithWindows boolean]`.
    - `setupCompletedAt` is excluded.
    - `issuesByPath` maps `general.language`.
  - `GeneralSection.test.tsx`:
    - `'FR-SET-1: toggling Start with Windows shows the save bar; Save calls settings.save with baseRevision'`.
    - `'Discard restores the saved values and hides the save bar'`.
    - `'CONFLICT shows the conflict message and reloads'`.
    - `'NFR-I18N-1: changing language in the draft does not switch the UI until saved'` (Review Focus 5).
    - `'NFR-A11Y-1: every field has a label and help text'`.
- [ ] **Step 2: Run them to see them fail.** Run `npx vitest run apps/launcher`. Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run them to see them pass.** Run `npx vitest run apps/launcher`. Expected: PASS.
- [ ] **Step 5: Commit** `feat(launcher): schema-driven settings form and General section (FR-SET-1, FR-SET-2)`.

### Task 8: Backups and Data & logs sections

**Files:**
- Create: `features/settings/BackupsSection.tsx`, `BackupsSection.test.tsx`, `features/settings/DataSection.tsx`, `DataSection.test.tsx`

**Interfaces:**
- `BackupsSection`:
  - A table with columns time (`Intl.DateTimeFormat(i18n.language, { dateStyle: 'medium', timeStyle: 'short' })`), what changed (field labels for known paths via `settings.fields.<path>.label`, else the path; "—" when empty), and size (`Intl.NumberFormat` KB).
  - A **Restore** button per row, behind a confirmation (`window.confirm` is not allowed; use an inline confirm row with Confirm/Cancel buttons).
  - **Export…** and **Import…** buttons, plus an empty state `t('settings.backups.empty')`.
- `DataSection`: rows for data folder, settings file, backups and logs, each showing the path (`<code>`, selectable) with an **Open folder** button for the data, backups and logs keys.

- [ ] **Step 1: Write the failing tests:**
  - `'US-D3: lists backups with time and what changed; Restore asks to confirm and then calls settings.backups.restore'`.
  - `'FR-SET-3: shows the empty state with no backups'`.
  - `'FR-SET-4: Export and Import call their channels; a cancelled import changes nothing'`.
  - `'FR-SET-7: shows the data paths and Open folder calls app.openPath with the key'`.
- [ ] **Step 2: Run them to see them fail.** Run `npx vitest run apps/launcher`. Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run them to see them pass.** Run `npm run lint; npm run typecheck; npm test`. Expected: all exit 0.
- [ ] **Step 5: Commit** `feat(launcher): settings Backups and Data & logs sections (FR-SET-3, FR-SET-4, FR-SET-7)`.

### Task 9: End-to-end, docs, M1 complete

**Files:**
- Create: `apps/launcher/e2e/settings.spec.ts`, `apps/launcher/e2e/launch.ts` (shared launch helper: absolute app dir, env without `ELECTRON_RUN_AS_NODE`, and `NEXTLEVEL_USER_DATA` pointing at a fresh temp dir)
- Modify: `apps/launcher/src/main/index.ts` (if `NEXTLEVEL_USER_DATA` is set and the app is not packaged, use it as `userData`, so e2e never touches the developer's data), `e2e/shell.spec.ts` (use the helper), `CHANGELOG.md`, `docs/01-product/roadmap.md` (M1 ☑ after merge), `docs/01-product/02-product-requirements.md` (drop "(proposed)" from NFR-I18N-1, now confirmed), `docs/05-operations/environment-setup.md` (dev data dir note)

- [ ] **Step 1: Write the e2e test** `settings.spec.ts`: `'FR-SET-1/3, US-D3: change a setting, it persists across restart, and a backup can be restored'`:
  - Launch with a fresh data dir, open Settings → General, switch Language to Português, then Save. The UI shows the pt-BR "Configurações" title.
  - Close the app and launch again with the same dir. The UI is still in pt-BR.
  - Open Settings → Backups. There is one backup. Restore it and confirm. The UI is back in English.
- [ ] **Step 2: Run it.** Run `npm run test:e2e`. Expected: 2 passed.
- [ ] **Step 3: Update the docs** as listed. The CHANGELOG Unreleased entry covers the settings service, backups, export/import, recovery, pt-BR and the sections.
- [ ] **Step 4: Verify everything.** Run `npm run lint; npm run typecheck; npm test; npm run test:e2e`. Expected: all exit 0.
- [ ] **Step 5: Commit** `test(launcher): settings e2e; docs: M1 complete`.
