# Museum System Type Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The owner can set each system's Type (including a new `virtual` kind) in the Museum editor, and the Museum list marks virtual systems with a badge.

**Architecture:** `kind` becomes an optional field of the museum entry (`SystemInfo`), saved in the existing `system_info` row. Main fills in the shipped kind whenever an entry has none, so every served entry and list row carries a kind. The renderer adds a Type select to the editor's Overview, shows Type in the read-only Overview, and puts a "Virtual" pill on virtual rows in the system list.

**Tech Stack:** TypeScript ESM, Zod (`packages/shared`), Electron main + typed IPC, React + Tailwind, Vitest + Testing Library, i18next.

**Spec:** `docs/superpowers/specs/2026-11-17-museum-system-type-design.md`

## Global Constraints

- Requirement **FR-MUS-10**, story **US-G4**. Every new test name starts with `FR-MUS-10:`.
- New kind id: `virtual`. Labels: en `"Virtual system"`, pt-BR `"Sistema virtual"` (key `settings.systems.custom.kinds.virtual`).
- Badge text: en `"Virtual"`, pt-BR `"Virtual"` (key `apps.museum.virtualBadge`). Editor/read label: en `"Type"`, pt-BR `"Tipo"` (key `apps.museum.field.kind`).
- No change to `packages/system-catalog/data/*.json`, scanning, launching, collections, scraping or themes.
- No DB migration: `kind` lives inside the `system_info` row's JSON.
- All user-visible strings through `t('…')`; pt-BR must keep exactly the same keys as en (`locales.test.ts`).
- Lint, typecheck and `npm test` pass before each commit; Conventional Commits, scope `shared`/`launcher`/`docs`.

## Review Focus

1. **An entry saved before this change (no `kind`)** must still list, filter and open in the editor with the shipped kind, never blank or `undefined`. Pinned in Task 2.
2. **Reset after changing the Type** must bring back the shipped kind in both the returned entry and the list, with `edited: false`. Pinned in Task 2.
3. **A custom system** (Settings → Systems) with no museum edit must show its own Settings kind, not `console`. Pinned in Task 2.
4. **Picking "Virtual system" in the Type filter** must show systems the owner classified as virtual, because the list reads the effective kind. Pinned in Task 4.
5. **The badge on the selected (light) row** must stay in the button's accessible name and readable. The name is pinned in Task 4; legibility is a manual check in Task 5.

---

### Task 1: Shared contract: `virtual` kind, `SystemInfo.kind`, strings

**Files:**
- Modify: `packages/shared/src/catalog/schema.ts` (`SYSTEM_KINDS`)
- Modify: `packages/shared/src/systems/info.ts` (`SystemInfoSchema`)
- Modify: `packages/shared/src/i18n/en.json`, `packages/shared/src/i18n/pt-BR.json`
- Test: `packages/shared/src/systems/info.test.ts` (create if absent; else add to it)

**Interfaces:**
- Produces: `SYSTEM_KINDS` = `['console','handheld','arcade','computer','pinball','engine','virtual','other']` (`virtual` before `other`, so it lists above it); `SystemInfo.kind?: SystemKind`, where `SystemKind = (typeof SYSTEM_KINDS)[number]`, exported from `catalog/schema.ts` if not already.

- [ ] **Step 1: Write the failing tests**

```ts
it('FR-MUS-10: an entry may carry a kind, including virtual', () => {
  expect(SystemInfoSchema.parse({ systemId: 'aae', kind: 'virtual' }).kind).toBe('virtual');
  expect(SystemInfoSchema.parse({ systemId: 'aae' }).kind).toBeUndefined();
  expect(SystemInfoSchema.safeParse({ systemId: 'aae', kind: 'robot' }).success).toBe(false);
});
it('FR-MUS-10: virtual is a system kind, listed before other', () => {
  expect(SYSTEM_KINDS.indexOf('virtual')).toBe(SYSTEM_KINDS.indexOf('other') - 1);
});
```

- [ ] **Step 2: Run `npx vitest run packages/shared/src/systems/info.test.ts`.** Expected: FAIL (the kind is stripped / `virtual` is missing).
- [ ] **Step 3: Implement.** Add `'virtual'`; add `kind: z.enum(SYSTEM_KINDS).optional()` to `SystemInfoSchema` right after `systemId`. Add the three i18n keys from Global Constraints to both locale files.
- [ ] **Step 4: Run `npx vitest run packages/shared`.** Expected: PASS, including `locales.test.ts`.
- [ ] **Step 5: Commit** `feat(shared): virtual system kind and an optional kind on museum entries (FR-MUS-10)`

### Task 2: Main: every served entry and list row has the effective kind

**Files:**
- Modify: `apps/launcher/src/main/systems/mergeSystemInfo.ts`
- Modify: `apps/launcher/src/main/systems/systemInfoHandlers.ts` (`merged`, `systems.info.list`, `systems.info.reset`)
- Test: `apps/launcher/src/main/systems/systemInfoHandlers.test.ts`, `apps/launcher/src/main/systems/mergeSystemInfo.test.ts`

**Interfaces:**
- Consumes: `SystemInfo.kind` (Task 1).
- Produces: `baseSystemInfo(system, custom)` always returns `kind: system.kind`, also when it returns a seed (return a copy; never mutate the seed). `systems.info.get`, `systems.info.forTheme` and `systems.info.reset` return entries with `kind` set: the stored `kind`, else `definition.kind`. `systems.info.list` rows: `kind` = the entry's effective kind.

- [ ] **Step 1: Write the failing tests** in `systemInfoHandlers.test.ts` (the fixtures define `plain`, `aamber-pegasus` (seeded) and `custom-box`, all `kind: 'console'`; give `custom-box`'s definition `kind: 'handheld'` for the custom case):

```ts
it('FR-MUS-10: get, list and reset carry the shipped kind until the owner saves another', async () => {
  const h = handlers();
  expect((await h['systems.info.get']({ systemId: 'aamber-pegasus' })).entry.kind).toBe('console');
  await h['systems.info.save']({ systemId: 'aamber-pegasus', entry: entryOf('aamber-pegasus', { kind: 'virtual' }) });
  const row = async () => (await h['systems.info.list']()).find((r) => r.systemId === 'aamber-pegasus');
  expect(await row()).toMatchObject({ kind: 'virtual', edited: true });
  expect((await h['systems.info.reset']({ systemId: 'aamber-pegasus' })).kind).toBe('console');
  expect(await row()).toMatchObject({ kind: 'console', edited: false });
});
it('FR-MUS-10: an entry saved without a kind serves the shipped kind', async () => {
  await handlers()['systems.info.save']({ systemId: 'plain', entry: entryOf('plain') });
  const h = handlers();
  expect((await h['systems.info.get']({ systemId: 'plain' })).entry.kind).toBe('console');
  expect((await h['systems.info.list']()).find((r) => r.systemId === 'plain')?.kind).toBe('console');
});
it("FR-MUS-10: a custom system's base entry carries its settings kind", async () => {
  expect((await handlers()['systems.info.get']({ systemId: 'custom-box' })).entry.kind).toBe('handheld');
});
```

Update existing `toEqual` expectations on served entries (e.g. `entryOf('plain')` returned by `get`/`reset`, and seed comparisons) to include `kind: 'console'`. Do not loosen them to `toMatchObject`.

- [ ] **Step 2: Run `npx vitest run apps/launcher/src/main/systems`.** Expected: the new tests FAIL (`kind` undefined).
- [ ] **Step 3: Implement.** `baseSystemInfo` adds `kind: system.kind`. In the handlers, a small helper `withKind(entry, definition)` returns `{ ...entry, kind: entry.kind ?? definition.kind }`; use it in `merged` for both the edit and the base, and take the list row's `kind` from `entry.kind`.
- [ ] **Step 4: Run `npx vitest run apps/launcher/src/main`.** Expected: PASS.
- [ ] **Step 5: Commit** `feat(launcher): museum entries carry the shipped or owner-set system kind (FR-MUS-10)`

### Task 3: Renderer: Type in the editor and in the read-only Overview

**Files:**
- Modify: `apps/launcher/src/renderer/features/museum/FieldGroup.tsx` (new spec variant)
- Modify: `apps/launcher/src/renderer/features/museum/EntryForm.tsx` (`OVERVIEW` first item)
- Modify: `apps/launcher/src/renderer/features/museum/EntrySections.tsx` (`OVERVIEW`, `FactSection` value)
- Test: `apps/launcher/src/renderer/features/museum/EntryForm.test.tsx`

**Interfaces:**
- Consumes: `SystemInfo.kind`, `SYSTEM_KINDS` (Task 1); served entries always have `kind` (Task 2).
- Produces: `FieldSpec` gains `{ key: 'kind'; kind: 'systemKind' }`, rendered as a `<select>` labelled `t('apps.museum.field.kind')` with one option per `SYSTEM_KINDS` entry, labelled `t('settings.systems.custom.kinds.<kind>')`. It is the first field of the editor's Overview. `TextKey` must exclude `'kind'` so it can't be rendered as a text input.

- [ ] **Step 1: Write the failing tests** (the fixture entry is `snes`; give the served entry `kind: 'console'`):

```ts
it('FR-MUS-10: the editor sets the Type and saves it with the entry', async () => {
  const { bridge, user } = setup();
  const form = await openForm(user);
  const type = within(form).getByRole('combobox', { name: 'Type' });
  expect(type).toHaveValue('console');
  await user.selectOptions(type, 'virtual');
  await user.click(screen.getByRole('button', { name: 'Save' }));
  await waitFor(() => {
    expect(bridge.calls.find((c) => c.channel === 'systems.info.save')?.input).toMatchObject({
      entry: { systemId: 'snes', kind: 'virtual' },
    });
  });
});
it('FR-MUS-10: the read-only Overview shows the Type label, not the id', async () => {
  setup(true, { ...entry, kind: 'virtual' });
  const view = await screen.findByRole('article', { name: 'Super Nintendo' });
  const overview = await within(view).findByRole('region', { name: 'Overview' });
  expect(within(overview).getByText('Type')).toBeInTheDocument();
  expect(within(overview).getByText('Virtual system')).toBeInTheDocument();
});
```

- [ ] **Step 2: Run `npx vitest run apps/launcher/src/renderer/features/museum/EntryForm.test.tsx`.** Expected: FAIL (no Type combobox / no Type fact).
- [ ] **Step 3: Implement.** The read view adds `'kind'` first in `OVERVIEW`, and `FactSection` renders `kind` through `t('settings.systems.custom.kinds.<value>')` and every other field as now. The select reuses `FormFields.tsx`'s input styling.
- [ ] **Step 4: Run `npx vitest run apps/launcher/src/renderer/features/museum`.** Expected: PASS.
- [ ] **Step 5: Commit** `feat(launcher): set a system's Type in the museum editor (FR-MUS-10)`

### Task 4: Renderer: "Virtual" badge in the system list

**Files:**
- Modify: `apps/launcher/src/renderer/features/museum/SystemList.tsx` (row, between the name block and the edited dot)
- Test: `apps/launcher/src/renderer/features/museum/MuseumApp.test.tsx`

**Interfaces:**
- Consumes: `SystemInfoSummary.kind` (effective kind, Task 2); `apps.museum.virtualBadge` (Task 1).

- [ ] **Step 1: Write the failing test.** Add a fourth summary `{ systemId: 'scummvm', name: 'ScummVM', kind: 'virtual', manufacturer: null, releaseYear: null, edited: true, hasNotes: false, changedAt: null }` and fix the `toHaveLength(3)` count in the existing filter test to 4.

```ts
it('FR-MUS-10: virtual systems carry a Virtual badge and the Type filter finds them', async () => {
  const { user } = setup();
  renderInShell(<MuseumApp />);
  const list = await screen.findByRole('list', { name: 'Systems' });
  const scumm = await within(list).findByRole('button', { name: /ScummVM/ });
  expect(within(scumm).getByText('Virtual')).toBeInTheDocument();
  expect(scumm).toHaveAccessibleName(/Virtual/);
  expect(within(list).getAllByText('Virtual')).toHaveLength(1);
  await user.selectOptions(screen.getByRole('combobox', { name: 'Type' }), 'virtual');
  expect(within(list).getAllByRole('listitem')).toHaveLength(1);
  await user.click(scumm);
  expect(within(scumm).getByText('Virtual')).toBeInTheDocument();
});
```

- [ ] **Step 2: Run `npx vitest run apps/launcher/src/renderer/features/museum/MuseumApp.test.tsx`.** Expected: FAIL (no badge).
- [ ] **Step 3: Implement.** A `<span>` pill (`shrink-0 rounded-full border px-1.5 text-[10px] uppercase tracking-wide`) with `selected ? 'border-slate-400 text-slate-600' : 'border-slate-600 text-slate-400'`, rendered only when `system.kind === 'virtual'`.
- [ ] **Step 4: Run `npx vitest run apps/launcher/src/renderer`.** Expected: PASS.
- [ ] **Step 5: Commit** `feat(launcher): mark virtual systems in the museum list (FR-MUS-10)`

### Task 5: Docs and full verification

**Files:**
- Modify: `docs/01-product/02-product-requirements.md` (add FR-MUS-10 after FR-MUS-9: *The owner can set a system's Type in the Museum editor, including "Virtual system" for platforms that never existed as hardware; the choice is a museum edit (Reset restores the shipped Type) and the Museum list marks virtual systems with a badge. 2026-11-17, owner request.* Priority M)
- Modify: `docs/01-product/03-user-stories.md` (US-G4 after US-G3: as the owner, I classify each system's Type myself in the Museum so emulators and engines like AAE and ScummVM aren't mixed with real hardware; acceptance: Type select in Overview, Reset restores it, Virtual badge in the list, Type filter finds them)
- Modify: `docs/02-design/screen-specifications.md` (Museum: Type first in Overview, editable; Virtual badge on list rows)
- Modify: `docs/03-architecture/data-model.md` and `docs/03-architecture/api-spec.md` (`SystemInfo.kind`, optional; served entries and list rows always carry the effective kind; `SYSTEM_KINDS` includes `virtual`)
- Modify: `CHANGELOG.md` (Unreleased, under the Museum items)

- [ ] **Step 1: Update the docs above.**
- [ ] **Step 2: Run `npm run lint`, `npm run typecheck`, `npm test`.** Expected: all exit 0; the test count goes up by the new tests.
- [ ] **Step 3: Manual check in the launcher** (`npm run dev`): set AAE to Virtual system, Save, see the badge (selected and not), filter by Virtual system, Reset, and see the badge and Type go back.
- [ ] **Step 4: Commit** `docs: museum system type (FR-MUS-10, US-G4)`
