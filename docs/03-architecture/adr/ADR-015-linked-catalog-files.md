# ADR-015: Catalog files can be links to Google Drive or archive.org

- **Status:** Accepted
- **Date:** 2026-11-14 (owner decision D65; requirement FR-CAT-9)

## Context
Catalog files live in the API's `FileStore`: the local disk today, R2 (S3) prepared but on hold
(D57; owner, 2026-11-14) because it costs money. The owner wants free places to keep game files
without paying for AWS/R2. The content is rights-cleared (ADR-012): homebrew, freeware and the
like that may be shared by license.

## Decision
A catalog file is either **uploaded** (as before) or a **link** to a copy on Google Drive or
archive.org (owner choice A, 2026-11-14):

- The admin pastes a share link. The API normalizes it to a direct download link, downloads it
  once in the background to record size and SHA-256, and keeps no copy. An HTML page (Drive's
  virus-scan or quota page), a redirect off Google/archive.org, an HTTP error, a dropped body or
  a file over the upload limit fails the link with a reason; it is never handed out.
- **Check again** re-verifies a ready link; a different file becomes a new item version (D42).
- A download grant hands a linked file's host link (`linked: true`). The launcher downloads it
  directly and checks the SHA-256 before installing, as for any file. A host refusal (403, 429, a
  text page) pauses the download `hostLimit` until the player resumes it; 404/410 fails it
  `linkGone`.
- License records stay required to publish (ADR-012).

## Consequences
- Linked files cost no server disk or bandwidth.
- Their links are public and permanent: a subscriber could share one, and FR-CAT-6's 10-minute,
  per-user URLs don't apply to them. The API still checks the subscription and device and logs
  each grant. Accepted because the content may be shared by license.
- Drive's daily download limit can pause installs of a popular file; the player sees why.
- A file replaced at its host fails the checksum check until the admin uses Check again.

## Alternatives considered
- **The API streams the file from the host (B)**: keeps links private and FR-CAT-6 intact, but every
  download costs server bandwidth and time: it saves disk only. Rejected.
- **Upload to the host automatically through its API**: needs Google OAuth or archive.org keys on
  the server for little gain over pasting a link. Rejected.
