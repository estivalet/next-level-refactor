# 01 — Product vision & scope

## The problem

Retro gaming on a PC means stitching together emulators, ROM folders, artwork and a front-end.
Tools like RetroBat, LaunchBox and EmulationStation solve parts of it, but setting them up
still means hand-editing config files, and none of them feels like *your own* console.

The current NextLevelOS proved the experience (a desktop shell with beautiful fullscreen themes)
but kept the same weakness: its configuration is spread across hand-edited JSON files and a
compiled Python script. Only its author can maintain it.

## The product

**NextLevel** (working name) is a retro gaming launcher for Windows that:

1. **Works out of the box**, like RetroBat: install, sign in, pick a theme, play.
2. **Is configured entirely inside the app.** No file is ever edited by hand. Every setting has
   a screen, a validation rule and a sensible default.
3. **Looks like a console you own**: the NextLevelOS desktop shell plus fullscreen themes
   (Big Box, HyperSpin, PS5-style, …) driven by keyboard, mouse or gamepad.
4. **Can start with zero games.** Subscribers browse an online catalog of rights-cleared games
   (homebrew, freeware, licensed indie titles) and install them with one click, while still
   pointing the launcher at their own local ROM folders.

## Target audience

| Persona | Description | What they need |
|---|---|---|
| **Collector** (primary) | Has a large ROM/art library across several drives; used RetroBat or LaunchBox | Fast browsing of 100k+ games, multi-drive storage, scraping, themes, control over emulators |
| **Newcomer** | Curious about retro gaming, no ROMs, no emulator knowledge | Zero-setup start, catalog downloads, defaults that just work, gamepad navigation |
| **Cabinet / family owner** | Runs it on a TV PC or arcade cabinet | Kiosk mode, settings locked behind a PIN, boots straight into a theme |
| **Operator** (internal) | The owner of the service | Admin console to manage subscribers, plans and catalog content |

## Value proposition

- For **collectors**: one place to manage systems, emulators, art and menus without editing files.
- For **newcomers**: a legal, curated library and a console-like experience in minutes.
- For **everyone**: a subscription that pays for a maintained launcher, cloud-synced settings and
  a growing catalog of games that are legal to distribute.

## Goals (v1)

| # | Goal | Measured by |
|---|---|---|
| G1 | No hand-edited configuration | Every setting the current app reads from JSON has an in-app screen |
| G2 | Out-of-the-box start | New subscriber goes from install to playing a catalog game in under 5 minutes |
| G3 | Handles large libraries | 200k games browse and search smoothly (see NFR-PERF) |
| G4 | Existing setup migrates | The owner's current NextLevelOS data imports with no manual fixes |
| G5 | Paid access works | Sign-in, subscription and catalog download work end to end |
| G6 | Maintainable codebase | Each change is small, reviewable, tested and documented |

## Non-goals (v1)

- macOS and Linux builds (the architecture must not prevent them).
- The web player (planned, see [roadmap](roadmap.md)).
- Save-state cloud sync, achievements, netplay, social features.
- Bundling emulators inside the installer (v1 downloads or points at them).
- Mobile apps.

## Anti-goals (would make the product a failure even if it works)

- **Distributing content we have no right to distribute.** The catalog follows the
  [content policy](../06-legal/content-policy.md), with no exceptions.
- **Config files the user has to open in a text editor** to make something work.
- **Losing a user's library data**: every write is safe, backed up and recoverable.
- **Requiring an internet connection to play local games** for more than the offline grace period.
- **A codebase only its author understands**: it should be clear enough to show publicly one day.

## Scope summary

| In v1 | Later | Never |
|---|---|---|
| Launcher (Windows), admin console, API | Web player, macOS/Linux, save sync | Commercial ROM distribution |
| Google sign-in, two roles, subscriptions | More sign-in providers | Ads |
| Local ROM folders + online catalog | Emulator auto-installer for all systems | Selling user data |
| 6 themes ported from NextLevelOS | Theme store / third-party themes | |
| Importer from current NextLevelOS | Importers for RetroBat / LaunchBox | |

Detailed requirements: [02-product-requirements.md](02-product-requirements.md).
