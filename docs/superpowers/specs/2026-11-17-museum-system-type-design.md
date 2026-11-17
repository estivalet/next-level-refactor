# Museum system type: virtual systems and per-install classification

*2026-11-17 · short design · owner request (FR-MUS-10, US-G4)*

## Why

The NextLevelOS import left 423 of the 447 catalog systems as `kind: other`; only arcade (15) and
pinball (9) were recognised by name. The Museum's Type filter is therefore almost useless, and it
cannot tell real hardware (Nintendo 64) from software platforms (AAE, ScummVM, OpenBOR, PICO-8).
The owner wants to review and classify every system personally, through the app.

## Goals

- A new kind, **`virtual`** ("Virtual system"): a platform that never existed as hardware, such as
  an emulator or a game engine.
- The owner sets a system's **Type** in the Museum editor (Overview), one system at a time. The
  choice is a museum edit: it marks the system edited, and **Reset to original** restores the shipped
  Type with the rest of the entry.
- The Museum list, its Type filter and the Overview facts use the owner's Type when there is one.
- In the Museum's system list, a virtual system's row carries a small **Virtual** badge, so
  virtual and physical systems can be told apart at a glance (owner request, design review).

## Non-goals

- No change to the shipped catalog data (`packages/system-catalog/data/systems.json`) and no export
  script. Classifications stay in this install's library; what gets shipped is reviewed before a
  future release.
- No bulk or multi-select editing.
- No change to scanning, launching, collections, scraping or themes; none of them reads a
  system's kind.
- Virtual systems are not grouped on Home and get no badge outside the system list (on the hero,
  Home cards or the themes); that can follow once the classification exists.

## Anti-goals

- Never make the owner edit a JSON file to classify a system.
- Never break an existing saved museum entry: one without a Type keeps the shipped kind.

## Approaches

1. **In the museum entry** (picked by the owner). An optional `kind` on `SystemInfo`, saved in the
   existing `system_info` row. It reuses save, Reset and the edited flag; existing rows stay valid.
2. In the personal record (notes and gallery). Rejected: Reset never touches it, so the shipped
   Type could not be restored, and a classification belongs with the entry rather than with the
   owner's own writing.
3. A per-system setting. Rejected: it needs a Settings screen and a settings migration for a value
   only the Museum uses.

## Design

- `packages/shared`: add `'virtual'` to `SYSTEM_KINDS`, and an optional
  `kind: z.enum(SYSTEM_KINDS)` to `SystemInfoSchema`. Custom systems can also pick `virtual`, since
  they share the enum. Add the i18n label `settings.systems.custom.kinds.virtual` in en and pt-BR.
- Main (`systemInfoHandlers`, `mergeSystemInfo`): the base entry carries the shipped kind
  (`definition.kind`, or the custom system's), so the editor always opens on a value and Reset
  returns it. `systems.info.list` reports `entry.kind ?? definition.kind`. A stored entry without
  `kind` serves the shipped kind.
- Renderer: Overview in the editor gains a **Type** select listing `SYSTEM_KINDS` with the existing
  labels. The read-only Overview shows Type among its facts.
- Renderer, system list (`SystemList.tsx`): a row whose summary `kind` is `virtual` shows a small
  pill reading **Virtual** (i18n `apps.museum.virtualBadge`) after the name, before the edited dot.
  It is plain text in a muted outline, so it stays readable on the selected (light) row. Physical
  systems show no badge. The row's accessible name includes it.

  ```
  [img] ScummVM              (Virtual) •
        LucasArts · 2001
  [img] Nintendo 64
        Nintendo · 1996
  ```
- *Builder's call:* saving stores whatever Type is selected, even when it equals the shipped one.
  A later catalog change is then hidden only for systems the owner already saved, and Reset clears it.

## Docs

FR-MUS-10 and story US-G4 (owner request), the screen spec (Museum Overview), the data model and API
spec (`SystemInfo.kind`), and `CHANGELOG.md` (Unreleased).
