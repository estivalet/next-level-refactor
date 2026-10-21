# NextLevel (rebuild) — project documentation

This repository is a **from-scratch rebuild of NextLevelOS**. The current NextLevelOS
(`../NextLevelOS`, still in active use and development) is the reference implementation: we keep
its ideas and port selected, tested pieces (see [CLAUDE.md](CLAUDE.md#the-nextlevelos-reference)).

> **Status:** M0–M2 done (v0.2.0: desktop shell, settings, library core and Game Library); M3 (launching) next. Development happens offline first; a public video
> series may document it later ([series-plan.md](docs/07-series/series-plan.md), optional).

## What we are building

A RetroBat-style retro gaming launcher with the NextLevelOS desktop-shell look, sold as a
subscription service:

| Product | What it is | When |
|---|---|---|
| **Launcher** | Windows desktop app (Electron + React). Desktop shell, fullscreen themes, local ROM folders, downloads from the online catalog. Everything configured in-app. | v1 |
| **Admin console** | Web app for the operator: subscribers, plans, catalog content, access rules. | v1 |
| **API** | Backend shared by both: Google sign-in, subscriptions, catalog, downloads, settings sync. | v1 |
| **Web player** | Browser app using EmulatorJS and the same themes, for a smaller set of systems. | Future |

Start with [01-product-vision.md](docs/01-product/01-product-vision.md).

## Document map

| Folder | Documents |
|---|---|
| `docs/00-reference/` | [current-nextlevelos.md](docs/00-reference/current-nextlevelos.md): what the current app does, what to keep, what to fix |
| `docs/01-product/` | [vision](docs/01-product/01-product-vision.md) · [requirements](docs/01-product/02-product-requirements.md) · [user stories](docs/01-product/03-user-stories.md) · [roadmap](docs/01-product/roadmap.md) · [glossary](docs/01-product/glossary.md) |
| `docs/02-design/` | [information architecture & flows](docs/02-design/04-information-architecture.md) · [screen specifications](docs/02-design/screen-specifications.md) |
| `docs/03-architecture/` | [architecture](docs/03-architecture/05-architecture.md) · [data model & config schema](docs/03-architecture/data-model.md) · [API spec](docs/03-architecture/api-spec.md) · [coding standards](docs/03-architecture/coding-standards.md) · [ADRs](docs/03-architecture/adr/) |
| `docs/04-quality/` | [test strategy](docs/04-quality/test-strategy.md) · [release checklist](docs/04-quality/release-checklist.md) |
| `docs/05-operations/` | [environment setup](docs/05-operations/environment-setup.md) · [deployment & operations](docs/05-operations/deployment-and-operations.md) |
| `docs/06-legal/` | [security & privacy](docs/06-legal/security-and-privacy.md) · [content policy](docs/06-legal/content-policy.md) |
| `docs/07-series/` | [series plan](docs/07-series/series-plan.md): optional, for a possible future video series |
| root | [CLAUDE.md](CLAUDE.md) · [AGENTS.md](AGENTS.md) · [CHANGELOG.md](CHANGELOG.md) |

## Rules for these documents

- **One source per decision.** Requirements live in the PRD, structure in the architecture doc,
  schemas in the data model. Other documents link instead of repeating.
- **IDs are stable.** Requirements (`FR-…`, `NFR-…`), stories (`US-…`) and ADRs (`ADR-…`) are
  referenced from code reviews, tests and commits; never renumber, only deprecate.
- **Update docs in the same change as the code.** A pull request that changes behavior and not
  the doc that describes it is incomplete.
- Text marked **(proposed)** is a default chosen while writing the docs, not yet confirmed by the owner.
