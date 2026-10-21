# Video series plan (optional, future)

> **Not active.** The project is being built offline first. If it goes well, this plan describes
> how the build could be shown as a YouTube series. Nothing else in the docs depends on it.

Maps [roadmap](../01-product/roadmap.md) milestones to episodes. Each episode should end with
something visibly working, a merged PR and a tagged state viewers can check out (`ep-NN`).
Episode count and order are a draft; adjust as the build reveals itself.

## Format (per episode)

1. **Cold open (≤ 30 s):** the finished result of the episode.
2. **Why:** the requirement/story IDs being built and the problem in the old app (show the old code when relevant; [current-nextlevelos.md](../00-reference/current-nextlevelos.md)).
3. **Plan:** the doc section(s) the AI agent will follow; show the prompt.
4. **Build:** agent-assisted implementation, tests first for logic.
5. **Review:** read the diff, run tests, fix what the agent got wrong (keep the mistakes in; they're the lesson).
6. **Demo + docs update:** tick the roadmap, update CHANGELOG.
7. **Next time.**

Repository tags: `ep-01` … so viewers can follow along. Episode descriptions link the content policy.

## Episodes

| Ep | Title (working) | Milestone | Builds | Refs |
|---|---|---|---|---|
| 01 | Why I'm rebuilding my retro launcher from scratch | — | Tour of the old app, its config mess, the docs in this folder | vision, reference |
| 02 | Writing the docs before the code (with AI) | — | Walk through vision → PRD → stories → architecture; CLAUDE.md | all docs |
| 03 | Monorepo, Electron and CI from zero | M0 | npm workspaces, electron-vite, lint/test/typecheck, GitHub Actions | ADR-001/002 |
| 04 | A desktop inside a window | M1 | Shell: desktop, windows, taskbar, start menu | S6 |
| 05 | Settings you never edit by hand | M1 | Zod settings schema, generated forms, atomic save, backups | FR-SET-1..4, ADR-005 |
| 06 | Typed IPC: no more `window.electronAPI?.whatever` | M1 | Contract, router, preload bridge | api-spec §3 |
| 07 | What is a "system"? The system catalog | M2 | `packages/system-catalog`, stable IDs, seeding from old data | FR-EMU-1, ADR-011 |
| 08 | Scanning 200,000 games without freezing | M2 | SQLite library, worker-thread scanner, storage priority | FR-LIB-1..5, ADR-003 |
| 09 | A game library that scrolls at 60 fps | M2 | Library app, virtualized lists, FTS search | FR-LIB-6..10, NFR-PERF |
| 10 | Killing the 3,500-line Python launcher | M3 | Emulator profiles, tokens, argv rendering, presets | FR-EMU-2..7, ADR-004 |
| 11 | Press Play: spawning emulators safely | M3 | LaunchService, Test launch, launch log, focus restore | FR-EMU-5/6/10 |
| 12 | Porting a themes engine | M4 | `packages/themes`, ThemeHost, engine tests | FR-THM-6, ADR-010 |
| 13 | Big Box and Big Box List | M4 | First themes on the new engine | FR-THM-1 |
| 14 | Gamepads everywhere | M4 | Gamepad API input, remapping | FR-THM-3 |
| 15 | HyperSpin, PS5, Console Home, Showcase | M4 | Remaining themes, theme packs, coverage | FR-THM-1/2 |
| 16 | Menus and collections | M5 | Menu editor, collections, smart filters | FR-MENU-*, FR-LIB-8/9 |
| 17 | Importing my old setup | M5 | Importer with dry run on real data | FR-IMP-* |
| 18 | Scraping art and metadata | M6 | ScreenScraper client in TS, preview, batch | FR-SCR-* |
| 19 | A backend in an afternoon | M7 | Fastify + Drizzle + SQLite, health, OpenAPI | ADR-007 |
| 20 | Sign in with Google from a desktop app | M7 | PKCE loopback flow, tokens, devices | FR-AUTH-*, ADR-006 |
| 21 | Admins vs subscribers | M7 | Roles, entitlements, offline grace, admin console v0 | FR-AUTH-3/5, ADR-008 |
| 22 | Taking payments | M8 | Plans, Stripe Checkout/Portal, webhooks | FR-SUB-*, ADR-009 |
| 23 | Building a legal game catalog | M9 | Catalog model, licenses, admin item editor | FR-CAT-8, ADR-012 |
| 24 | Downloads that resume and verify | M9 | Signed URLs, resumable downloads, install/uninstall | FR-CAT-3..7 |
| 25 | First-run experience | M9 | Wizard, starter set | FR-ONB-* |
| 26 | Shipping it: installer, signing, auto-update | M10 | electron-builder, channels, release checklist | NFR-UPD-1 |
| 27 | Going to production | M10 | Docker, VPS, R2, backups, monitoring | deployment doc |
| 28 | Kiosk mode and cloud sync | M10 | FR-SET-5/6 | |
| 29+ | Web player with EmulatorJS | post-1.0 | | roadmap |

## Recording checklist

- [ ] No real tokens, emails, API keys or file paths with personal info on screen (use the dev profile and stub auth when possible)
- [ ] No commercial ROMs or copyrighted box art in demos (use catalog fixtures)
- [ ] Repository tagged `ep-NN` at the end state shown
- [ ] Docs updated and visible in the episode's PR
