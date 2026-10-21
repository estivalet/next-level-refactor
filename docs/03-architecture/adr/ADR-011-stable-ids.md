# ADR-011: Stable slug IDs for systems

- **Status:** Accepted
- **Date:** 2026-10-20

## Context
Today the display name ("Nintendo 64") is the key into `launchers.json`, gamelist file names,
art folders, ScreenScraper IDs and theme `gameArt`. Renaming anything breaks links silently.

## Decision
Systems are identified by a lowercase slug `id` defined in the system catalog. Everything
references the id; display names, folder names and art keys are attributes. Menu art keeps using
the menu node `name` (so existing art packs keep working); the node stores both `name` and the
system `ref_id`.

## Consequences
- Renames are safe; the importer maps old names via `aliases`.
- Catalog ids are permanent once released; changing one needs a migration.

## Alternatives considered
- **Numeric IDs**: opaque in settings and logs.
- **ScreenScraper IDs**: not every system has one, and some share one (Commodore 64 and 128 both use 66).
