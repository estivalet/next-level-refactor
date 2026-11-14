# Release checklist

Copy into the release PR/issue and tick every box. Skip a box only with a written reason.

## Code & tests

- [ ] `main` CI green: lint, type-check, unit, component, integration, contract tests
- [ ] Playwright e2e (launcher + admin) green on the release commit
- [ ] Visual snapshots reviewed; intended changes accepted
- [ ] Critical scenarios C1–C14 green ([test-strategy](test-strategy.md#4-critical-scenarios-must-never-regress))
- [ ] Performance run on the reference PC meets NFR-PERF-1..4 (attach numbers)
- [ ] No open `severity:critical` / `severity:high` issues
- [ ] Dependencies audited (`npm audit --omit=dev`); no known high/critical vulnerabilities in shipped code

## Data safety

- [ ] Settings and library migrations tested from the previous release's data (upgrade test)
- [ ] Migrations create a backup before running
- [ ] Downgrade behaviour documented (newer schema → older app shows "update required", doesn't write)

## Manual checks (Windows 10 and Windows 11)

- [ ] Clean install → sign in → first-run wizard → play a catalog game (≤ 5 min, G2)
- [ ] Upgrade install over previous version keeps settings, library, sign-in
- [ ] Real emulators: RetroArch (2 cores), Dolphin, PCSX2/DuckStation, MAME — launch and return
- [ ] Xbox and PlayStation controllers navigate every theme; keyboard-only works too
- [ ] Offline start within grace; offline start after grace shows sign-in; reconnect resumes
- [ ] Kiosk mode (FR-SET-6, D54): turn on with a PIN; after a restart it is locked and the
      ticked parts are hidden (desktop, Settings, theme switcher, Catalog, Account, Quit); hold Esc
      or Start 3 s → PIN pad unlocks; Lock now; 5 wrong PINs wait a minute; a `reset-kiosk` file
      next to `NextLevel.exe` turns it off at the next start
- [ ] Settings sync (FR-SET-5, D55) on two PCs signed in to one account: turn Sync on on both;
      a favorite, a collection rename and a play on one PC show on the other after Sync now;
      play counts add up; paths and emulators don't change; Delete synced data turns sync off
- [ ] Installer (D51): install to `C:\NextLevel`, start from the Start menu; uninstall keeps
      `data\` and `Catalog\` (the packaging smoke test passed on the release build)
- [ ] Updater (NFR-UPD-1, D53): a beta build finds the next beta, downloads it into
      `data\updates`, installs on quit or Restart to update; a zip copy only shows the notice
- [ ] Download pause/resume across restart; checksum failure path
- [ ] From a packaged build in a portable folder (e.g. `D:\NextLevel`): install a published test
      item, play it, uninstall it; nothing is written outside the folder (D50: check `%APPDATA%`,
      `%LOCALAPPDATA%`, `%TEMP%` and Documents stay untouched)
- [ ] Importer on the owner's real NextLevelOS data: dry run reviewed, import verified

## Backend (when API changed)

For 1.0 the backend isn't deployed (D56, D59: no-spending rule, 2026-10-30): the staging and
production lines below are **skipped with that reason**; the Docker image's own health check
(*Deploy API*, manual run) stands in for them.

- [ ] DB migration applied on staging with a production-like snapshot
- [ ] Backup taken immediately before production migration
- [ ] Stripe webhooks verified in staging (test mode) with the new build
- [ ] `/v1/health` reports the new version after deploy
- [ ] Rollback plan written (previous image tag + DB restore point)

## Packaging & distribution

- [ ] Version bumped (SemVer) in all workspaces; `CHANGELOG.md` updated
- [ ] Installer code-signed; SmartScreen check on a clean VM — **skipped for 1.0** (D52, D59:
      no-spending rule, 2026-10-30; release notes say SmartScreen warns: More info → Run anyway)
- [ ] Auto-update tested from previous version on `beta` channel before promoting to `stable`
- [ ] Third-party licenses file regenerated (About → Licenses)
- [ ] Release notes written (user-facing language, links to docs)

## Legal & content

- [ ] Every published catalog item has a verified license record ([content policy](../06-legal/content-policy.md))
- [ ] Privacy policy and terms reflect any new data collected
- [ ] Screenshots, store images and any demo footage contain no commercial ROMs or copyrighted box art without permission
