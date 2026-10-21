# Content policy (catalog)

The rule behind [ADR-012](../03-architecture/adr/ADR-012-rights-cleared-catalog.md): **the online
catalog only contains games we have the right to distribute.** This page defines what qualifies,
what evidence we keep, and how takedowns work. Not legal advice; have it reviewed before launch.

## 1. What the subscription sells

The subscription pays for the **service**: the launcher and its updates, cloud sync, themes,
curation, hosting and support. It does **not** sell access to commercial games. Marketing,
the website and the videos must say this consistently.

## 2. What may be in the catalog

| Type (`licenses.type`) | Example | Required evidence |
|---|---|---|
| `author-permission` | A homebrew NES game whose author agreed to distribution in NextLevel | Written permission (email or signed form) naming the work, the service, whether commercial distribution is allowed, territory and term |
| `freeware` | A game the author released as freeware **and** whose terms allow redistribution, including by a paid service | Copy/screenshot of the license terms with URL and date; permission if terms are silent about commercial redistribution |
| `open-source` | Game under GPL/MIT/CC-BY etc. | License text; attribution and source-availability obligations met (link to source) |
| `public-domain` | Works explicitly dedicated (CC0) | Dedication statement with URL and date. "Old" or "abandoned" is **not** public domain |
| `commercial-license` | A rights holder licenses a classic title to us | Signed contract; terms (territory, dates, royalty reporting) recorded |

## 3. What may never be in the catalog

- Commercial ROMs/ISOs without a license from the current rights holder, regardless of age,
  availability or "abandonware" status.
- BIOS/firmware files from console manufacturers.
- ROM hacks or translations of commercial games (the base game is copyrighted), unless the rights
  holder of the base game has licensed it.
- Content whose author permission can't be verified.
- Content that is illegal, hateful, or sexual content involving minors (also prohibited in user
  reports and metadata).

## 4. Publishing workflow

1. Admin creates a draft item and uploads files (checksums computed).
2. Admin attaches a license record and evidence file; marks it verified (records who/when).
3. **Publish** is enabled only with a verified license (enforced in API — critical scenario C10).
4. Item shows license type and credit to subscribers.
5. License `expires_at` triggers automatic unpublish and the item's `on_lapse` rule.

## 5. Takedown process

- Contact address published in the terms and the website.
- On a notice: acknowledge within 2 business days; unpublish the item while reviewing; if valid,
  set `on_lapse = remove` so installed copies are removed; record everything in the audit log.
- Repeat or bad-faith uploads are not possible (only admins upload), but mistakes are logged and reviewed.

## 6. Local ROMs (not our content)

Users may point the launcher at their own folders. The launcher does not supply, link to, or
suggest sources for commercial ROMs, BIOS files or "ROM sets". The scraper fetches metadata and
art for the user's own library and stores it locally only; that art is never uploaded to our
servers or redistributed.

## 7. For demos, screenshots and any future videos

- Demos use catalog content (homebrew with permission) or dummy files.
- Show commercial titles' names/box art only if necessary and brief; prefer homebrew.
- Never show where to download commercial ROMs.
- Any published video description links to the content policy.
