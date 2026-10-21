import { ERROR_CODES, err } from '@nextlevel/shared';
import type { IpcMain } from 'electron';
import type { IpcRouter } from './router.ts';

export type IpcRegistrar = Pick<IpcMain, 'handle'>;

/** Registers one ipcMain handler per contract channel; every channel takes at most one argument. */
export function registerIpcRouter(ipc: IpcRegistrar, router: IpcRouter): void {
  for (const channel of router.channels) {
    ipc.handle(channel, (_event, ...args: unknown[]) =>
      args.length > 1
        ? err('VALIDATION_FAILED', ERROR_CODES.VALIDATION_FAILED, { reason: 'too many arguments' })
        : router.handle(channel, args[0]),
    );
  }
}
