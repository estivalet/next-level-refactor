# Privacy policy (draft)

> **Draft for review, not in force.** Written by the developers from what the software does
> (M10, 2026-11-13). It is not legal advice and must be reviewed by a lawyer in the operator's
> jurisdiction (LGPD in Brazil, GDPR in the EU) before NextLevel is offered to the public.
> Engineering details: [security-and-privacy.md](security-and-privacy.md) §5.

**Who we are.** NextLevel ("we") is operated by `<operator name, address, contact email>`.

## What we collect

| What | Why | Kept for |
|---|---|---|
| Your Google account's id, email, name and picture link | to sign you in and contact you | while your account exists |
| Your devices (the name you see, Windows version, NextLevel version, last seen) | device limits and security | until removed, plus 90 days |
| Your subscription (plan, status, Stripe customer and subscription ids) | to give access you paid for | while your account exists; invoices are kept by Stripe as tax law requires |
| Each catalog download (you, the file, the time and a one-way hash of your IP address, never the address itself) | abuse prevention and license reports to rights holders | 12 months |
| What our operators change on your account (audit log) | accountability | 3 years, without your email after you delete the account |
| Only if you turn on Settings → Sync: your language, theme and sound choices, input mapping, scraper preferences, menus, collections, smart filters, and per game favorite, hidden, completed, rating, play count, play time and last played | to keep your PCs the same | until you choose Delete synced data or delete your account |

We **never** collect your card details (Stripe handles payment), your game files, your folders
or paths, the list of games on your PC (except game identifiers inside synced data, if you turn
sync on), or analytics about how you use NextLevel.

## Who processes it for us

- **Google** — sign-in.
- **Stripe** — payments, when billing is on.
- **Cloudflare** (R2 storage) and our server host `<hosting provider>` — where the service and its
  daily backups (kept 30 days) run.

We don't sell your data or share it with anyone else, except where the law requires it.

## Your rights

In the launcher's **Account** app:

- **Download my data** gives you a file with everything above that is tied to you.
- **Delete account** removes your account, devices, subscriptions and synced data. A paid
  subscription is cancelled at once. Audit entries keep no email; download records lose their
  link to you.
- **Settings → Sync → Delete synced data** removes only the synced data.

You can also write to `<contact email>` to access, correct or delete your data, or to object to
how it is used. You may complain to your data protection authority (ANPD in Brazil).

## Changes

We'll say in the launcher and on this page when this policy changes. Last updated: `<date>`.
