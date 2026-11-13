import type { SyncState } from '@nextlevel/shared';
import type { IpcHandlers } from '../ipc/router.ts';
import type { SyncService } from './SyncService.ts';

type SyncChannel = Extract<keyof IpcHandlers, `sync.${string}`>;

const OFF: SyncState = { enabled: false, lastSync: null, syncing: false, error: null };

/** Settings → Sync (FR-SET-5, D55); without sign-in (development) sync is simply off. */
export function createSyncHandlers(
  service: Pick<SyncService, 'state' | 'setEnabled' | 'sync' | 'deleteRemote'> | undefined,
): Pick<IpcHandlers, SyncChannel> {
  return {
    'sync.state': () => service?.state() ?? OFF,
    'sync.setEnabled': ({ enabled }) =>
      service ? service.setEnabled(enabled) : Promise.resolve(OFF),
    'sync.now': () => (service ? service.sync() : Promise.resolve(OFF)),
    'sync.deleteRemote': () => (service ? service.deleteRemote() : Promise.resolve(OFF)),
  };
}
