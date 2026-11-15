# PS5 Hero Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The PS5 Style home shows `SHORT  Full name` beside the selected tile, `Manufacturer · Year` under a right-shifted hero logo, and Games / Favorites stats at the bottom right.

**Architecture:** `useGameCount` also counts favorites from the game list it already loads; `HomeView` reads the museum entry with `useThemeSystemInfo` for full name, manufacturer and year; layout in `ps5.css`.

**Tech Stack:** React, TypeScript, Vitest + Testing Library, packages/themes.

**Spec:** `docs/superpowers/specs/2026-11-15-ps5-hero-redesign-design.md`

## Global Constraints

- `packages/themes` imports no Node/Electron; data only through `ThemeHost` and existing hooks.
- User-visible strings through `t('…')`, keys in `packages/shared/src/i18n/en.json` and `pt-BR.json`.
- Files under 400 lines (`ps5.css` is 384 now: if it would pass 400, move the new hero/stats rules to `ps5/hero.css` imported by `HomeView.tsx`).
- Tests named `FR-THM-1: …`; no new `any`.
- Commits: Conventional Commits, scope `themes`/`docs`, ending with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Done = `npm run lint`, `npm run typecheck`, and `cd packages/themes && npx vitest run` pass (root `npm test` has a known pre-existing Windows jest-dom failure).

## Review Focus

1. **A system with 0 visible games or 0 favorites** shows "Games 0" / "Favorites None", not a blank. Test in Task 1/2.
2. **A category node** (no `systemId`, children are menu nodes) shows "Items N", no favorites, no manufacturer line. Test in Task 2.
3. **Hidden favorites** don't count: a hidden game with `favorite` is excluded. Test in Task 1.
4. **A long full name** ellipsizes on one line and never overlaps the clock or the next tiles. Test asserts the class; visual check in review.
5. **Museum entry still loading** shows the menu label (no flash of empty), then the fuller name. Test in Task 2.

---

### Task 1: Favorites in `useGameCount`

**Files:**
- Modify: `packages/themes/src/engine/gameCount.ts` (+ `gameCount.test.ts`), `packages/themes/src/components/useGameCount.ts` (+ its test if any; otherwise `gameData.test.tsx` where it is covered)

**Interfaces — Produces:**
```ts
// gameCount.ts
/** Visible games carrying `favorite`. */
export function countFavorites(games: readonly ThemeGame[]): number;
// useGameCount.ts — the 'games' variant gains favorites:
export type GameCountState =
  | { kind: 'games'; count: number | null; favorites: number | null; loading: boolean }
  | { kind: 'items'; count: number }
  | null;
```
The cache entry stores `favorites` next to `value`; existing callers (`big-box/MenuView.tsx`, `showcase/ShowcaseTheme.tsx`, `countLabel`) keep working unchanged.

- [ ] **Step 1: Write failing tests:** `FR-THM-1: countFavorites counts visible favorites only` (a hidden favorite excluded; 0 when none); `FR-THM-1: useGameCount reports favorites for a system` (FakeThemeHost games with 2 favorites, 1 hidden favorite → `favorites: 2`).
- [ ] **Step 2: Run** `cd packages/themes && npx vitest run src/engine/gameCount.test.ts src/components` — Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** the same — Expected: PASS.
- [ ] **Step 5: Commit** — `feat(themes): count favorites with a level's games (FR-THM-1)`

---

### Task 2: PS5 home layout

**Files:**
- Modify: `packages/themes/src/ps5/HomeView.tsx`, `packages/themes/src/ps5/ps5.css` (or new `ps5/hero.css`), `packages/themes/src/ps5/Ps5Theme.test.tsx`, i18n en/pt-BR (`themes.ps5.games`, `themes.ps5.favorites`, `themes.ps5.items`, `themes.ps5.none`)
- Modify: `docs/02-design/screen-specifications.md` (PS5 Style home), `CHANGELOG.md` (Unreleased)

**Interfaces — Consumes:** `useGameCount` (Task 1); `useThemeSystemInfo(systemId)` from `packages/themes/src/components/useSystemInfo.ts`; `MenuNode.shortName`, `MenuNode.systemId`; `StarIcon` style in `components/icons.tsx` (add a `TrophyIcon` there in the same style).

Behavior:
- Focused shelf slot renders, instead of `.ps5-icon-label` under the tile, a `.ps5-title` block positioned to the right of the focused tile and below the unfocused tiles' height (unfocused 104 px vs focused 150 px): optional `.ps5-title-badge` (`shortName.toUpperCase()`), then `.ps5-title-name` = museum `fullName` ?? `label(item)`; single line, ellipsis, max width so it never runs under the clock.
- Hero: left inset ≈ 140 px; under the logo `.ps5-hero-meta` = `[manufacturer, releaseYear].filter(Boolean).join(' · ')`, omitted when empty or no `systemId`. Remove `.ps5-hero-count`.
- `.ps5-stats` at bottom right (above the footer hint bar): for `kind: 'games'` → trophy + label "Games" over the count, and label "Favorites" over the count or "None" at 0; `count === null && loading` → "…"; `count === null && !loading` → hidden. For `kind: 'items'` → "Items" over the count only.
- Type sizes TV-legible and consistent with the existing PS5 style; reuse `--ps5-muted` for labels.

- [ ] **Step 1: Write failing tests** in `Ps5Theme.test.tsx`: `FR-THM-1: the selected tile shows its short-name badge and full name beside it`; `FR-THM-1: the full name prefers the museum fullName` (FakeThemeHost `systemInfo` with `fullName`), and shows the label until it loads; `FR-THM-1: the hero shows manufacturer · year`; `FR-THM-1: stats show games and favorites, None at zero`; `FR-THM-1: a category shows Items and no favorites or manufacturer`.
- [ ] **Step 2: Run** `cd packages/themes && npx vitest run src/ps5` — Expected: FAIL.
- [ ] **Step 3: Implement**; update existing PS5 tests that asserted the old label/count.
- [ ] **Step 4: Run** `cd packages/themes && npx vitest run` and `npm run lint`, `npm run typecheck` — Expected: PASS.
- [ ] **Step 5: Update docs** (screen spec PS5 home, CHANGELOG Unreleased).
- [ ] **Step 6: Commit** — `feat(themes): PS5 home names the selected system beside its tile, shows maker, year and game stats (FR-THM-1)`
