import { AppErrorException, ERROR_CODES } from '@nextlevel/shared';
import type { IpcHandlers } from '../ipc/router.ts';

type LaunchBoxChannel = Extract<keyof IpcHandlers, `launchbox.${string}`>;

const missing = (): never => {
  throw new AppErrorException({
    code: 'LAUNCHBOX_INDEX_MISSING',
    message: ERROR_CODES.LAUNCHBOX_INDEX_MISSING,
  });
};

/** LaunchBox database channels (FR-SCR-6); the service arrives in Task 5. */
export function createLaunchBoxHandlers(): Pick<IpcHandlers, LaunchBoxChannel> {
  return {
    'launchbox.status': missing,
    'launchbox.refresh': missing,
    'launchbox.cancel': missing,
    'launchbox.platforms': missing,
    'launchbox.setPlatform': missing,
  };
}
