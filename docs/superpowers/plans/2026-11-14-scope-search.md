# Scope Search and Visible Fields Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A search box in the Library list header that narrows the open scope, and Library dialog fields with a visible border.

**Architecture:** The list query already takes `text` (an FTS match within the scope); the renderer sends it from a debounced header box as part of the scope's narrowing, and the export view carries it. The shared dialog input style gets a stronger border.

**Tech Stack:** TypeScript, React 19 + TanStack Query (launcher renderer), Zod (`packages/shared`), better-sqlite3 (launcher main), vitest + Testing Library.

**Spec:** `docs/superpowers/specs/2026-11-14-scope-search-design.md`

## Global Constraints

- Requirements: FR-LIB-10 (search), FR-LIB-6 (edit metadata); decision D66. Test names carry the ID.
- No new dependencies. Strings in en and pt-BR. Files ≤ 400 lines (`LibraryApp.tsx` is 368: put the box in its own component).
- Run tests from PowerShell in the repo root with `$env:CI=1` (renderer `--root` runs skip the setup file).

## Review Focus

1. Text with FTS syntax characters (`"`, `*`, `-`, `(`) → no error, same matching as global search (`ftsQuery`). (Task 1 test)
2. Text that matches nothing → an empty list and "0 of 4116 games", not an error. (Task 2 test)
3. Opening another scope (or Back) clears the box and the narrowing. (Task 2 test)
4. Export with text exports only the matching games. (Task 1 test)
5. Typing fast sends one query after the debounce, not one per key. (Task 2 test)

---

### Task 1: Export carries the search text

**Files:**
- Modify: `packages/shared/src/library/export.ts` (`ExportViewSchema` + `text: z.string().max(200).optional()`)
- Modify: `apps/launcher/src/main/library/GameExportReader.ts` (apply `ftsQuery(view.text)` as `GameRepository.list` does: `listShape(..., match !== null, ...)` and the `match` param)
- Test: `apps/launcher/src/main/library/GameExportReader.test.ts`

**Interfaces:**
- Produces: `ExportView.text?: string`

- [ ] **Step 1: Failing tests:** `FR-LIB-10: an export of a searched list has only the matching games` (seed Mario, Zelda, Metroid; view `{ tab: 'all', text: 'zel' }` → titles `['Zelda']`); `FR-LIB-10: search text with quotes and stars exports without an error` (text `'"zel* ('` → no throw).
- [ ] **Step 2: Run** `npx vitest run apps/launcher/src/main/library/GameExportReader.test.ts` — Expected: FAIL.
- [ ] **Step 3: Implement** as above; a text that `ftsQuery` turns into null exports the unsearched list, like the list does.
- [ ] **Step 4: Run** the same — Expected: PASS.
- [ ] **Step 5: Commit** `feat(launcher): exports keep the list's search text (FR-LIB-10, D66)`.

### Task 2: Search box in the list header

**Files:**
- Create: `apps/launcher/src/renderer/features/library/ScopeSearch.tsx`
- Modify: `useLibraryView.ts` (narrowing gains `text`; params send the debounced, trimmed text when not empty), `LibraryApp.tsx` (box in the header, "n of total" count, export view gets `text`), `ExportDialog.tsx` (narrowing label shows `“text”`), `libraryApi.ts` (export `useDebounced` if needed)
- Modify: `packages/shared/src/i18n/en.json`, `pt-BR.json`
- Test: `apps/launcher/src/renderer/features/library/ScopeView.test.tsx`

**Interfaces:**
- Consumes: `ExportView.text` (Task 1)
- Produces: `ScopeSearch({ scopeName, text, onText }: { scopeName: string; text: string; onText: (text: string) => void })` — an input with `aria-label` and placeholder `t('library.scopeSearch.placeholder', { scope })` ("Search {{scope}}…" / "Buscar em {{scope}}…"), a clear button (`t('library.scopeSearch.clear')`: "Clear search" / "Limpar busca") when not empty.
- Produces: header count `t('library.status.gamesOf', { count, total })` ("{{count}} of {{total}} games" / "{{count}} de {{total}} jogos") while text is set; `total` = the scope's facets tab count.
- Produces: `view.narrow.text` / `view.setNarrow({ ..., text })`.

- [ ] **Step 1: Failing tests** (ScopeView.test):
  - `FR-LIB-10: typing in Search Nintendo 64 narrows the list to the scope` — after typing `alpha` the last `library.games.list` input has `text: 'alpha'` and the same scope.
  - `FR-LIB-10: typing fast sends one query after the pause` — type `alpha` quickly; list calls with a `text` key: exactly 1 (`text: 'alpha'`).
  - `FR-LIB-10: the header shows "n of total games" while searching; no match shows 0 of total` (fake list total 0 for text → header "0 of 5 games", TAB_COUNTS.all = 5).
  - `FR-LIB-10: opening another scope or Back clears the search`.
  - `FR-LIB-10: Export… keeps the search text` (export dialog request `view.text === 'alpha'`).
- [ ] **Step 2: Run** `npx vitest run apps/launcher/src/renderer/features/library/ScopeView.test.tsx` — Expected: FAIL.
- [ ] **Step 3: Implement** as in Interfaces; the box sits before Export…; Escape in the box clears it.
- [ ] **Step 4: Run** `npx vitest run apps/launcher/src/renderer/features/library/` — Expected: PASS.
- [ ] **Step 5: Commit** `feat(launcher): search within the open list (FR-LIB-10, D66)`.

### Task 3: Visible dialog fields, docs, verification

**Files:**
- Modify: `apps/launcher/src/renderer/features/library/Modal.tsx` (`INPUT`: `border-white/10` → `border-white/25`, `placeholder:text-slate-600` → `placeholder:text-slate-500`)
- Modify: `docs/02-design/screen-specifications.md` (S7 header: the search box; dialogs' fields), `docs/01-product/02-product-requirements.md` (FR-LIB-10 note: "Owner request 2026-11-14, D66: a box in the list header searches the open scope"), `CHANGELOG.md` (Unreleased)

- [ ] **Step 1:** Change the style (a class change: no unit test; checked by eye in the dev app — Ruling).
- [ ] **Step 2:** Docs as listed.
- [ ] **Step 3: Run** `npm run lint`, `npx tsc -b --force`, `npm test`, `npm run test:e2e` — Expected: all pass (the known local-only theme-switcher e2e failure aside).
- [ ] **Step 4: Commit** `fix(launcher): visible dialog fields; docs for scope search (FR-LIB-6, FR-LIB-10, D66)`.
