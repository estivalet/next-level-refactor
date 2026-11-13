import type { IpcChannel, KioskHide } from '@nextlevel/shared';
import type { IpcHandlers } from '../ipc/router.ts';

/**
 * The channels each hidden part refuses while kiosk is locked (FR-SET-6, Review Focus 3).
 * Opening the desktop and switching themes happen in the renderer only (no channel), so the
 * renderer enforces `desktop` and `themeSwitcher`; everything that changes something here is
 * refused in main too. Setup runs again through `settings.save`, so it is covered by `settings`.
 */
export const KIOSK_GUARDED: Partial<Record<IpcChannel, KioskHide>> = {
  'settings.save': 'settings',
  'settings.reset': 'settings',
  'settings.import': 'settings',
  'settings.backups.restore': 'settings',
  'scan.start': 'settings',
  'import.apply': 'settings',
  'menus.save': 'settings',
  'menus.create': 'settings',
  'menus.delete': 'settings',
  'menus.setActive': 'settings',
  'app.quit': 'quit',
  'catalog.install': 'catalog',
  'catalog.uninstall': 'catalog',
  'downloads.cancel': 'catalog',
  'auth.signOut': 'account',
  'auth.devices.revoke': 'account',
  'account.delete': 'account',
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
