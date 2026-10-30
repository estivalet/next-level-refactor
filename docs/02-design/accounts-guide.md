# Accounts guide

How signing in works in NextLevel (M7), for players and for the operator. Billing arrives in M8:
until then every allowed account is on the **Default** plan (3 devices; admins have no device
limit). Games from the online catalog: see the [catalog guide](catalog-guide.md).

## For players (the launcher)

### Signing in

1. Start NextLevel. Until you have signed in, it shows **Sign in with Google**.
2. Your web browser opens Google's page. Choose your account and approve.
3. The browser says "You can return to NextLevel"; the launcher continues on its own.

NextLevel never asks for your Google password itself, and Google's tokens never reach the
launcher: the NextLevel service talks to Google. On this PC the sign-in (with your name and
email) is kept in Windows' protected storage, so the next start skips this step.

If something goes wrong the sign-in screen says why, with **Try again**:

| Message | What happened |
|---|---|
| Sign-in was cancelled | You pressed Cancel on Google's page or in NextLevel |
| The browser didn't answer in time | Nothing came back within 5 minutes (also when you just close Google's tab) |
| This Google account isn't authorized | The operator hasn't allowed this account (see allow-list below) |
| Your account was deleted. | You deleted it from Account (shown as a notice, not an error) |
| This PC was signed out. Sign in again. | The device was removed (Revoke or "Remove and continue" on another PC, or the operator), or the sign-in was used from a copy of this PC's data |
| Can't reach NextLevel | The service is down or there is no internet |
| Sign-in failed | Anything else; try again |

### Playing offline

NextLevel checks your account when it starts and then every hour. Without internet it keeps
working on your last check for **14 days** (the operator can change this), and shows **Offline**
next to the clock and in a corner of the front-end. After that it asks you to connect to the
internet; once you are online, **Try again** continues without a new browser sign-in (the
grace is at most 30 days, as long as the sign-in itself lasts). Your games,
settings, menus and collections stay on this PC either way — nothing is deleted.

### Devices

Each plan allows a number of PCs at once (3 on the Default plan). Signing in on one more shows
your devices with **Remove and continue**: pick one to sign it out and this PC takes its place.

Open **Account** on the desktop to see your profile, your plan, when the account was last
checked (**Refresh** checks now), and your devices — **Revoke** signs another PC out at its next
check. **Sign out** removes the sign-in from this PC and frees its slot; your library stays.
(Signed out while offline, the PC keeps its slot until you revoke it from another PC.) Admins
see **Administrator** instead of a plan.

### Subscribing (when billing is on)

Without an active plan the launcher shows **Choose a plan** after signing in. Pick **Monthly**
or **Yearly**, then **Choose** on a plan: Stripe's checkout page opens in your browser (NextLevel
never sees your card). Pay there; the launcher shows "Waiting for your payment…" and unlocks by
itself as soon as the payment goes through (usually seconds; **I've already paid** checks now).
Changed your mind? **Choose another plan**. There is no free trial.

In **Account**, the plan line says what you pay and until when ("Basic · Monthly · Renews on
12 Nov 2026"). **Manage billing** opens Stripe's billing page in your browser: change the plan
or the card, see invoices, or cancel. Cancelling keeps access until the end of the paid period
("Ends on …"). If a payment fails, Account says "Payment failed — update your payment details"
and you keep playing while Stripe retries; if every retry fails, the launcher asks you to
subscribe again. A complimentary plan from the operator shows "Complimentary · until …" and has
nothing to pay; offline play stops on its last day.

### Your data

**Account → Download my data** saves a JSON file (`nextlevel-data-<date>.json`, where you choose)
with what the service keeps about you: profile, devices, subscriptions and the changes the
operator made to your account. **Delete account…** asks you to type your email: it cancels a
paid subscription at once (no automatic refund — ask the operator), deletes the account and its
devices on the service, and signs this PC out. Your games, settings, menus and collections on
this PC stay as they are. Signing in again later starts a new account.

### Suspended accounts

If the operator suspends an account, the launcher locks at its next check (within an hour while
online; an offline launcher locks when it reconnects) and shows "This account is suspended"
with Sign out. Unsuspending unlocks it at the next check. **Refresh** in Account checks at
once. Local data is untouched.

## For the operator (admin console)

### Running it locally

1. `apps/api/.env` from `.env.example` (set `JWT_SECRET`; `AUTH_STUB=1` for the test personas, or
   the two Google clients — see `docs/05-operations/environment-setup.md`).
2. `npm run dev` starts the API (:4000), the console (http://localhost:5174) and the launcher.
3. Open the console and **Sign in with Google**. Addresses in `ADMIN_EMAILS` become admins the
   first time they sign in; other admins are made in the console.

With `AUTH_STUB=1` the "Google" page is a local list of test accounts: `admin@nextlevel.test`
(put it in `ADMIN_EMAILS` before its first sign-in), `subscriber@nextlevel.test`,
`suspended@nextlevel.test` (starts suspended) — these three get in whatever the sign-up mode —
and `outsider@nextlevel.test` (refused unless anyone may sign in).

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
| Offline grace (days) | How long a launcher runs without reaching the service (1–30, default 14); applies from each launcher's next check |
| Who can sign in | **Admins and the allow-list** (default), **Anyone with a Google account**, or **Existing accounts only** |
| Allow-list | One email per line; letter case doesn't matter |
| Maintenance banner | Up to 280 characters, shown on the launcher's sign-in, suspended and subscribe screens and as a strip on its desktop (players can dismiss it) |

Changing the allow-list never signs anyone out; to stop an existing account, suspend it.

### Billing (M8)

`BILLING_ENABLED` in the API's environment is the switch (D33):

- **Off:** everyone allowed in is on the **Default** plan (3 devices).
- **On:** players need an active or payment-failed Stripe subscription, or a complimentary
  grant. Everyone else can sign in but sees **Subscribe** in the launcher. Admins never need one.
  Users with no plan get the Default plan's device limit.

Plans have a name, a device limit, catalog scopes and up to two Stripe prices (monthly,
yearly). Saving a price id checks it with Stripe: active, recurring, the right interval, one
currency per plan, and not already on another plan. **Default** can't be archived; an archived
plan keeps the people on it but can't be bought or granted. There is no free trial (D34).

A **complimentary grant** gives a user a plan with an optional end date and a required note. It
can be revoked, and a new grant replaces the current one. A user who pays through Stripe can't
get a grant until their subscription ends. When a grant ends, the launcher stops at the end
date even offline.

When a payment fails, Stripe retries for some days and the player keeps access ("payment
failed" in the console); if every retry fails, access ends. Cancelling in the Customer Portal
keeps access to the end of the paid period. Refunds are done by hand in the Stripe Dashboard.
Setting up Stripe test mode, or the stub that needs no Stripe account:
`docs/05-operations/environment-setup.md`.

### Plans, scopes and complimentary access

**Plans** lists every plan with its prices, devices, scopes and how many people are on it.
**New plan** or a plan's name opens the editor: name, device limit (1–20), catalog scopes,
and the Stripe price ids for monthly and yearly (copy them from the Stripe Dashboard; the amount
is read from Stripe when you save and shown under the field). A refused price says why on the
field. **Archived** takes a plan off sale; the people on it keep it. The Default plan can't be
archived. **Catalog scopes** are the groups of catalog items a plan includes (used from M9).

In a user's page, **Subscription** shows what gives them access (Stripe subscription with its
id, or a complimentary grant) and the history. **Grant complimentary access** picks a plan, an
optional last day (access ends at the end of that day, UTC) and a note for the audit log; a new
grant replaces the current one, and someone paying through Stripe must cancel first.
**Revoke grant** ends it (the launcher locks within an hour). The Users list filters by access
(Active, Payment failed, No access, Complimentary) and by plan.

**Delete account…** on a user (not for admins: demote first) needs their email typed: a Stripe
subscription is cancelled at once without a refund (refund by hand in Stripe if needed), and
the account is deleted; audit entries stay without the email.

### Audit log

Every change made in the console — role, suspension, device revoke, settings, plans, scopes,
complimentary grants — is recorded with
who did it, when, and what changed (before → after). Filter by admin id or target id.
