# Roadmap

Milestones are ordered so that **every milestone ends with something runnable and demoable**.
The local launcher comes first; accounts and payments come after the core experience works,
because they are easier to add to a working app than to build around an empty one. An optional
mapping to video episodes is in [series-plan.md](../07-series/series-plan.md).

Status legend: ☐ not started · ◐ in progress · ☑ done

| # | Milestone | Outcome (demo) | Key requirements | Status |
|---|---|---|---|---|
| M0 | **Foundations** | Empty monorepo builds, lints, tests in CI; Electron window shows "Hello"; docs in place | NFR-MAINT-1 | ☐ |
| M1 | **Shell** | Desktop, windows, taskbar, start menu; Settings app skeleton with schema-driven forms, validation, backups | FR-SET-1..4, FR-SET-7 | ☐ |
| M2 | **Library core** | System catalog; add storage locations; background scan; SQLite library; Game Library app with virtualized lists and global search | FR-LIB-1..8, FR-LIB-10, FR-EMU-1, NFR-PERF | ☐ |
| M3 | **Launching** | Emulators + profiles + presets in Settings; Test launch; Play a game and return to it; launch log | FR-EMU-2..8, FR-EMU-10 | ☐ |
| M4 | **Themes engine** | `packages/themes` engine; Big Box theme first, then the other five; gamepad input; theme packs + coverage | FR-THM-1..6 | ☐ |
| M5 | **Menus, collections & import** | Menu editor; collections; smart filters; NextLevelOS importer with dry run; owner's library migrated | FR-MENU-*, FR-LIB-9, FR-IMP-* | ☐ |
| M6 | **Scraping & media** | Single-game scrape with preview; batch scrape; media index | FR-SCR-* | ☐ |
| M7 | **Accounts** | `apps/api` with Google sign-in, roles, entitlements, devices; launcher sign-in gate + offline grace; admin console v0 (users, audit log) | FR-AUTH-*, FR-ADM-1, FR-ADM-4..5 | ☐ |
| M8 | **Subscriptions** | Plans; Stripe Checkout/Portal; webhooks; complimentary access; subscribe screen | FR-SUB-*, FR-ADM-2 | ☐ |
| M9 | **Catalog & downloads** | Catalog items with license records; uploads; signed downloads; install/uninstall in launcher; first-run wizard complete | FR-CAT-*, FR-ADM-3, FR-ONB-* | ☐ |
| M10 | **Release 1.0** | Signed installer; auto-update; kiosk mode; settings sync; production deployment; release checklist passed | FR-SET-5..6, NFR-UPD-1 | ☐ |

## After 1.0

| Item | Notes |
|---|---|
| **Web player** (`apps/web-player`) | EmulatorJS; catalog games only (the browser can't see local ROMs reliably); reuses `packages/themes` through a web host |
| Save-state cloud sync | Needs per-emulator save path knowledge in profiles |
| Pre-launch hooks | squashfs/WSL mounting from the current runner (FR-EMU-9) |
| macOS / Linux builds | Emulator presets per OS; path handling already OS-neutral |
| Importers for RetroBat / LaunchBox / ES `gamelist.xml` | FR-LIB-11 |
| Emulator auto-install | Download and configure emulators from official sources |
| Theme SDK | Third-party themes as packages |

## Milestone exit criteria (all milestones)

1. Demo scenario for the milestone runs on a clean machine.
2. CI green; new code covered as described in [test-strategy.md](../04-quality/test-strategy.md).
3. Docs updated in the same PR (requirements status, data model, ADRs, CHANGELOG).
4. Tagged release `v0.<milestone>.0` with release notes.
