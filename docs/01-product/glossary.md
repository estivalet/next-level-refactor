# Glossary

Shared terms for docs and code. Code identifiers use the English term in the first column.

| Term | Meaning |
|---|---|
| **Admin** | User role that can use the admin console. Manages subscribers, plans and catalog. |
| **Admin console** | Web app (`apps/admin`) used only by admins. |
| **Art kind** | Category of media: `logo/clear`, `background/artwork`, `box-front`, `video`, … See data model. |
| **Asset folder** | Shared folder of menu art used by every theme when a theme pack lacks a file. |
| **Catalog** | The online set of games subscribers may download. Contains only rights-cleared content. |
| **Catalog item** | One downloadable game in the catalog, with license record, files and checksums. |
| **Collection** | Curated list of games from one or more systems (e.g. "Nintendo 64 Essentials"). |
| **Emulator** | An executable that runs games (RetroArch, Dolphin, MAME…). Defined as data, not code. |
| **Emulator profile** | An emulator + arguments template + options for one or more systems (e.g. "RetroArch – mupen64plus_next"). |
| **Entitlement** | What a user may access: role, plan, plan's catalog scopes, expiry. Issued by the API. |
| **Filter** | Tag on a game (`official`, `homebrew`, `hack`, `translation`, …) used to split game lists into tabs. |
| **Front-end mode** | Fullscreen theme mode for browsing and launching, driven by gamepad/keyboard. |
| **Game** | One playable entry in the library: a ROM file (or set of files) on a system. |
| **Game list** | The games shown for a menu node (a system, a collection, or a smart filter). |
| **Grace period** | How long the launcher keeps working offline using its last valid entitlement (default 14 days). |
| **Importer** | Tool that converts current NextLevelOS JSON files into the new settings and library. |
| **Kiosk mode** | Launcher state where settings and desktop are hidden or PIN-locked. |
| **Launch profile** | Resolved choice of emulator profile for a game: game override → system default. |
| **Launcher** | The desktop app (`apps/launcher`). |
| **Library** | Local SQLite database of games, metadata, media paths, user state and collections. |
| **Menu** | Navigation tree shown by themes (categories → systems / collections). Several menus may exist; one is active. |
| **Menu node** | One entry in a menu: a category (has children), a system, a collection or a smart filter. |
| **Plan** | Subscription tier (e.g. `basic`, `plus`) with price and catalog scopes. |
| **ROM** | Game image file(s). We never distribute commercial ROMs. |
| **ROM folder** | A local directory scanned for a system's games. |
| **Scraping** | Fetching metadata and art from an online database (ScreenScraper). |
| **Settings** | All user-configurable launcher options, stored in `settings.json`, edited only through the app. |
| **Shell** | The desktop-OS part of the launcher: desktop, windows, taskbar, start menu. |
| **Storage location** | A base folder (drive) with a priority; systems' ROM folders resolve under it. |
| **Subscriber** | User role with an active (or grace) subscription. Uses the launcher. |
| **System** | A platform (Nintendo 64, Amiga 1200…), identified by a stable slug `id` (`n64`). |
| **System catalog** | Built-in, versioned list of system definitions shipped with the launcher. Distinct from the content catalog. |
| **Theme** | A fullscreen presentation built on the themes engine. |
| **Theme pack** | Folder with one theme's art and option overrides (`theme.json`). |
| **Themes engine** | Headless navigation/data/input/art layer that themes render on top of (`packages/themes`). |
| **Web player** | Future browser app running games with EmulatorJS. |
