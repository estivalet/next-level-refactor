import { ipcContract, type IpcChannel } from '@nextlevel/shared';
import type { IpcHandlers } from './router.ts';

/**
 * Completes a partial handler map: channels without a handler throw, which the router reports as
 * INTERNAL. Used by tests that exercise a few channels.
 */
export function withUnimplemented(handlers: Partial<IpcHandlers>): IpcHandlers {
  const complete: Record<string, unknown> = { ...handlers };
  for (const channel of Object.keys(ipcContract) as IpcChannel[]) {
    complete[channel] ??= () => {
      throw new Error(`IPC channel ${channel} is not implemented`);
    };
  }
  return complete as IpcHandlers;
}
