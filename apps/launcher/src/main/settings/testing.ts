import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { SettingsDeps } from './SettingsService.ts';

/** A temp settings folder and deps with a clock that moves one second per call. */
export async function settingsFixture(overrides: Partial<SettingsDeps> = {}) {
  const dir = await mkdtemp(join(tmpdir(), 'nextlevel-settings-'));
  let now = Date.UTC(2026, 9, 21, 12, 0, 0);
  const deps: SettingsDeps = {
    dir,
    clock: () => new Date((now += 1000)),
    log: { warn: () => undefined },
    dialogs: {
      pickExportPath: () => Promise.resolve(null),
      pickImportPath: () => Promise.resolve(null),
    },
    ...overrides,
  };
  return { dir, deps, cleanup: () => rm(dir, { recursive: true, force: true }) };
}
