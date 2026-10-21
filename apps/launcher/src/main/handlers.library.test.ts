import { defaultSettings } from '@nextlevel/shared';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createHandlers, type MainDeps } from './handlers.ts';
import { createIpcRouter } from './ipc/router.ts';
import { tempLibrary } from './library/testing.ts';
import { ScanService } from './scan/ScanService.ts';
import { system } from './scan/testing.ts';
import { inProcessWalker } from './scan/walker.ts';
import { SettingsService } from './settings/SettingsService.ts';
import { settingsFixture } from './settings/testing.ts';

const cleanups: Array<() => Promise<void>> = [];
afterEach(async () => {
  for (const cleanup of cleanups.splice(0)) await cleanup();
});

const CATALOG = [system('nintendo-64'), system('sega-genesis')];

async function setup(withLibrary: boolean) {
  const fixture = await settingsFixture();
  cleanups.push(fixture.cleanup);
  const settings = new SettingsService(fixture.deps);
  await settings.load();
  let library: MainDeps['library'] = null;
  if (withLibrary) {
    const temp = await tempLibrary();
    cleanups.push(temp.cleanup);
    const scan = new ScanService({
      repo: temp.repo,
      settings,
      catalog: () => CATALOG,
      createWalker: inProcessWalker,
      folderExists: () => Promise.resolve(false),
      clock: () => new Date(Date.UTC(2026, 9, 21)),
      emit: () => undefined,
      log: { error: () => undefined },
      newId: () => 'scan-1',
    });
    library = { repo: temp.repo, scan };
  }
  const deps: MainDeps = {
    settings,
    appVersion: () => '1.0.0',
    quit: vi.fn(),
    paths: { data: fixture.dir, logs: join(fixture.dir, 'logs') },
    openPath: vi.fn(() => Promise.resolve('')),
    setOpenAtLogin: vi.fn(),
    log: { warn: vi.fn() },
    catalog: () => CATALOG,
    pickFolder: vi.fn(() => Promise.resolve(null)),
    library,
  };
  return {
    router: createIpcRouter(createHandlers(deps), { error: () => undefined }),
    settings,
    library,
  };
}

describe('library handlers', () => {
  it('FR-LIB-3: scan channels fail with LIBRARY_UNAVAILABLE when the library could not open', async () => {
    const { router } = await setup(false);
    for (const channel of ['scan.status', 'scan.cancel', 'systems.list'] as const) {
      expect(await router.handle(channel, undefined)).toMatchObject({
        ok: false,
        error: { code: 'LIBRARY_UNAVAILABLE' },
      });
    }
    expect(await router.handle('scan.start', {})).toMatchObject({
      ok: false,
      error: { code: 'LIBRARY_UNAVAILABLE' },
    });
  });

  it('FR-LIB-3: systems.list merges catalog, enabled flag and game counts', async () => {
    const { router, settings, library } = await setup(true);
    await settings.save(
      { ...defaultSettings(), systems: { 'sega-genesis': { enabled: true } } },
      0,
    );
    library?.repo.applySystemDiff(
      'nintendo-64',
      {
        added: [{ relPath: 'Demo.zip', locationId: 'a', size: 1, mtime: 1, discGroup: null }],
        present: [],
        moved: [],
        restored: [],
        missing: [],
      },
      new Date(),
    );
    expect(await router.handle('systems.list', undefined)).toEqual({
      ok: true,
      value: [
        { id: 'nintendo-64', enabled: false, games: 1, missing: 0 },
        { id: 'sega-genesis', enabled: true, games: 0, missing: 0 },
      ],
    });
  });

  it('FR-LIB-3: scan.start runs a scan and scan.status reports it', async () => {
    const { router, library } = await setup(true);
    expect(await router.handle('scan.start', { systemIds: ['nintendo-64'] })).toMatchObject({
      ok: true,
      value: { running: true },
    });
    await library?.scan.whenIdle();
    expect(await router.handle('scan.status', undefined)).toMatchObject({
      ok: true,
      value: { running: false, last: { outcome: 'completed' } },
    });
  });
});
