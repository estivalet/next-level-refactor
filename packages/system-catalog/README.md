# @nextlevel/system-catalog

The system catalog (FR-EMU-1): every system the launcher knows, with a permanent id, display name,
default ROM folder name, accepted extensions, ScreenScraper id and preset launch profiles, plus the
emulator presets (FR-EMU-7).

Public API (`src/index.ts`): `systemCatalog()`, `getSystem(id)`, `effectiveSystem(def, settings)`,
`emulatorPresets()`, `getPreset(id)`, `getPresetProfile(id)`, `presetForExecutable(fileName)`.
Test with `npx vitest run packages/system-catalog`.

## Data

`data/systems.json` is generated and committed — never hand-edit it. It covers all 438 systems of
NextLevelOS plus `EXTRA_SYSTEMS` in `scripts/presetTables.ts` (the 9 Coleco Telstar models the
NextLevelOS Pong menu lists without a launcher): 447 (`CATALOG_SYSTEM_COUNT`). Ids are slugs of the
NextLevelOS name (`+` → `plus`) and are permanent once released (ADR-011).

Extensions: ES-DE's `es_systems.xml` where the name matches (directly or through `ES_ALIASES` in
`scripts/seed.ts`), else the NextLevelOS per-system `romext`, else its global `scanExtensions`.
Seed of 2026-10-21: 172 ES-DE matches, 20 from `romext`, 246 from the global list. Users can
override any system's extensions in Settings → Systems.

`data/presets.json` (also generated) holds the emulator presets. They come from NextLevelOS's
runner, `public/nextlevel-launcher.py`:
- **RetroArch:** one profile per core. The core is the fixed `-c` from `launchers.json`, or the most
  common per-game `core` in the system's gamelist when the command uses `%core%`; with neither, the
  system gets no RetroArch profile.
- **MAME:** one profile per system, from `MAME_CUSTOM_ARGS`. `%COMMANDS%` autoboot pairs are
  dropped, and `-%MEDIA%` systems get a default medium plus one profile per other medium. Method
  entries and media lists are in `scripts/presetTables.ts`.
- **Standalone emulators:** from the table in `scripts/presetTables.ts`.

A system's `presetProfiles` follow the runner's `SYSTEM_EMULATORS` order, then the standalone
extras. The seed prints the emulators it can't map (TeknoParrot, scripts, squashfs, Hypseus,
Demul, …). The M5 importer reports them for the owner's setup. A snapshot test pins every preset's
argv (test-strategy C2).

## Regenerating

1. Download ES-DE's `resources/systems/windows/es_systems.xml` at the release you want into a
   scratch folder (not this repo).
2. Run, with the NextLevelOS files read-only (use absolute paths: npm runs the script in the package
   folder):

```bash
npm run seed -w packages/system-catalog -- \
  --launchers ../NextLevelOS/public/data/launchers.json \
  --config ../NextLevelOS/public/data/config.json \
  --screenscraper ../NextLevelOS/public/data/screenscraper.json \
  --es-systems <scratch>/es_systems.xml \
  --runner ../NextLevelOS/public/nextlevel-launcher.py \
  --gamelists ../NextLevelOS/public/data/gamelists \
  --source "nextlevelos@<commit> + es-de v3.5.0"
```

3. Read the printed report; add `ES_ALIASES` for clear name mismatches and run again.
4. Ids must never change for released systems: see "Id permanence" below.

Third-party notices: [NOTICE.md](NOTICE.md).

## Id permanence

`data/released-ids.json` lists every id ever released. The seed fails if one would disappear
(a rename in NextLevelOS or a change to `slugify`) and appends new ids; a test checks that every
listed id is still in the catalog. To retire a system, keep its entry (ADR-011).

## System museum seed

`data/system-info.json` holds the Systems Museum entries (FR-MUS-1), built from the owner's scraped
per-system JSON files plus LaunchBox's `Platforms.xml` (`00_lb_metadata.xml`, gaps only). To
regenerate it (the folder is only read; keep the report outside the repo):

```bash
npm run --silent import:system-info -w packages/system-catalog -- "<system-info folder>" > <report.json>
```

The report lists `unmatched` source names (no catalog system, or a duplicate), `unparseable` files
and `dropped` keys the normalizer ignored, plus `<field> (truncated)` for text cut at a word to the
schema limit (ending in "…") and `imageUrl (not an image link)` for model images dropped because
the host is `example.com`/`example.org` or the path is not an image file (`upload.wikimedia.org` is
always kept). Descriptive text comes from Wikipedia (CC BY-SA 4.0); entries record it in `sources`
as `Wikipedia (CC BY-SA 4.0)` with the licence URL, after a `Wikipedia` article link when the
scraped file's `references` name one. Text filled from LaunchBox credits `LaunchBox Games
Database` with its site URL (FR-MUS-5).
