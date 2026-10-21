# @nextlevel/launcher

The Windows desktop launcher (Electron + React), built with `electron-vite`.

- `src/main`: main process, services and the Zod-validated IPC router.
- `src/preload`: the typed `window.nextlevel` bridge (built as CommonJS, required by the sandbox).
- `src/renderer`: the React UI, organized by feature:
  - `features/shell/`: desktop, windows (pure `windowManager.ts` reducer), taskbar, Start menu.
  - `features/settings/`: the Settings app; each section is a component with its `api.ts` hooks.
  - `apps/registry.ts`: every app the shell can open.
  - `bridge.ts`: the only access to `window.nextlevel`; feature `api.ts` hooks go through it.

`npm run dev -w apps/launcher` runs it with hot reload. `npx vitest run apps/launcher` runs the
unit and component tests; `npm run test:e2e -w apps/launcher` runs the Playwright smoke test.
