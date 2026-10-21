# @nextlevel/system-catalog

The system catalog (FR-EMU-1): every system the launcher knows, with a permanent id, display name,
default ROM folder name, accepted extensions and ScreenScraper id. Emulator presets arrive in M3.

Public API (`src/index.ts`): `systemCatalog()`, `getSystem(id)`, `effectiveSystem(def, settings)`.
Test with `npx vitest run packages/system-catalog`.

## Data

`data/systems.json` is generated and committed — never hand-edit it. It covers all 438 systems of
NextLevelOS (`NEXTLEVELOS_SYSTEM_COUNT`). Ids are slugs of the NextLevelOS name (`+` → `plus`) and
are permanent once released (ADR-011).

Extensions: ES-DE's `es_systems.xml` where the name matches (directly or through `ES_ALIASES` in
`scripts/seed.ts`), else the NextLevelOS per-system `romext`, else its global `scanExtensions`.
Seed of 2026-10-21: 172 ES-DE matches, 20 from `romext`, 246 from the global list. Users can
override any system's extensions in Settings → Systems.

## Regenerating

1. Download ES-DE's `resources/systems/windows/es_systems.xml` at the release you want into a
   scratch folder (not this repo).
2. Run, with the NextLevelOS files read-only:

```bash
npm run seed -w packages/system-catalog -- \
  --launchers ../NextLevelOS/public/data/launchers.json \
  --config ../NextLevelOS/public/data/config.json \
  --screenscraper ../NextLevelOS/public/data/screenscraper.json \
  --es-systems <scratch>/es_systems.xml \
  --source "nextlevelos@<commit> + es-de v3.5.0"
```

3. Read the printed report; add `ES_ALIASES` for clear name mismatches and run again.
4. Ids must never change for released systems: see "Id permanence" below.

Third-party notices: [NOTICE.md](NOTICE.md).

## Id permanence

`data/released-ids.json` lists every id ever released. The seed fails if one would disappear
(a rename in NextLevelOS or a change to `slugify`) and appends new ids; a test checks that every
listed id is still in the catalog. To retire a system, keep its entry (ADR-011).
