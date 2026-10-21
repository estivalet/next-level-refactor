# M0 Foundations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** An npm-workspaces monorepo that lints, type-checks and tests in GitHub Actions, with an Electron launcher window that says "Hello" and shows the app version, fetched through the typed IPC bridge.

**Architecture:** Workspaces `apps/*` and `packages/*` with shared presets in `packages/config`. Packages are consumed as TypeScript source (no package build step) and type-checked with `tsc -b` project references. The launcher is built by `electron-vite`. Its "Hello" screen calls `window.nextlevel.invoke('app.version')`, which goes through the Zod-validated IPC router, so M0 proves the contract → preload → router → renderer path that every later milestone uses.

**Tech Stack:** Node 24 LTS, npm 11, TypeScript 5 (strict), Electron 43, electron-vite, React 19, Vite, Tailwind CSS 4, Zod 4, i18next + react-i18next, Vitest, Testing Library, Playwright, ESLint 9 (flat config) + typescript-eslint + eslint-plugin-import, Prettier, GitHub Actions.

**Spec:** `docs/01-product/roadmap.md` (M0 row and milestone exit criteria), `CLAUDE.md`, `docs/03-architecture/05-architecture.md` §2–4.1 and §7, `docs/03-architecture/api-spec.md` §3, `docs/03-architecture/coding-standards.md`, `docs/04-quality/test-strategy.md`, `docs/05-operations/environment-setup.md`, ADR-001, ADR-002, ADR-005, ADR-013.

## Global Constraints

- Node **24** LTS (owner decision 2026-10-21, replacing "22 LTS" in the docs); `.nvmrc` contains `24`; root `package.json` `"engines": { "node": ">=24" }`.
- Every `package.json` has `"type": "module"`; package names are `@nextlevel/<folder>`; `"private": true` everywhere.
- TypeScript: `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `verbatimModuleSyntax`. No `any`.
- `packages/*` never import from `apps/*`; `packages/themes` and `packages/ui` never import Node built-ins or `electron`. These are enforced by ESLint `import/no-restricted-paths` + `no-restricted-imports`.
- Renderer: `contextIsolation: true`, `sandbox: true`, `nodeIntegration: false`, strict CSP. It only talks to main through `window.nextlevel`.
- IPC calls never throw across the bridge. They return `Result<T>` = `{ ok: true, value: T } | { ok: false, error: AppError }`.
- All user-visible strings go through `t('…')`; English keys live in `packages/shared/src/i18n/en.json`.
- Files ≤ 400 lines, components ≤ 200 lines. Tests sit next to the file as `*.test.ts(x)` and are named with requirement IDs (`NFR-MAINT-1: …`).
- Conventional Commits with scopes `launcher`, `api`, `admin`, `themes`, `shared`, `catalog`, `docs`, `ci`. Work on branch `chore/m0-foundations`.
- Nothing reads or imports `../NextLevelOS`. M0 ports nothing.
- No secrets, ROMs or BIOS files anywhere.

## Review Focus

1. **Malformed IPC input from the renderer** (wrong type, extra payload). Expect `{ ok: false, error: { code: 'VALIDATION_FAILED' } }`, not an exception. Pinned in Task 4.
2. **A handler that throws.** Expect `{ ok: false, error: { code: 'INTERNAL' } }`, with no stack trace reaching the renderer and the error logged in main. Pinned in Task 4.
3. **Sandboxed preload built as ESM.** Electron silently skips it, so the window is blank and `window.nextlevel` is undefined. The preload must be emitted as CommonJS. Pinned by the Task 6 e2e test.
4. **The version call fails.** The Hello screen still renders and shows the translated "version unavailable" text instead of crashing or showing a spinner forever. Pinned in Task 5.
5. **Windows CRLF checkouts.** With `core.autocrlf=true`, Prettier's check fails on every file in CI and locally. `.gitattributes` forces `eol=lf` and Prettier uses `endOfLine: 'lf'`. Pinned by the Task 1 `npm run lint` verification on this Windows machine.

---

### Task 1: Root workspace and shared config presets

**Files:**
- Create: `package.json`, `.nvmrc`, `.gitattributes`, `.prettierrc.json`, `.prettierignore`, `eslint.config.js`, `tsconfig.json`, `vitest.config.ts`
- Create: `packages/config/package.json`, `packages/config/tsconfig.base.json`, `packages/config/tsconfig.react.json`, `packages/config/README.md`

**Interfaces:**
- Produces: `@nextlevel/config/tsconfig.base.json` (strict flags above, `target: ES2023`, `module: ESNext`, `moduleResolution: Bundler`, `composite: true`, `declaration: true`, `emitDeclarationOnly: true`, `outDir: dist`), and `@nextlevel/config/tsconfig.react.json` (extends base, adds `jsx: react-jsx`, `lib: [ES2023, DOM, DOM.Iterable]`). Every workspace's `tsconfig.json` extends one of these and is listed in the root `tsconfig.json` `references`.
- Produces: root scripts that every later task adds workspaces under:
  - `lint`: `eslint . && prettier --check .`
  - `typecheck`: `tsc -b`
  - `test`: `vitest run`
  - `dev`: `npm run dev --workspaces --if-present`
  - `build`: `npm run build --workspaces --if-present`
- Produces: root `vitest.config.ts` using `test.projects: ['packages/*', 'apps/*']` with `passWithNoTests: true`. Each workspace may add its own `vitest.config.ts` (environment `node` by default, `jsdom` for React workspaces).

- [ ] **Step 1: Create branch.** Run `git checkout -b chore/m0-foundations`.
- [ ] **Step 2: Write the files above.** Root `package.json` has `"workspaces": ["apps/*", "packages/*"]`, `engines.node >=24` and devDependencies for TypeScript 5, ESLint 9, typescript-eslint, eslint-plugin-import, eslint-plugin-react-hooks, Prettier, Vitest, `@vitest/coverage-v8`. `.gitattributes` is `* text=auto eol=lf`. Prettier uses `{ "singleQuote": true, "printWidth": 100, "endOfLine": "lf" }`. `.prettierignore` covers `docs/`, `CHANGELOG.md`, `package-lock.json`, `out/`, `dist/`, `coverage/`. Docs are hand-wrapped prose, so Prettier must not reflow them. The ESLint config uses typescript-eslint `strictTypeChecked` with `parserOptions.projectService: true`, plus `@typescript-eslint/no-explicit-any: error`. Ignore `**/out`, `**/dist`, `**/coverage`.
- [ ] **Step 3: Install and renormalize.** Run `npm install`, then `git add --renormalize .`.
- [ ] **Step 4: Verify the toolchain on the empty repo.** Run `npm run lint; npm run typecheck; npm test`. Expected: all three exit 0 (Vitest prints "No test files found" and passes).
- [ ] **Step 5: Commit** `chore(ci): set up npm workspaces, TypeScript, ESLint, Prettier and Vitest (NFR-MAINT-1)`.

### Task 2: Workspace stubs and boundary lint rules

**Files:**
- Create for each of `packages/shared`, `packages/system-catalog`, `packages/themes`, `packages/ui`, `apps/api`, `apps/admin`: `package.json`, `tsconfig.json`, `README.md` (purpose, public API, how to test; 3–6 lines), `src/index.ts`
- Modify: `eslint.config.js`, `tsconfig.json` (references)

**Interfaces:**
- Produces: packages export TypeScript source via `"exports": { ".": "./src/index.ts" }`. Apps depend on them with `"@nextlevel/shared": "*"`.
- Produces: `src/index.ts` in each stub contains only `export {};`, plus a one-line comment naming the milestone that fills it (`// Filled in M2: system definitions and emulator presets.`). `apps/api` and `apps/admin` get no Fastify or Vite dependencies yet. They are added in M7, together with the README note "stub until M7".

- [ ] **Step 1: Write the stubs** and add them to the root `tsconfig.json` `references`. Use `tsconfig.react.json` for `themes`, `ui` and `admin`, and base for the rest.
- [ ] **Step 2: Add the boundary rules to `eslint.config.js`.**
  - `import/no-restricted-paths`, zone: target `./packages`, from `./apps`.
  - For files under `packages/themes/**` and `packages/ui/**`: `no-restricted-imports` with patterns `node:*` and `electron`, plus the Node built-in names `fs`, `path`, `child_process`, `os`, `crypto`, `url`, `worker_threads`. The message points to "architecture §3 dependency rule".
- [ ] **Step 3: Verify that the rules fire.** Temporarily add `import 'node:fs';` to `packages/ui/src/index.ts` and `import '../../../apps/api/src/index.ts';` to `packages/shared/src/index.ts`. Run `npm run lint`. Expected: two errors that name those rules. Revert both lines.
- [ ] **Step 4: Verify that it is green.** Run `npm install; npm run lint; npm run typecheck; npm test`. Expected: all exit 0.
- [ ] **Step 5: Commit** `chore(ci): add workspace stubs and package boundary lint rules`.

### Task 3: Shared `Result`, `AppError` and the IPC contract

**Files:**
- Create: `packages/shared/src/result.ts`, `packages/shared/src/errors.ts`, `packages/shared/src/ipc/contract.ts`
- Test: `packages/shared/src/result.test.ts`, `packages/shared/src/ipc/contract.test.ts`
- Modify: `packages/shared/src/index.ts` (re-export), `packages/shared/package.json` (dep `zod@^4`)

**Interfaces:**
- Produces (`errors.ts`):
  - `ERROR_CODES = { VALIDATION_FAILED: 'errors.validationFailed', INTERNAL: 'errors.internal' } as const`, which maps each code to its i18n message key.
  - `type ErrorCode = keyof typeof ERROR_CODES`
  - `AppErrorSchema = z.object({ code: z.enum([...]), message: z.string(), details: z.unknown().optional() })`
  - `type AppError = z.infer<typeof AppErrorSchema>`
- Produces (`result.ts`):
  - `type Result<T> = { ok: true; value: T } | { ok: false; error: AppError }`
  - `ok<T>(value: T): Result<T>`
  - `err(code: ErrorCode, message: string, details?: unknown): Result<never>`
- Produces (`ipc/contract.ts`):
  - `ipcContract = { 'app.version': { input: z.void(), output: z.string() } } as const`
  - `type IpcContract = typeof ipcContract`
  - `type IpcChannel = keyof IpcContract`
  - `type IpcInput<C extends IpcChannel>` and `type IpcOutput<C extends IpcChannel>` (both `z.infer`)
  - `interface NextLevelBridge { invoke<C extends IpcChannel>(channel: C, ...args: IpcInput<C> extends void ? [] : [input: IpcInput<C>]): Promise<Result<IpcOutput<C>>> }`

- [ ] **Step 1: Write the failing tests.**
  - `result.test.ts`: `it('NFR-MAINT-1: ok() wraps a value')` expects `ok(3)` toEqual `{ ok: true, value: 3 }`. `it('NFR-MAINT-1: err() builds an AppError that the schema accepts')` expects `err('INTERNAL','boom')` toEqual `{ ok:false, error:{ code:'INTERNAL', message:'boom' } }`, and `AppErrorSchema.parse(r.error)` must not throw.
  - `contract.test.ts`: `it('NFR-MAINT-1: app.version takes no input and returns a string')` asserts `ipcContract['app.version'].input.safeParse(undefined).success === true`, `.input.safeParse({ x: 1 }).success === false`, `.output.safeParse('0.0.0').success === true` and `.output.safeParse(1).success === false`. It also has `it('NFR-MAINT-1: every error code has a message key under errors.')`.
- [ ] **Step 2: Run them to see them fail.** Run `npx vitest run packages/shared`. Expected: FAIL (modules not found).
- [ ] **Step 3: Implement** the three files with the signatures above. With `exactOptionalPropertyTypes`, `err()` adds `details` only when it is provided.
- [ ] **Step 4: Run them to see them pass.** Run `npx vitest run packages/shared`, then `npm run typecheck`. Expected: PASS, exit 0.
- [ ] **Step 5: Commit** `feat(shared): add Result, AppError and IPC contract with app.version (NFR-MAINT-1)`.

### Task 4: Launcher IPC router (pure, Electron-free)

**Files:**
- Create: `apps/launcher/package.json`, `apps/launcher/tsconfig.json`, `apps/launcher/tsconfig.node.json`, `apps/launcher/tsconfig.web.json`, `apps/launcher/vitest.config.ts`, `apps/launcher/README.md`
- Create: `apps/launcher/src/main/ipc/router.ts`
- Test: `apps/launcher/src/main/ipc/router.test.ts`

**Interfaces:**
- Consumes: `ipcContract`, `IpcChannel`, `IpcInput`, `IpcOutput`, `Result`, `ok`, `err` from Task 3.
- Produces: `apps/launcher/vitest.config.ts` with two projects — `main` (environment `node`, `src/main/**/*.test.ts`) and `renderer` (environment `jsdom`, `src/renderer/**/*.test.tsx`, Testing Library setup). Task 5 relies on the `renderer` project.
- Produces:
  - `type IpcHandlers = { [C in IpcChannel]: (input: IpcInput<C>) => Promise<IpcOutput<C>> | IpcOutput<C> }`
  - `interface RouterLogger { error(context: Record<string, unknown>, msg: string): void }`
  - `createIpcRouter(handlers: IpcHandlers, log: RouterLogger): { channels: IpcChannel[]; handle(channel: IpcChannel, rawInput: unknown): Promise<Result<unknown>> }`
  - Task 5 wires each entry of `channels` to `ipcMain.handle(channel, (_e, input) => router.handle(channel, input))`.

- [ ] **Step 1: Write the failing tests** (Vitest, node environment), with handlers built inline.
  - `NFR-MAINT-1: valid call returns ok with the handler value`: the handler returns `'1.2.3'`, so `handle('app.version', undefined)` gives `{ ok: true, value: '1.2.3' }`.
  - `NFR-MAINT-1: invalid input returns VALIDATION_FAILED without calling the handler`: `handle('app.version', { x: 1 })` gives `ok: false` and `error.code === 'VALIDATION_FAILED'`, `error.details` holds the Zod issues, and the handler spy is not called.
  - `NFR-MAINT-1: a throwing handler returns INTERNAL and is logged`: the handler throws `new Error('secret stack')`, so `error.code === 'INTERNAL'`, `JSON.stringify(result)` does not contain `'secret stack'`, and `log.error` is called once with the channel in its context.
  - `NFR-MAINT-1: output that breaks the contract returns INTERNAL`: the handler returns `42` (cast), so the code is `'INTERNAL'`.
  - `channels lists every contract key`: `channels` toEqual `Object.keys(ipcContract)`.
- [ ] **Step 2: Run them to see them fail.** Run `npx vitest run apps/launcher`. Expected: FAIL (module not found).
- [ ] **Step 3: Implement `createIpcRouter`.** Validate input with `safeParse`, call the handler inside `try`, validate the output with `safeParse`, and map each failure to `err(...)`. The user-facing `message` is the error code's i18n key from `ERROR_CODES`, never the thrown message.
- [ ] **Step 4: Run them to see them pass.** Run `npx vitest run apps/launcher`, then `npm run typecheck`. Expected: PASS, exit 0.
- [ ] **Step 5: Commit** `feat(launcher): add Zod-validated IPC router returning Result (NFR-MAINT-1)`.

### Task 5: Electron app with preload bridge and Hello screen

**Files:**
- Create: `apps/launcher/electron.vite.config.ts`, `apps/launcher/src/main/index.ts`, `apps/launcher/src/main/userData.ts`, `apps/launcher/src/preload/index.ts`
- Create: `apps/launcher/src/renderer/index.html`, `src/renderer/main.tsx`, `src/renderer/App.tsx`, `src/renderer/i18n.ts`, `src/renderer/index.css`, `src/renderer/env.d.ts`
- Create: `packages/shared/src/i18n/en.json`
- Test: `apps/launcher/src/main/userData.test.ts`, `apps/launcher/src/renderer/App.test.tsx`

**Interfaces:**
- Consumes: `createIpcRouter` (Task 4); `NextLevelBridge`, `Result` (Task 3).
- Produces:
  - `userDataDirName(isPackaged: boolean): string` returns `'NextLevel'` when packaged and `'NextLevel-dev'` otherwise (environment-setup.md). Main calls `app.setPath('userData', join(app.getPath('appData'), userDataDirName(app.isPackaged)))` before `ready`.
  - `window.nextlevel: NextLevelBridge` is declared globally in `env.d.ts`. The preload calls `contextBridge.exposeInMainWorld('nextlevel', { invoke: (channel, input) => ipcRenderer.invoke(channel, input) })`.
  - `App({ bridge }: { bridge: NextLevelBridge })`. `main.tsx` passes `window.nextlevel`, so tests can inject a fake.
  - `en.json` keys: `hello.title` = `"Hello"`, `hello.version` = `"Version {{version}}"`, `hello.versionUnavailable` = `"Version unavailable"`, `errors.validationFailed` = `"The request was not valid."`, `errors.internal` = `"Something went wrong. Check the log for details."`

- [ ] **Step 1: Write the failing tests.**
  - `userData.test.ts`: `it('dev builds use NextLevel-dev so they never touch a production install')` asserts `userDataDirName(false) === 'NextLevel-dev'` and `userDataDirName(true) === 'NextLevel'`.
  - `App.test.tsx` (jsdom + Testing Library): `it('NFR-MAINT-1: shows Hello and the version from the bridge')` uses a fake bridge that resolves `{ ok: true, value: '0.0.0' }` and expects `findByText('Version 0.0.0')` plus the `Hello` heading. `it('shows "Version unavailable" when the bridge returns an error')` uses a fake that resolves `err('INTERNAL', 'errors.internal')` and expects `findByText('Version unavailable')`.
- [ ] **Step 2: Run them to see them fail.** Run `npx vitest run apps/launcher`. Expected: FAIL in both new files.
- [ ] **Step 3: Implement.**
  - `electron.vite.config.ts`: the main output is ESM. The **preload output is CommonJS** (`build.rollupOptions.output.format: 'cjs'`, file `preload/index.cjs`) because sandboxed preloads cannot be ESM. The renderer uses `@vitejs/plugin-react` and `@tailwindcss/vite`.
  - `main/index.ts`: create `BrowserWindow` with `{ contextIsolation: true, sandbox: true, nodeIntegration: false, preload: <cjs path> }`. Register the router with handler `'app.version': () => app.getVersion()` and log errors with `console.error` until `electron-log` arrives in M1. Load the dev server URL or the built `index.html`.
  - `index.html` CSP: `default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:`.
  - `App.tsx`: an `<h1>` with `t('hello.title')`, then the version line. It calls `bridge.invoke('app.version')` in an effect. Plain `useEffect` is fine here; TanStack Query comes with the first real feature in M1.
  - `i18n.ts`: initialize i18next with `en.json` imported from `@nextlevel/shared/i18n/en.json` (add that subpath to the shared `exports`).
  - Launcher scripts: `dev: electron-vite dev`, `build: electron-vite build`, `start: electron-vite preview`. Its `package.json` `version` is `0.0.0`.
- [ ] **Step 4: Run them to see them pass.** Run `npx vitest run apps/launcher`, then `npm run lint; npm run typecheck`. Expected: PASS, all exit 0.
- [ ] **Step 5: Check it manually.** Run `npm run dev -w apps/launcher`. Expected: a window titled NextLevel showing "Hello" and "Version 0.0.0", with no CSP or preload errors in DevTools.
- [ ] **Step 6: Commit** `feat(launcher): Electron window with typed preload bridge and Hello screen (NFR-MAINT-1)`.

### Task 6: Playwright Electron smoke test

**Files:**
- Create: `apps/launcher/playwright.config.ts`, `apps/launcher/e2e/hello.spec.ts`
- Modify: `apps/launcher/package.json` (`test:e2e: electron-vite build && playwright test`), root `package.json` (`test:e2e: npm run test:e2e --workspaces --if-present`), `eslint.config.js` / root `vitest.config.ts` (exclude `e2e/` from Vitest)

**Interfaces:**
- Consumes: the built app in `apps/launcher/out/` from Task 5.

- [ ] **Step 1: Write the test.** `test('NFR-MAINT-1: launcher boots and shows Hello with the version via the bridge')` uses `_electron.launch({ args: ['out/main/index.js'] })` and `firstWindow()`. It expects `getByRole('heading', { name: 'Hello' })` to be visible, `getByText('Version 0.0.0')` to be visible, and `page.evaluate(() => typeof window.nextlevel)` to equal `'object'`.
- [ ] **Step 2: Run it.** Run `npm run test:e2e -w apps/launcher`. Expected: 1 passed. To confirm it guards Review Focus #3, temporarily switch the preload format to `es`, rebuild and see it fail, then revert.
- [ ] **Step 3: Commit** `test(launcher): add Playwright Electron smoke test`.

### Task 7: CI workflow, docs and push

**Files:**
- Create: `.github/workflows/ci.yml`
- Modify: `docs/05-operations/environment-setup.md` (Node 22 → 24), `docs/03-architecture/05-architecture.md` §2 Backend row (Node 22 → 24), any other `Node 22` mention (`grep -rn "Node 22\|22 LTS" docs`), `docs/01-product/roadmap.md` (M0 → ◐), `README.md` (status line), `CHANGELOG.md` (Unreleased → Added), `docs/03-architecture/api-spec.md` §3 (note that `errors.ts` holds `VALIDATION_FAILED`, `INTERNAL` for IPC)

- [ ] **Step 1: Write `ci.yml`.** Trigger on `push` to `main` and `pull_request`. One job on `windows-latest` using `actions/setup-node@v4` with `node-version-file: .nvmrc` and `cache: npm`. Steps: `npm ci`, `npm run lint`, `npm run typecheck`, `npm test`, `npm run test:e2e`. No `playwright install` step: Electron tests drive the Electron binary installed by `npm ci`, not a downloaded browser.
- [ ] **Step 2: Update the docs** listed above. The CHANGELOG entry lists the monorepo scaffold, boundary lint rules, typed IPC bridge with `app.version`, Hello screen, CI, and Node 24 as the baseline.
- [ ] **Step 3: Verify locally.** Run `npm run lint; npm run typecheck; npm test; npm run test:e2e`. Expected: all exit 0. Paste the output into the PR description.
- [ ] **Step 4: Commit** `ci: add GitHub Actions workflow; docs: Node 24 baseline and M0 status`.
- [ ] **Step 5: Push.** First push `main` (`git push -u origin main`, the docs commit), then the branch (`git push -u origin chore/m0-foundations`). Open a PR whose description references NFR-MAINT-1 and confirm CI is green on GitHub. Pushing needs the remote to be reachable; it currently returns "Repository not found" (see the handoff notes).
- [ ] **Step 6: After the squash-merge.** Tag `v0.0.0` per the roadmap exit criteria (`v0.<milestone>.0`), set M0 to ☑ in the roadmap, and move the CHANGELOG entries under `## [0.0.0]`.
