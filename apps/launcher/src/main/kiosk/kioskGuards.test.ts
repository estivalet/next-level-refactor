import {
  AppErrorException,
  defaultSettings,
  ERROR_CODES,
  ok,
  type KioskHide,
} from '@nextlevel/shared';
import { describe, expect, it, vi } from 'vitest';
import { createIpcRouter } from '../ipc/router.ts';
import { withUnimplemented } from '../ipc/withUnimplemented.ts';
import { KIOSK_GUARDED, withKioskGuards } from './kioskGuards.ts';

function router(hidden: readonly KioskHide[]) {
  const guard = (part: KioskHide) => {
    if (hidden.includes(part)) {
      throw new AppErrorException({ code: 'KIOSK_LOCKED', message: ERROR_CODES.KIOSK_LOCKED });
    }
  };
  const quit = vi.fn();
  const handlers = withKioskGuards(
    withUnimplemented({
      'app.quit': quit,
      'settings.reset': () => Promise.resolve({ settings: {} as never, revision: 1 }),
      'catalog.install': () => Promise.resolve(undefined as never),
      'auth.signOut': () => Promise.resolve({ kind: 'signedOut', reason: null, banner: null }),
      'app.version': () => '1.0.0',
    }),
    guard,
  );
  return { router: createIpcRouter(handlers, { error: vi.fn() }), quit };
}

describe('kiosk guards in main (FR-SET-6, Review Focus 3)', () => {
  it('locked: settings.save, app.quit, catalog install/uninstall, setup run, account → KIOSK_LOCKED', async () => {
    const { router: r, quit } = router(['settings', 'quit', 'catalog', 'account']);
    for (const [channel, input] of [
      ['settings.save', { settings: defaultSettings(), baseRevision: 0 }],
      ['settings.reset', undefined],
      ['app.quit', undefined],
      ['catalog.install', { itemId: 'x' }],
      ['catalog.uninstall', { itemId: 'x' }],
      ['auth.signOut', undefined],
    ] as const) {
      const result = await r.handle(channel, input);
      expect(result, channel).toMatchObject({ ok: false, error: { code: 'KIOSK_LOCKED' } });
    }
    expect(quit).not.toHaveBeenCalled();
  });

  it('only for the hidden parts in hide; unguarded channels always pass', async () => {
    const { router: r, quit } = router(['settings']);
    expect(await r.handle('app.quit', undefined)).toMatchObject({ ok: true });
    expect(quit).toHaveBeenCalled();
    expect(await r.handle('app.version', undefined)).toEqual(ok('1.0.0'));
  });

  it('Settings-page, desktop-app and OS-escape channels are guarded too; the front-end’s are not', () => {
    expect(KIOSK_GUARDED).toMatchObject({
      'scraper.credentials.set': 'settings',
      'gemini.key.set': 'settings',
      'scraper.setSystemId': 'settings',
      'launchbox.setPlatform': 'settings',
      'launch.test': 'settings',
      'app.openPath': 'settings',
      'app.pickFile': 'settings',
      'app.pickFolder': 'settings',
      'settings.export': 'settings',
      'library.games.remove': 'desktop',
      'library.games.updateMetadata': 'desktop',
      'library.games.setLaunchOverride': 'desktop',
      'library.games.setPlayability': 'desktop',
      'library.games.relink': 'desktop',
      'library.games.reveal': 'desktop',
      'library.export': 'desktop',
      'collections.create': 'desktop',
      'collections.delete': 'desktop',
      'smartFilters.update': 'desktop',
      'account.export': 'account',
      'update.restart': 'quit',
    });
    for (const channel of [
      'frontend.menu',
      'frontend.games',
      'frontend.themeOpened',
      'launch.game',
      'launch.running',
      'library.games.get',
      'library.games.setFlags',
      'kiosk.unlock',
      'kiosk.state',
    ] as const) {
      expect(KIOSK_GUARDED[channel], channel).toBeUndefined();
    }
  });
});
