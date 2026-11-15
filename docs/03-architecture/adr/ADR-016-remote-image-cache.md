# ADR-016: Museum model images are fetched and cached by main

- **Status:** Accepted
- **Date:** 2026-11-15 (owner decision D67, option B; requirement FR-MUS-4)

## Context
Systems museum entries list models with a photo link (`imageUrl`, often Wikimedia). The renderer's
CSP (`img-src 'self' nextlevel: data:`, security-and-privacy §3) blocks remote images. Options were
to loosen the CSP to `https:`, to ship the images, or to fetch them in main.

## Decision
Main fetches each model image once and serves it as `nextlevel://remote-image/<base64url(url)>`;
the CSP is unchanged (`apps/launcher/src/main/remoteImages/`):

- https only and public hosts only (loopback, private, link-local, CGNAT and `.local` refused);
  redirects are followed by hand, at most 5, and every hop is checked the same way.
- No cookies or credentials; the URL is never logged; 15 s timeout.
- The body must sniff as png, jpeg, gif or webp and be at most 5 MiB.
- Files are cached in `<data>\cache\remote-images` as `<sha256(url)>.<ext>` (atomic write), 200 MiB
  in all with the oldest evicted; a failed URL is remembered for 24 h.

## Consequences
- The renderer never contacts third-party hosts and the CSP stays strict.
- This is a new fetch primitive in main on behalf of data a user can edit, so it is deliberately
  narrow; widening it (other types, other schemes) needs a new ADR.
- Photos are cached, so they show offline after the first view; a dead link shows a placeholder.
