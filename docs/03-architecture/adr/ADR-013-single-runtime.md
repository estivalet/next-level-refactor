# ADR-013: One runtime: drop Python, port the scraper to TypeScript

- **Status:** Accepted
- **Date:** 2026-10-20

## Context
The current app needs Node, Python (scraper, maintenance scripts) and a PyInstaller-built exe.
Users would need Python installed for scraping, and builds involve three toolchains.

## Decision
Everything shipped is TypeScript. The ScreenScraper client and the needed maintenance operations
(duplicate removal, multi-disc cleanup) are ported into launcher services or importer steps.
Developer-only data scripts (e.g. the IGDB "Essentials" builder) may stay in Python outside the product.

## Consequences
- One toolchain for build, test and release.
- Porting effort for `scrappers/scrape_cli.py`; its tests serve as the spec.
- ScreenScraper needs a developer id/password per application. Until the installer (M10) the user
  enters it in Settings → Scraper next to their account, stored with `safeStorage` (owner decision
  D15, 2026-10-24). Before M10 a new ADR decides how a shipped build provides it (build-time
  secret or an API proxy).

## Alternatives considered
- **Bundle Python**: a larger installer and two runtimes to secure and update.
