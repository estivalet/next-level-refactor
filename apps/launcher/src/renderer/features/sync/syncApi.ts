import type { SyncState } from '@nextlevel/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getBridge } from '../../bridge.ts';
import { useIpcEvent } from '../../events.ts';
import { unwrap } from '../settings/settingsApi.ts';

const SYNC_KEY = ['sync.state'] as const;

/** Settings sync as main sees it (FR-SET-5): read once, then kept current by `sync.changed`. */
export function useSyncState() {
  const client = useQueryClient();
  useIpcEvent('sync.changed', (state) => {
    client.setQueryData<SyncState>(SYNC_KEY, state);
  });
  return useQuery({
    queryKey: SYNC_KEY,
    queryFn: async () => unwrap(await getBridge().invoke('sync.state')),
    retry: false,
  });
}

function useSyncCall<TInput>(call: (input: TInput) => Promise<SyncState>) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: call,
    onSuccess: (state) => {
      client.setQueryData<SyncState>(SYNC_KEY, state);
    },
  });
}

export const useSetSyncEnabled = () =>
  useSyncCall(async (enabled: boolean) =>
    unwrap(await getBridge().invoke('sync.setEnabled', { enabled })),
  );
export const useSyncNow = () =>
  useSyncCall(async () => unwrap(await getBridge().invoke('sync.now')));
export const useDeleteSynced = () =>
  useSyncCall(async () => unwrap(await getBridge().invoke('sync.deleteRemote')));
