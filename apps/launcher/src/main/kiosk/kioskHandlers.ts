import type { KioskState } from '@nextlevel/shared';
import type { IpcHandlers } from '../ipc/router.ts';
import type { KioskService } from './KioskService.ts';

type KioskChannel = Extract<keyof IpcHandlers, `kiosk.${string}`>;

const OFF: KioskState = { enabled: false, locked: false, hide: [], retryAfterMs: 0 };

/** Kiosk channels (FR-SET-6, D54); without a service kiosk is simply off. */
export function createKioskHandlers(
  service: Pick<KioskService, 'state' | 'unlock' | 'lock' | 'configure'> | undefined,
): Pick<IpcHandlers, KioskChannel> {
  return {
    'kiosk.state': () => service?.state() ?? OFF,
    'kiosk.unlock': ({ pin }) =>
      service ? service.unlock(pin) : Promise.resolve({ ok: true as const }),
    'kiosk.lock': () => service?.lock() ?? OFF,
    'kiosk.configure': (input) => (service ? service.configure(input) : Promise.resolve(OFF)),
  };
}
