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
cp apps/api/.env.example apps/api/.env
npm run db:migrate -w apps/api
npm run db:seed -w apps/api # creates plans, scopes and the bootstrap admin from ADMIN_EMAILS
```

## Environment variables (`apps/api/.env`)

| Variable | Example | Required |
|---|---|---|
| `NODE_ENV` | `development` | yes |
| `PORT` | `4000` | yes |
| `PUBLIC_URL` | `http://localhost:4000` | yes |
| `DATABASE_URL` | `file:./data/nextlevel.db` | yes |
| `JWT_SECRET` | 64 random bytes, base64 | yes |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | from Google Cloud console (Desktop + Web clients) | yes (or `AUTH_STUB=1`) |
| `ADMIN_EMAILS` | `owner@example.com` | yes (bootstrap admin) |
| `BILLING_ENABLED` | `false` | yes; `true` from M8 |
| `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET` | test keys | when billing enabled |
| `STORAGE_DRIVER` | `local` or `s3` | yes |
| `STORAGE_LOCAL_DIR` | `./data/files` | when `local` |
| `S3_ENDPOINT` / `S3_BUCKET` / `S3_ACCESS_KEY_ID` / `S3_SECRET_ACCESS_KEY` | R2 values | when `s3` |
| `ADMIN_ORIGIN` | `http://localhost:5174` | dev only (CORS) |

The API validates these at startup (Zod) and refuses to start with a clear message if any are invalid.

Launcher dev config: `apps/launcher/.env.development` → `NEXTLEVEL_API_URL=http://localhost:4000`.
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
| `npm run db:migrate -w apps/api` / `db:generate` | apply / create Drizzle migrations |
| `npm run build` | build all apps |
| `npm run package -w apps/launcher` | build installer into `apps/launcher/dist` |

## Google OAuth setup (once)

1. Google Cloud console → new project "NextLevel".
2. OAuth consent screen: External, app name, support email, scopes `openid email profile`.
3. Credentials → **Desktop app** client (for the launcher loopback flow) and **Web application**
   client with redirect `http://localhost:4000/v1/auth/google/callback` (admin).
4. Put IDs/secrets in `apps/api/.env`. While the app is "Testing", add test users.

## Working without internet / Google

Set `AUTH_STUB=1` in the API: the launcher's sign-in completes against a local stub that lets you
pick a test user (`admin`, `subscriber`, `expired`, `suspended`). Never enabled in production builds.

## Troubleshooting

| Symptom | Fix |
|---|---|
| `better-sqlite3` "was compiled against a different Node.js version" | `npm run rebuild -w apps/launcher` |
| Electron window blank in dev | Vite dev server not up; check the `dev` script output port |
| Google sign-in returns `redirect_uri_mismatch` | Launcher must use the Desktop client; admin the Web client |
| Webhooks not arriving locally | `stripe listen --forward-to localhost:4000/v1/webhooks/stripe` |
