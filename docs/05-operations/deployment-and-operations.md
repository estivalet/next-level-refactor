# Deployment & operations

Target setup for production (milestone M10). Choices marked **(proposed)** are defaults to confirm.

## 1. Topology

```mermaid
flowchart LR
  subgraph Users
    L[Launcher installs]
    B[Admin browser]
  end
  GH[GitHub Releases<br/>installer + update feed] --> L
  L -- HTTPS --> CF[Cloudflare<br/>DNS + TLS + WAF]
  B -- HTTPS --> CF
  CF --> VPS
  subgraph VPS [VPS — Docker]
    API[nextlevel-api container<br/>API + admin static files]
    VOL[(volume: SQLite + logs)]
    API --- VOL
  end
  API --> R2[(Cloudflare R2<br/>catalog files)]
  L -- presigned URL --> R2
  API --> GOOG[Google OAuth]
  API --> STR[Stripe]
  VOL -- nightly --> BK[(Off-site backup<br/>R2 bucket, separate keys)]
```

**(proposed)**: one small VPS (2 vCPU / 4 GB, e.g. Hetzner), Docker Compose, Caddy or Cloudflare
for TLS, Cloudflare R2 for files (no egress fees, which matters for game downloads).

## 2. Launcher distribution

- **Build:** GitHub Actions on `windows-latest`: `npm ci` → test → `electron-builder --win nsis`.
- **Signing:** code-signing certificate (OV or EV; Azure Trusted Signing is a cheaper option) to
  avoid SmartScreen warnings. Secrets in GitHub Actions.
- **Channels:** `beta` and `stable` update feeds on GitHub Releases via `electron-updater`.
  Every release goes to `beta` first for at least 48 h.
- **Versioning:** SemVer. `0.<milestone>.<patch>` until 1.0.
- **Update behaviour:** download in background, install on quit; the user can defer. A minimum
  supported version (`app_settings.minLauncherVersion`) lets the API refuse very old clients with
  `UPDATE_REQUIRED`.

## 3. API & admin deployment

- **Image:** `Dockerfile` (M10c, D56): `node:24-slim`, builds `apps/admin` and serves it from
  `ADMIN_DIST` at `/`; runs `node apps/api/src/server.ts` as the `node` user with the `/data`
  volume (`DATABASE_URL=file:/data/nextlevel.db`, `HOST=0.0.0.0`). Tagged
  `ghcr.io/estivalet/nextlevel-api:<version>` (`apps/api/package.json`).
- **Compose:** `deploy/compose.yaml`: `api`, `caddy` (ports 80/443, certificates for
  `NEXTLEVEL_DOMAIN`, `deploy/Caddyfile`) and `backup` (the same image running
  `apps/api/src/ops/backup.ts --daily`). The server's `.env` comes from `deploy/.env.example`.
- **Deploy:** `.github/workflows/deploy-api.yml`. Every run builds the image and boots it in
  production mode (dummy Google clients, billing off): it must answer `/v1/health` with its
  version. A manual run stops there unless *deploy* is ticked; with it, or on an `api-v*` tag
  (checked against `apps/api/package.json`), the image is pushed and `docker compose pull && up -d`
  runs over SSH, then the public `/v1/health` is checked. Caddy is the only way in, so the API
  believes its `X-Forwarded-For` (`TRUST_PROXY=true` in compose). Migrations run at container start **after** an automatic snapshot,
  `<db>.pre-<version>.bak`, next to the database. **Nothing is deployed yet** (D56, no-spending
  rule, 2026-10-30): the API runs locally.
- **Config:** environment variables (see [environment-setup](environment-setup.md#environment-variables-appsapienv)),
  stored as GitHub environment secrets and written to the server's `.env` (mode 600).
- **Zero-downtime:** not required at this scale; deploys take seconds. Announce maintenance via the
  admin banner for migrations that take longer.

## 4. Backups & recovery

| What | How | Frequency | Retention |
|---|---|---|---|
| API SQLite DB | `ops/backup.ts`: SQLite online backup → gzip → `backups/<date>.db.gz` + `backups/heartbeat.json` in the `BACKUP_S3_*` bucket (its own token; else the file store) (M10c); `<db>.pre-<version>.bak` next to the database before migrations | 03:00 UTC daily + before each migration | 30 days, and the first of each month 12 months |
| Catalog files | `FILE_STORE=local`: `FILES_DIR` on the API machine (default `<database folder>/files`, D40) — back it up with the database. `FILE_STORE=s3`: R2, which keeps **no old versions: a delete is final**. Keep the originals you uploaded outside R2. The maintenance job deletes stored files no row names after 24 h, but deletes nothing when the database names none of the stored files or a run would remove more than a tenth of them (and over 25) — it logs "orphan sweep skipped" instead | continuous | — |
| License evidence | same as catalog files, separate prefix | continuous | life of the item + 3 years |
| Launcher user data | user's machine: settings backups (10), library DB backup before migrations | on change | — |

**Restore drill:** quarterly, restore the latest backup into staging and run the smoke test.
Recovery targets: RPO 24 h, RTO 4 h.

## 5. Monitoring & logging

| Signal | Tool | Alert |
|---|---|---|
| Uptime of `/v1/health` | UptimeRobot / Better Stack (free tier) | 2 consecutive failures → email/Telegram |
| API logs | pino JSON → Docker logs → rotated; optional shipping to Better Stack | error rate > 2% over 5 min |
| Webhook failures | Stripe dashboard + `stripe_events` unprocessed count | any event unprocessed > 10 min |
| Disk usage on VPS | node exporter or simple cron script | > 80% |
| Backups | backup job writes a heartbeat | no heartbeat in 26 h |
| Launcher crashes | local logs; opt-in crash reports (Sentry, scrubbed) | new crash signature |

Logs never contain tokens, email addresses or IPs in clear text (user ID and hashed IP only).

## 6. Runbooks

### Webhook backlog
1. Check Stripe dashboard → Developers → Webhooks for failed deliveries, and
   `select id, type, received_at from stripe_events where processed_at is null`.
2. Fix cause, then "Resend" failed events; idempotency makes this safe (an event already
   processed is answered without work; each event re-reads the subscription from Stripe, so
   order doesn't matter).
3. Confirm `subscriptions` rows updated; affected launchers refresh within an hour.

### "stripe event not applied" in the log
The event was stored as processed but changed nothing (`reason` in the log line):
- `unknownPrice`: the subscription's price is on no plan. The Customer Portal offered a price the
  plans don't carry. Make the Portal's products match the plans (environment-setup → Stripe),
  put the price on the right plan, then resend the event from Stripe.
- `unknownUser`: no `userId` metadata, or the user was deleted. Subscriptions made outside
  NextLevel's checkout are not ours; cancel or refund them in Stripe by hand.
- `userChanged`: the subscription's `userId` metadata was edited in Stripe. Put it back.

### BILLING_UNAVAILABLE (503)
Stripe couldn't be reached or answered with an error. Players see "Billing is unavailable right
now"; nothing was charged or changed. Check https://status.stripe.com and the API log (Stripe
ids only). Webhooks that failed the same way are retried by Stripe for up to 3 days.

### Restore database
1. Stop API container. 2. Download the chosen backup from the backup bucket. 3. Replace the DB
file on the volume. 4. Start the container (migrations run if needed). 5. Run the smoke test.
6. Replay Stripe events since backup time (Stripe → resend) to recover subscription changes.

### Revoke everything for a compromised account
Admin console → user → Suspend (sessions die at next refresh, ≤ 15 min) → revoke all devices.

### Rotate secrets
`JWT_SECRET` rotation supports two active keys (`kid` header): add the new one, deploy, wait 30 days
(refresh lifetime), remove the old one. Google/Stripe/R2 keys: create new, deploy, revoke old.

### Remove a catalog item urgently (takedown)
As built (M9): Admin console → Catalog → the item → **Publish** tab → set **When it leaves the
catalog** to **Remove** (saved at once) → **Unpublish** (confirm). New download links stop at
once (an issued link for an unpublished item answers 410). Installed copies are deleted at each
launcher's next online sign-in check (at start and hourly), and the player sees which games
went. The audit log records the change and the unpublish with the admin. If the license itself is
the problem, saving a new license also unpublishes the item until it is verified again. Write the
request (who asked, when, why) in the item's notes outside the system; the audit log has the
actions.

### Restore a backup

1. `docker compose stop api backup` on the server.
2. Download `backups/<date>.db.gz` from the backup bucket (R2 dashboard or `rclone`), `gunzip` it.
3. In the `data` volume, move `nextlevel.db` aside **with** `nextlevel.db-wal` and
   `nextlevel.db-shm` (a WAL left next to the restored file would be replayed onto it), copy the
   backup in as `nextlevel.db` and give it to the image's user: `chown 1000:1000 nextlevel.db`.
4. `docker compose up -d`, then the smoke test below. A `.pre-<version>.bak` from a failed
   migration is restored the same way (it isn't gzipped).
5. Catalog files uploaded after the backup's date are no longer named by the database: the
   maintenance job deletes them after 24 hours (a few at a time; it refuses when that is most of
   the store). Download any you'll add again from the bucket first.

## 7. Smoke test (after every deploy)

1. `GET /v1/health` → version matches.
2. Admin console loads and signs in.
3. Test subscriber launcher (staging build) signs in, lists catalog, downloads the 1 KB test item.
4. Stripe test webhook (staging) processes.

## 8. Provisioning (when the owner chooses to host)

Written in M10c and not carried out (D56, D59: no-spending rule, 2026-10-30). In order:

1. **VPS:** one small server (Hetzner CX22 or similar), Ubuntu LTS, SSH key login only, a firewall
   allowing 22, 80 and 443. Install Docker Engine and the compose plugin. Make `/opt/nextlevel`
   and copy `deploy/compose.yaml` and `deploy/Caddyfile` into it.
2. **DNS:** an `A` (and `AAAA`) record for the API host name (e.g. `api.example.com`) to the
   server. Caddy gets the certificate on first start.
3. **R2:** two buckets, `nextlevel-catalog` and `nextlevel-backups`, each with its own R2 API token
   limited to it (Object Read & Write). The endpoint is
   `https://<account id>.r2.cloudflarestorage.com`. R2 keeps no old versions of objects. Move
   existing local files in once with `rclone copy <FILES_DIR> r2:nextlevel-catalog`.
4. **The database:** copy the current `nextlevel.db` (after `sqlite3 nextlevel.db ".backup
   copy.db"` on the old machine) into the `data` volume as `nextlevel.db`, `chown 1000:1000`. An
   API started with an empty database never sweeps the copied files (the sweep's guard), but it
   has no catalog either.
5. **Server `.env`:** from `deploy/.env.example`, mode 600: `NEXTLEVEL_DOMAIN`, `PUBLIC_URL`, a new
   `JWT_SECRET` (`openssl rand -base64 64`), `ADMIN_EMAILS`, the Google clients (step 7),
   `FILE_STORE=s3` with the catalog bucket, `BACKUP_S3_*` with the backup bucket,
   `BILLING_ENABLED=false`. Never point another environment (development, staging) at these
   buckets.
6. **GitHub and GHCR:** repository secrets `DEPLOY_HOST`, `DEPLOY_USER`, `DEPLOY_SSH_KEY` (a
   deploy-only key on the server) and `DEPLOY_URL` (`https://api.example.com`). The workflow
   pushes to GHCR with its own token; the package is private, so on the server run
   `docker login ghcr.io` once with a personal access token that only has `read:packages` (or
   make the package public).
7. **Google OAuth production clients:** in the production Google Cloud project, a *Desktop app*
   client (launcher) and a *Web application* client (admin) with
   `https://api.example.com/v1/auth/google/callback` as redirect URI; publish the consent screen.
   Launcher builds point at the API with `MAIN_VITE_API_URL` at build time (add it to the release
   workflow's environment then; it isn't set today).
8. **First deploy:** run *Deploy API* with *deploy* ticked (or push `api-v<version>`, which must
   match `apps/api/package.json`). It boots the image in production mode first, then deploys and
   checks the public `/v1/health`. Then the smoke test (§7) and a backup restore drill (§6) on a
   copy.
9. **Stripe live switch (after D32):** only once the owner's test-mode check passed: live
   products and prices, a live webhook endpoint (`/v1/webhooks/stripe`), `STRIPE_SECRET_KEY` /
   `STRIPE_WEBHOOK_SECRET` live values, then `BILLING_ENABLED=true` and a redeploy (D58).

