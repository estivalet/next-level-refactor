# Accounts guide

How signing in works in NextLevel (M7), for players and for the operator. Billing arrives in M8:
until then every allowed account is on the **Default** plan (3 devices).

## For players (the launcher)

### Signing in

1. Start NextLevel. Until you have signed in, it shows **Sign in with Google**.
2. Your web browser opens Google's page. Choose your account and approve.
3. The browser says "You can return to NextLevel"; the launcher continues on its own.

NextLevel never asks for your Google password itself, and your Google account details stay with
the NextLevel service. On this PC the sign-in is kept in Windows' protected storage, so the next
start skips this step.

If something goes wrong the sign-in screen says why, with **Try again**:

| Message | What happened |
|---|---|
| Sign-in was cancelled | You closed Google's page or pressed Cancel |
| The browser didn't answer in time | Nothing came back within 5 minutes |
| This Google account isn't authorized | The operator hasn't allowed this account (see allow-list below) |
| This PC was signed out | The device was removed (by you on another PC, or by the operator) |
| Can't reach NextLevel | The service is down or there is no internet |

### Playing offline

NextLevel checks your account when it starts and then every hour. Without internet it keeps
working on your last check for **14 days** (the operator can change this), and shows **Offline**
next to the clock and in a corner of the front-end. After that it asks you to connect to the
internet; once you are online, **Try again** continues without a new browser sign-in. Your games,
settings, menus and collections stay on this PC either way — nothing is deleted.

### Devices

Each plan allows a number of PCs at once (3 on the Default plan). Signing in on one more shows
your devices with **Remove and continue**: pick one to sign it out and this PC takes its place.

Open **Account** on the desktop to see your profile, your plan, when the account was last
checked (**Refresh** checks now), and your devices — **Revoke** signs another PC out at its next
check. **Sign out** removes the sign-in from this PC and frees its slot; your library stays.

### Suspended accounts

If the operator suspends an account, the launcher locks at its next check (within an hour) and
shows "This account is suspended" with Sign out. Local data is untouched.

## For the operator (admin console)

### Running it locally

1. `apps/api/.env` from `.env.example` (set `JWT_SECRET`; `AUTH_STUB=1` for the test personas, or
   the two Google clients — see `docs/05-operations/environment-setup.md`).
2. `npm run dev` starts the API (:4000), the console (http://localhost:5174) and the launcher.
3. Open the console and **Sign in with Google**. Addresses in `ADMIN_EMAILS` become admins the
   first time they sign in; other admins are made in the console.

With `AUTH_STUB=1` the "Google" page is a local list of test accounts: `admin@nextlevel.test`
(put it in `ADMIN_EMAILS`), `subscriber@nextlevel.test`, `suspended@nextlevel.test` (starts
suspended) and `outsider@nextlevel.test` (not allowed).

### Users

Search by email or name, filter by status, and open a user to:

- change the **role** (Admin / Subscriber),
- **Suspend** with a reason (shown in the audit log; the launcher locks within an hour) or
  **Unsuspend**,
- **Revoke** one of their devices (that launcher is signed out at its next request).

You can't demote or suspend yourself, so there is always an admin left.

### Settings

| Setting | Effect |
|---|---|
| Offline grace (days) | How long a launcher runs without reaching the service (1–90, default 14); applies from each launcher's next check |
| Who can sign in | **Admins and the allow-list** (default), **Anyone with a Google account**, or **Existing accounts only** |
| Allow-list | One email per line; letter case doesn't matter |
| Maintenance banner | Up to 280 characters, shown on the launcher's sign-in screens and as a strip on its desktop |

Changing the allow-list never signs anyone out; to stop an existing account, suspend it.

### Audit log

Every change made in the console — role, suspension, device revoke, settings — is recorded with
who did it, when, and what changed (before → after). Filter by admin id or target id.
