# @nextlevel/themes

The themes engine and the bundled themes (FR-THM-1..6). It must not import Node or Electron
(enforced by ESLint), so the same themes can run in the launcher and, later, the web player.

- `src/host/ThemeHost.ts`: everything a theme can reach outside itself (architecture §4.4). The
  launcher implements it in `apps/launcher/src/renderer/features/frontend/LauncherThemeHost.ts`.
- `src/engine/`: the headless engine ported from NextLevelOS `src/themes/engine` (types, level
  model, navigation reducer, art resolution, pack merge, coverage) and its React provider.
- `src/input/`: keyboard and gamepad input mapped to `InputAction`s from the user's settings,
  with hold-to-repeat.
- `src/components/`: pieces every theme shares (carousel, background, tabs, key help, theme
  menu, game details, counts, sounds, focus helpers).
- `src/<theme id>/`: one folder per theme with its own `README.md` (Big Box since M4b);
  `src/registry.ts` lists them.
- `@nextlevel/themes/testing`: `FakeThemeHost` and fixtures for tests.

Test with `npx vitest run packages/themes`.
