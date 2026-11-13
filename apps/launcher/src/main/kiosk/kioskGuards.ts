import type { IpcChannel, KioskHide } from '@nextlevel/shared';
import type { IpcHandlers } from '../ipc/router.ts';

/**
 * The channels each hidden part refuses while kiosk is locked (FR-SET-6, Review Focus 3).
 * `settings`: what Settings (and the Menu Editor) change or open, including the OS file dialogs
 * and Explorer. `desktop`: what only the desktop apps do (library edits, collections, smart
 * filters, scraping, exports). `quit` also covers Restart to update; `account` the account's
 * own actions. The front-end's channels (frontend.*, launch.game, library.games.get/setFlags)
 * are never guarded. Opening the desktop and switching themes have no channel: the renderer
 * enforces those, and closes hidden apps' windows when kiosk locks.
 */
export const KIOSK_GUARDED: Partial<Record<IpcChannel, KioskHide>> = {
  'settings.save': 'settings',
  'settings.reset': 'settings',
  'settings.import': 'settings',
  'settings.export': 'settings',
  'settings.backups.restore': 'settings',
  'scan.start': 'settings',
  'scan.cancel': 'settings',
  'import.inspect': 'settings',
  'import.dryRun': 'settings',
  'import.apply': 'settings',
  'emulators.detect': 'settings',
  'launch.test': 'settings',
  'scraper.credentials.set': 'settings',
  'scraper.test': 'settings',
  'scraper.setSystemId': 'settings',
  'gemini.key.set': 'settings',
  'gemini.test': 'settings',
  'launchbox.setPlatform': 'settings',
  'launchbox.refresh': 'settings',
  'launchbox.cancel': 'settings',
  'app.openPath': 'settings',
  'app.pickFile': 'settings',
  'app.pickFolder': 'settings',
  'menus.save': 'settings',
  'menus.create': 'settings',
  'menus.delete': 'settings',
  'menus.setActive': 'settings',
  'sync.setEnabled': 'settings',
  'sync.now': 'settings',
  'sync.deleteRemote': 'settings',
  'library.games.updateMetadata': 'desktop',
  'library.games.setPlayability': 'desktop',
  'library.games.setLaunchOverride': 'desktop',
  'library.games.relink': 'desktop',
  'library.games.remove': 'desktop',
  'library.games.reveal': 'desktop',
  'library.export': 'desktop',
  'collections.create': 'desktop',
  'collections.update': 'desktop',
  'collections.delete': 'desktop',
  'collections.addGames': 'desktop',
  'collections.removeGames': 'desktop',
  'collections.reorder': 'desktop',
  'collections.move': 'desktop',
  'smartFilters.create': 'desktop',
  'smartFilters.update': 'desktop',
  'smartFilters.delete': 'desktop',
  'scraper.apply': 'desktop',
  'scraper.batch.start': 'desktop',
  'gemini.ask': 'desktop',
  'gemini.apply': 'desktop',
  'gemini.dismiss': 'desktop',
  'gemini.batch.start': 'desktop',
  'app.quit': 'quit',
  'update.restart': 'quit',
  'catalog.install': 'catalog',
  'catalog.uninstall': 'catalog',
  'downloads.cancel': 'catalog',
  'auth.signOut': 'account',
  'auth.devices.revoke': 'account',
  'account.delete': 'account',
  'account.export': 'account',
};

/** Wraps the guarded handlers so they ask the kiosk first. */
export function withKioskGuards(
  handlers: IpcHandlers,
  guard: (part: KioskHide) => void,
): IpcHandlers {
  const wrapped: Record<string, unknown> = { ...handlers };
  for (const [channel, part] of Object.entries(KIOSK_GUARDED) as [IpcChannel, KioskHide][]) {
    const handler = handlers[channel] as (input: unknown) => unknown;
    wrapped[channel] = (input: unknown) => {
      guard(part);
      return handler(input);
    };
  }
  return wrapped as IpcHandlers;
}
