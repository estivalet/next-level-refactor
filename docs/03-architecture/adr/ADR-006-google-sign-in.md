# ADR-006: Google sign-in via system browser + PKCE; API issues its own tokens

- **Status:** Accepted
- **Date:** 2026-10-20

## Context
Only paying users may use the launcher. Sign-in must be Google. Google blocks OAuth inside
embedded web views, and they are unsafe (the app could read the password).

## Decision
- The launcher uses the OAuth 2.0 **authorization code flow with PKCE** in the **system browser**,
  redirecting to a **loopback** listener on `127.0.0.1:<random port>` (RFC 8252). It sends the
  code + verifier to the API; the API exchanges it with Google and verifies the ID token.
- The API issues its own **JWT access token (15 min)** and an opaque **rotating refresh token
  (30 days)** bound to a device. Refresh tokens are stored hashed on the server and encrypted with
  Electron `safeStorage` on the client.
- The admin console uses the standard server-side redirect flow with an httpOnly session cookie.
- The launcher caches the entitlement with `offlineUntil` to support the offline grace period.

## Consequences
- Google tokens never leave the API; other providers can be added behind the same exchange.
- Refresh-token reuse detection revokes a stolen device session.
- Offline play is possible but bounded.

## Alternatives considered
- **Firebase Auth / Supabase Auth**: less code, but adds a vendor, and the owner wants a local backend first.
- **Custom URL scheme redirect** (`nextlevel://auth`): works, but loopback is simpler on Windows and is Google's recommendation for desktop apps.
