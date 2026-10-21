# ADR-003: Library in SQLite, settings in a validated JSON file

- **Status:** Accepted
- **Date:** 2026-10-20

## Context
The current app keeps ~187k games in ~1,000 JSON files fetched by the renderer, mixing metadata,
user state, launch overrides and scrape status. Search, counts and filters scan files in memory.
Settings are spread across six files.

## Decision
- **Library** (games, metadata, user state, media index, collections, menus, launch log) in one
  SQLite database (`better-sqlite3`, WAL, FTS5 for search), accessed only from the main process.
- **Settings** (small, human-meaningful configuration) in one `settings.json`, validated by Zod,
  edited only by the app, with rotating backups and export/import.

## Consequences
- Indexed queries make the NFR-PERF targets reachable; writes are transactional.
- Settings stay diffable, exportable and syncable as one document.
- An importer is required to bring existing JSON data over (FR-IMP).
- Debugging the library needs a SQLite viewer; Settings → Data offers "Export library to JSON".

## Alternatives considered
- **Everything in JSON** (status quo): slow, unsafe concurrent writes, no queries.
- **Everything in SQLite**: settings lose easy backup/sync/diff; no real benefit at that size.
- **IndexedDB in the renderer**: couples data to the renderer; the main process can't use it for launch/scan.
