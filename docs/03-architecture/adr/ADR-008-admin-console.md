# ADR-008: Separate admin web console; roles enforced by the API

- **Status:** Accepted
- **Date:** 2026-10-20

## Context
The operator needs to manage subscribers, plans and catalog content. Subscribers need to manage
their own machine's settings. The question was one app with two roles, or two apps.

## Decision
- Two roles in the API: `admin` and `subscriber`. Every route is guarded by role.
- **Admin functions live in a separate web app** (`apps/admin`) and are never shipped inside the launcher.
- Each launcher's **local settings belong to whoever uses that PC**; an optional local **kiosk PIN**
  protects them on shared machines. This is not a server role.

## Consequences
- Admin code isn't in customers' installers (smaller attack surface).
- The admin console can be updated without a launcher release.
- Two front-ends to maintain; `packages/ui` keeps them consistent.

## Alternatives considered
- **Admin screens inside the launcher behind a role check**: ships admin UI to every customer, and admin work becomes desktop-only.
