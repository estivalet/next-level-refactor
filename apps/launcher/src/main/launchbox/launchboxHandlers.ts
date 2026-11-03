import {
  AppErrorException,
  ERROR_CODES,
  SystemSettingsSchema,
  type Settings,
} from '@nextlevel/shared';
import type { IpcHandlers } from '../ipc/router.ts';
import type { LaunchBoxIndex } from './LaunchBoxIndex.ts';
import type { LaunchBoxService } from './LaunchBoxService.ts';

type LaunchBoxChannel = Extract<keyof IpcHandlers, `launchbox.${string}`>;

/** LaunchBox database channels (FR-SCR-6). */
export function createLaunchBoxHandlers(deps: {
  service: () => Pick<LaunchBoxService, 'status' | 'refresh' | 'cancel'> & {
    index: () => Pick<LaunchBoxIndex, 'platforms'>;
  };
  /** A settings write (with its backup and `settings.changed`). */
  updateSettings: (change: (settings: Settings) => Settings) => Promise<void>;
  /** Whether the system catalog has this system id. */
  systemExists: (systemId: string) => boolean;
}): Pick<IpcHandlers, LaunchBoxChannel> {
  return {
    'launchbox.status': () => deps.service().status(),
    'launchbox.refresh': () => deps.service().refresh(),
    'launchbox.cancel': () => deps.service().cancel(),
    'launchbox.platforms': () => deps.service().index().platforms(),
    'launchbox.setPlatform': ({ systemId, platform }) => {
      if (!deps.systemExists(systemId)) {
        return Promise.reject(
          new AppErrorException({ code: 'NOT_FOUND', message: ERROR_CODES.NOT_FOUND }),
        );
      }
      return deps.updateSettings((settings) => ({
        ...settings,
        systems: {
          ...settings.systems,
          [systemId]: {
            ...(settings.systems[systemId] ?? SystemSettingsSchema.parse({})),
            launchboxPlatform: platform,
          },
        },
      }));
    },
  };
}
