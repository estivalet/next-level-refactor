import type { UpdateState } from '@nextlevel/shared';
import type { IpcHandlers } from '../ipc/router.ts';
import type { UpdateService } from './UpdateService.ts';

type UpdateChannel = Extract<keyof IpcHandlers, `update.${string}`>;

const NOT_WIRED: UpdateState = {
  kind: 'unsupported',
  reason: 'dev',
  availableVersion: null,
  releaseUrl: null,
};

/** Update channels (NFR-UPD-1, D53); without a service the launcher acts as a development build. */
export function createUpdateHandlers(
  service: Pick<UpdateService, 'state' | 'check' | 'restart'> | undefined,
): Pick<IpcHandlers, UpdateChannel> {
  return {
    'update.state': () => service?.state() ?? NOT_WIRED,
    'update.check': () => service?.check() ?? NOT_WIRED,
    'update.restart': () => {
      service?.restart();
    },
  };
}
