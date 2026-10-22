import { defaultSettings, err, ok, type Settings } from '@nextlevel/shared';
import type { HostEvent } from '@nextlevel/themes';
import { FIXTURE_GAMES } from '@nextlevel/themes/testing';
import { afterEach, describe, expect, it } from 'vitest';
import { getBridge, setBridgeForTests } from '../../bridge.ts';
import { installFakeBridge } from '../../test-utils.tsx';
import { createLauncherThemeHost } from './LauncherThemeHost.ts';

afterEach(() => {
  setBridgeForTests(null);
});

const t = (key: string) => `T(${key})`;

function setup(
  responses: Parameters<typeof installFakeBridge>[0] = {},
  settings = defaultSettings(),
) {
  const fake = installFakeBridge(responses);
  const host = createLauncherThemeHost(getBridge(), { settings: () => settings, t });
  return { fake, host };
}

describe('LauncherThemeHost (FR-THM-6)', () => {
  it('reads the menu, levels, details and art index over the typed bridge', async () => {
    const menu = { title: 'NextLevel', items: [] };
    const art = { packFiles: [], assetsFiles: ['logo/clear/A.png'], manifest: null, warnings: [] };
    const { fake, host } = setup({
      'frontend.menu': () => ok(menu),
      'frontend.games': () => ok([...FIXTURE_GAMES.slice(0, 2)]),
      'frontend.artIndex': () => ok(art),
      'library.games.get': () => ok({ description: 'A game' } as never),
    });
    expect(await host.getMenu()).toEqual(menu);
    expect(await host.getGames('s:snes')).toHaveLength(2);
    expect(await host.loadArtIndex('big-box')).toEqual(art);
    expect(await host.getGameDetails(7)).toEqual({ description: 'A game' });
    await host.loadArtIndex('ps5', { refresh: true });
    expect(fake.calls.map((call) => [call.channel, call.input])).toEqual([
      ['frontend.menu', undefined],
      ['frontend.games', { nodeId: 's:snes' }],
      ['frontend.artIndex', { themeId: 'big-box' }],
      ['library.games.get', { gameId: 7 }],
      ['frontend.artIndex', { themeId: 'ps5', refresh: true }],
    ]);
  });

  it('a failed call rejects with the translated message', async () => {
    const { host } = setup({
      'frontend.games': () => err('LIBRARY_UNAVAILABLE', 'errors.libraryUnavailable'),
    });
    await expect(host.getGames('s:snes')).rejects.toThrow('T(errors.libraryUnavailable)');
  });

  it('launch reports a failure with the translated reason', async () => {
    const { host } = setup({
      'launch.game': () => err('NO_PROFILE', 'errors.noProfile'),
    });
    expect(await host.launch(3)).toEqual({ ok: false, message: 'T(errors.noProfile)' });
  });

  it('US-C2: with onLaunchError the failure goes to the launcher, which reports it', async () => {
    installFakeBridge({ 'launch.game': () => err('NO_PROFILE', 'errors.noProfile') });
    const reported: unknown[] = [];
    const host = createLauncherThemeHost(getBridge(), {
      settings: () => defaultSettings(),
      t,
      onLaunchError: (gameId, error) => reported.push([gameId, error.code]),
    });
    expect(await host.launch(3)).toEqual({
      ok: false,
      message: 'T(errors.noProfile)',
      reported: true,
    });
    expect(reported).toEqual([[3, 'NO_PROFILE']]);
  });

  it('favorite and hidden are saved for one game; a failure resolves false', async () => {
    const saved = setup({ 'library.games.setFlags': () => ok(undefined) });
    expect(await saved.host.setGameFlags(5, { hidden: true })).toBe(true);
    expect(saved.fake.calls[0]?.input).toEqual({ gameIds: [5], flags: { hidden: true } });
    setBridgeForTests(null);
    const failed = setup({ 'library.games.setFlags': () => err('INTERNAL', 'errors.internal') });
    expect(await failed.host.setGameFlags(5, { hidden: true })).toBe(false);
  });

  it('media URLs exist only for indexed kinds; art URLs are nextlevel://art', () => {
    const { host } = setup();
    const game = { ...FIXTURE_GAMES[0], media: ['box-front'] } as (typeof FIXTURE_GAMES)[number];
    expect(host.mediaUrl(game, 'box-front')).toBe(`nextlevel://media/${String(game.id)}/box-front`);
    expect(host.mediaUrl(game, 'fanart')).toBeNull();
    expect(host.artUrl({ kind: 'assets' }, 'logo/clear/A B.png')).toBe(
      'nextlevel://art/assets/logo/clear/A%20B.png',
    );
  });

  it('input follows the latest settings, including a change announced by main', () => {
    const settings = defaultSettings();
    const { fake, host } = setup({}, settings);
    const events: HostEvent[] = [];
    const off = host.onEvent((event) => events.push(event));
    expect(host.input().keyboard.favorite).toEqual(['KeyX']);
    const changed: Settings = {
      ...settings,
      input: { ...settings.input, keyboard: { ...settings.input.keyboard, favorite: ['KeyV'] } },
    };
    fake.emit('settings.changed', { settings: changed, revision: 2 });
    expect(host.input().keyboard.favorite).toEqual(['KeyV']);
    expect(events).toEqual([{ type: 'settings-changed' }]);
    off();
  });

  it('library and launch events become host events; unsubscribing stops them', () => {
    const { fake, host } = setup();
    const events: HostEvent[] = [];
    const off = host.onEvent((event) => events.push(event));
    fake.emit('library.changed', { systems: ['snes'], gameIds: [4] });
    fake.emit('launch.finished', {
      launchId: 1,
      gameId: 4,
      exitCode: 0,
      durationMs: 60000,
      counted: true,
    });
    fake.emit('launch.finished', {
      launchId: 2,
      gameId: 5,
      exitCode: 1,
      durationMs: 100,
      counted: false,
      error: { code: 'LAUNCH_FAILED', message: 'errors.launchFailed' },
    });
    off();
    fake.emit('library.changed', { systems: ['snes'] });
    expect(events).toEqual([
      { type: 'library-changed', systems: ['snes'], gameIds: [4] },
      { type: 'launch-finished', gameId: 4, ok: true },
      { type: 'launch-finished', gameId: 5, ok: false },
    ]);
  });
});
