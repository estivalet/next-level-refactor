import { defaultSettings } from '@nextlevel/shared';
import { stat } from 'node:fs/promises';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { memorySecrets } from './secrets/testing.ts';
import { createHandlers, type MainDeps } from './handlers.ts';
import { createIpcRouter } from './ipc/router.ts';
import { SettingsService } from './settings/SettingsService.ts';
import { settingsFixture } from './settings/testing.ts';

let cleanup: () => Promise<void> = () => Promise.resolve();
afterEach(() => cleanup());

async function setup() {
  const fixture = await settingsFixture();
  cleanup = fixture.cleanup;
  const settings = new SettingsService(fixture.deps);
  const warn = vi.fn();
  await settings.load();
  const deps: MainDeps = {
    settings,
    artIndex: { index: () => Promise.reject(new Error('no art index in this test')) },
    appVersion: () => '1.0.0',
    quit: vi.fn(),
    paths: { data: fixture.dir, logs: join(fixture.dir, 'logs') },
    openPath: vi.fn(() => Promise.resolve('')),
    setOpenAtLogin: vi.fn(),
    log: { warn },
    catalog: () => [N64],
    pickFolder: vi.fn((title?: string) => Promise.resolve(title === 'cancel' ? null : 'E:/roms')),
    pickFile: vi.fn(() => Promise.resolve(null)),
    presets: () => [],
    library: null,
    clock: () => new Date(Date.UTC(2026, 9, 21)),
    newId: () => '0199f000-0000-7000-8000-000000000001',
    secrets: memorySecrets(),
    scraperAccount: () => Promise.reject(new Error('no scraper in this test')),
    emit: vi.fn(),
    revealFile: vi.fn(),
    pathExists: () => false,
  };
  const router = createIpcRouter(createHandlers(deps), { error: () => undefined });
  return { deps, router, warn, dir: fixture.dir };
}

const N64 = {
  id: 'nintendo-64',
  name: 'Nintendo 64',
  kind: 'other' as const,
  extensions: ['z64'],
  defaultFolderName: 'Nintendo 64',
  scraper: {},
  presetProfiles: [],
  aliases: [],
};

const startWithWindows = () => {
  const settings = defaultSettings();
  return { ...settings, general: { ...settings.general, startWithWindows: true } };
};

describe('createHandlers', () => {
  it('FR-SET-1: settings.save round-trips through the router', async () => {
    const { router } = await setup();
    const saved = await router.handle('settings.save', {
      settings: startWithWindows(),
      baseRevision: 0,
    });
    expect(saved).toEqual({ ok: true, value: { settings: startWithWindows(), revision: 1 } });
    expect(await router.handle('settings.get', undefined)).toEqual({
      ok: true,
      value: { kind: 'ok', snapshot: { settings: startWithWindows(), revision: 1 } },
    });
  });

  it('CONFLICT from the service reaches the renderer as CONFLICT, not INTERNAL', async () => {
    const { router } = await setup();
    const result = await router.handle('settings.save', {
      settings: defaultSettings(),
      baseRevision: 5,
    });
    expect(result).toMatchObject({ ok: false, error: { code: 'CONFLICT' } });
  });

  it('FR-THM-5: frontend.themeOpened remembers the theme once, without a base revision', async () => {
    const { router } = await setup();
    expect(await router.handle('frontend.themeOpened', { themeId: 'big-box' })).toEqual({
      ok: true,
      value: undefined,
    });
    await router.handle('frontend.themeOpened', { themeId: 'big-box' });
    const loaded = await router.handle('settings.get', undefined);
    expect(loaded).toMatchObject({
      ok: true,
      value: {
        kind: 'ok',
        snapshot: { revision: 1, settings: { themes: { lastUsed: 'big-box' } } },
      },
    });
  });

  it('FR-SET-7: app.paths returns data, settings, backups and logs', async () => {
    const { router, dir } = await setup();
    expect(await router.handle('app.paths', undefined)).toEqual({
      ok: true,
      value: {
        data: dir,
        settings: join(dir, 'settings.json'),
        backups: join(dir, 'backups'),
        logs: join(dir, 'logs'),
      },
    });
  });

  it('FR-SET-7: app.openPath opens only known keys', async () => {
    const { router, deps, dir } = await setup();
    expect(await router.handle('app.openPath', { key: 'logs' })).toMatchObject({ ok: true });
    expect(deps.openPath).toHaveBeenCalledWith(join(dir, 'logs'));
    expect(await router.handle('app.openPath', { key: 'C:/Windows' })).toMatchObject({
      ok: false,
      error: { code: 'VALIDATION_FAILED' },
    });
  });

  it('FR-SET-7: opening a folder that does not exist yet creates it first', async () => {
    const { router, deps, dir } = await setup();
    await router.handle('app.openPath', { key: 'backups' });
    expect((await stat(join(dir, 'backups'))).isDirectory()).toBe(true);
    expect(deps.openPath).toHaveBeenCalledWith(join(dir, 'backups'));
  });

  it('a failure to open a folder is logged', async () => {
    const { router, deps, warn } = await setup();
    vi.mocked(deps.openPath).mockResolvedValueOnce('Access denied');
    await router.handle('app.openPath', { key: 'data' });
    expect(warn).toHaveBeenCalledOnce();
  });

  it('FR-EMU-1: systems.catalog returns the catalog', async () => {
    const { router } = await setup();
    expect(await router.handle('systems.catalog', undefined)).toEqual({ ok: true, value: [N64] });
  });

  it('FR-LIB-1: app.pickFolder returns the chosen folder or null', async () => {
    const { router, deps } = await setup();
    expect(await router.handle('app.pickFolder', { title: 'Add' })).toEqual({
      ok: true,
      value: 'E:/roms',
    });
    expect(deps.pickFolder).toHaveBeenCalledWith('Add');
    expect(await router.handle('app.pickFolder', { title: 'cancel' })).toEqual({
      ok: true,
      value: null,
    });
  });

  it('saving startWithWindows applies it to the login items', async () => {
    const { router, deps } = await setup();
    await router.handle('settings.save', { settings: startWithWindows(), baseRevision: 0 });
    expect(deps.setOpenAtLogin).toHaveBeenCalledWith(true);
  });

  it('settings.reset applies the default login item setting', async () => {
    const { router, deps } = await setup();
    await router.handle('settings.reset', undefined);
    expect(deps.setOpenAtLogin).toHaveBeenCalledWith(false);
  });
});
