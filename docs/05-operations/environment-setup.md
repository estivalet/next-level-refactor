# Environment setup

How to get the monorepo running on a development machine. Applies once the new repository exists
(milestone M0); commands below are the target scripts.

## Prerequisites

| Tool | Version | Notes |
|---|---|---|
| Windows | 10 22H2+ / 11, x64 | primary dev and target OS |
| Node.js | 24 LTS | `nvm-windows` recommended; `.nvmrc` in repo |
| npm | 10+ | ships with Node |
| Git | 2.40+ | |
| Visual Studio Build Tools | 2022, "Desktop development with C++" | needed to rebuild `better-sqlite3` for Electron |
| Python | 3.x | only required by `node-gyp` during native rebuilds |
| Docker Desktop | optional | to run the API as in production |
| Stripe CLI | optional (M8+) | forward webhooks to the local API |
| An editor | VS Code + ESLint, Prettier, Tailwind CSS IntelliSense extensions | |

## First-time setup

```bash
git clone <repo-url> nextlevel
cd nextlevel
npm install                 # installs all workspaces, rebuilds native modules for Electron
cp apps/api/.env.example apps/api/.env   # then set JWT_SECRET (the file says how)
# The API creates and migrates its database and seeds the Default plan when it starts;
# ADMIN_EMAILS accounts become admins the first time they sign in.
```

## Environment variables (`apps/api/.env`)

| Variable | Example | Required |
|---|---|---|
| `NODE_ENV` | `development` | yes |
| `PORT` | `4000` | yes |
| `PUBLIC_URL` | `http://localhost:4000` | yes |
| `DATABASE_URL` | `file:./data/nextlevel.db` | yes |
| `JWT_SECRET` | 64 random bytes, base64 (≥ 32 bytes) | yes |
| `JWT_SECRET_PREVIOUS` | the secret before a rotation | no; access tokens signed with it still verify |
| `GOOGLE_CLIENT_ID_DESKTOP` / `GOOGLE_CLIENT_SECRET_DESKTOP` | Google Cloud **Desktop app** client (launcher loopback sign-in) | yes, unless `AUTH_STUB=1` |
| `GOOGLE_CLIENT_ID_WEB` / `GOOGLE_CLIENT_SECRET_WEB` | Google Cloud **Web application** client (admin console) | yes, unless `AUTH_STUB=1` |
| `AUTH_STUB` | `1` | no; development and tests only, refused with `NODE_ENV=production` |
| `ADMIN_EMAILS` | `owner@example.com` (comma list) | yes (bootstrap admin: becomes admin when its account is created) |
| `BILLING_ENABLED` | `false` or `true` | yes; `true` = access needs an active or past-due Stripe subscription or an active comp grant (D33) |
| `BILLING_STUB` | `1` | no; fake Checkout/Portal and signed webhooks (D32); development and tests only, refused with `NODE_ENV=production` |
| `STRIPE_SECRET_KEY` | `sk_test_…` | when `BILLING_ENABLED=true` and `BILLING_STUB` is not `1` |
| `STRIPE_WEBHOOK_SECRET` | `whsec_…` (from `stripe listen` or the Dashboard endpoint) | when `BILLING_ENABLED=true` and `BILLING_STUB` is not `1`; the stub uses a fixed dev value |
| `STORAGE_DRIVER` | `local` or `s3` | yes |
| `STORAGE_LOCAL_DIR` | `./data/files` | when `local` |
| `S3_ENDPOINT` / `S3_BUCKET` / `S3_ACCESS_KEY_ID` / `S3_SECRET_ACCESS_KEY` | R2 values | when `s3` |
| `ADMIN_ORIGIN` | `http://localhost:5174` | dev only: where the admin sign-in returns (the Vite dev server) |
| `ADMIN_DIST` | `../admin/dist` | no; the built admin console the API serves at `/` |

The API validates these at startup (Zod) and refuses to start with a clear message if any are invalid.

Launcher dev config: the API address is fixed per build (`MAIN_VITE_API_URL`, default
`http://localhost:4000`). Development builds also honour `NEXTLEVEL_API_URL` (another API) and
`NEXTLEVEL_AUTH=off` (no sign-in gate, D25); packaged builds ignore both. End-to-end tests run
with sign-in off except `e2e/auth.spec.ts`, which starts the real API in-process with the stub.
The launcher stores its own data under `%APPDATA%/NextLevel-dev` in development so it never
touches a production install.
There you'll find `settings.json`, `backups/` and `logs/main.log`. End-to-end tests set
`NEXTLEVEL_USER_DATA` to a fresh temp folder (honoured only by development builds), so they never
read or write your dev data.

## Daily commands

| Command | Does |
|---|---|
| `npm run dev` | API + admin + launcher together |
| `npm run dev -w apps/launcher` | launcher only (Electron + Vite HMR) |
| `npm run dev -w apps/api` | API with watch mode |
| `npm run dev -w apps/admin` | admin console (Vite) |
| `npm run lint` | ESLint + Prettier check, all workspaces |
| `npm run typecheck` | `tsc -b` across project references |
| `npm test` | Vitest, all workspaces |
| `npm run test:e2e` | Playwright (launcher + admin) |
| `npm run db:generate -w apps/api` | create a Drizzle migration after a schema change (the API applies pending migrations at start) |
| `npm run build` | build all apps |
| `npm run package -w apps/launcher` | build installer into `apps/launcher/dist` |

## Google OAuth setup (once)

1. Google Cloud console → new project "NextLevel".
2. OAuth consent screen: External, app name, support email, scopes `openid email profile`.
3. Credentials → **Desktop app** client (for the launcher loopback flow) and **Web application**
   client with redirect `http://localhost:4000/v1/auth/google/callback` (admin).
4. Put the Desktop client in `GOOGLE_CLIENT_ID_DESKTOP` / `GOOGLE_CLIENT_SECRET_DESKTOP` and the
   Web client in `GOOGLE_CLIENT_ID_WEB` / `GOOGLE_CLIENT_SECRET_WEB` in `apps/api/.env`. While the
   app is "Testing", add test users.

## Stripe test mode (once, D31)

M8 uses Stripe in **test mode only**; live keys are a go-live step (M10).

1. Stripe Dashboard in **Test mode** → Product catalog: one product per plan, each with a
   recurring **monthly** and/or **yearly** price in one currency.
2. Settings → Billing → **Customer portal**: allow cancelling **at the end of the billing
   period**, allow switching plans, and list exactly the prices the NextLevel plans use.
3. Developers → API keys: put the secret key (`sk_test_…`) in `STRIPE_SECRET_KEY`.
4. Webhooks to your machine: install the [Stripe CLI](https://docs.stripe.com/stripe-cli), then
   `stripe login` and `stripe listen --forward-to localhost:4000/v1/webhooks/stripe`. Put the
   `whsec_…` it prints in `STRIPE_WEBHOOK_SECRET`. Leave `BILLING_STUB` unset.
5. Set `BILLING_ENABLED=true`, start the API, and in the admin console give each plan its Stripe
   price ids (the API reads the amounts from Stripe).
6. Pay with Stripe's test card `4242 4242 4242 4242`, any future date, any CVC.

## Working without Stripe (billing stub, D32)

`BILLING_STUB=1` replaces Stripe with fake Checkout and Portal pages on the API itself, marked
"TEST — no real payment". Plans take stub price ids of the form
`price_stub_<month|year>_<amount in minor units>_<currency>`, e.g. `price_stub_month_1990_brl`.
**Pay** creates the subscription; the Portal page has Cancel at period end, Resume, Payment
fails, Renew, End now and Switch buttons. Each sends signed webhooks to the API like Stripe does.
Stub state lives in memory: restarting the API forgets stub subscriptions (the database keeps
its rows). Never enabled in production.

## Working without internet / Google

Set `AUTH_STUB=1` in the API: sign-in (launcher and admin console) goes to a local page that lets
you pick a test user — `admin`, `subscriber`, `suspended` or `outsider`, signing in as
`<persona>@nextlevel.test`. `admin`, `subscriber` and `suspended` count as allow-listed;
`suspended` is created suspended; `outsider` is refused (`NOT_ALLOWED`). Put
`admin@nextlevel.test` in `ADMIN_EMAILS` to get a stub admin. Never enabled in production.

## Troubleshooting

| Symptom | Fix |
|---|---|
| `better-sqlite3` "was compiled against a different Node.js version" | `npm run rebuild -w apps/launcher` |
| Paid in Stripe but the launcher still shows Subscribe | `stripe listen` must be running with its `whsec_…` in `STRIPE_WEBHOOK_SECRET`; check the API log for `stripe event not applied` (price not on any plan) |
| Electron window blank in dev | Vite dev server not up; check the `dev` script output port |
| Google sign-in returns `redirect_uri_mismatch` | Launcher must use the Desktop client; admin the Web client |
| Webhooks not arriving locally | `stripe listen --forward-to localhost:4000/v1/webhooks/stripe` |
