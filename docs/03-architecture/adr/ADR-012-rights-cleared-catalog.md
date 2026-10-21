# ADR-012: The catalog holds rights-cleared content only

- **Status:** Accepted
- **Date:** 2026-10-20

## Context
The service charges a subscription and offers game downloads. Distributing commercial ROMs
without a license is copyright infringement, and doing it publicly invites
takedowns, channel strikes and legal action.

## Decision
The catalog contains only content the operator has the right to distribute: author-permitted
homebrew, freeware, open-source, public-domain and commercially licensed titles. Every item has
a license record, and publishing is blocked without one. The subscription pays for the service
(launcher, sync, curation, hosting), not for access to commercial games. Users bring their own
dumps for anything else through local folders. See [content-policy.md](../../06-legal/content-policy.md).

## Consequences
- The catalog starts small; curation and outreach to authors become part of the product.
- The data model and admin UI must carry license data and evidence.

## Alternatives considered
- **A "bring your own catalog" server**: rejected; the service would still be distributing.
