import type { LaunchBoxStatus } from '@nextlevel/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getBridge } from '../../../bridge.ts';
import { useIpcEvent } from '../../../events.ts';
import { unwrap } from '../settingsApi.ts';

export const LAUNCHBOX_STATUS_KEY = ['launchbox.status'] as const;

/** The LaunchBox database state (FR-SCR-6), kept live by `launchbox.changed`. */
export function useLaunchBoxStatus() {
  const client = useQueryClient();
  useIpcEvent('launchbox.changed', (status) => {
    client.setQueryData<LaunchBoxStatus>(LAUNCHBOX_STATUS_KEY, status);
  });
  return useQuery({
    queryKey: LAUNCHBOX_STATUS_KEY,
    queryFn: async () => unwrap(await getBridge().invoke('launchbox.status')),
  });
}

/** Download (or refresh) the database; `cancel` stops it. */
export function useLaunchBoxActions() {
  const client = useQueryClient();
  const store = (status: LaunchBoxStatus) => {
    client.setQueryData(LAUNCHBOX_STATUS_KEY, status);
  };
  const refresh = useMutation({
    mutationFn: async () => unwrap(await getBridge().invoke('launchbox.refresh')),
    onSuccess: store,
  });
  const cancel = useMutation({
    mutationFn: async () => unwrap(await getBridge().invoke('launchbox.cancel')),
    onSuccess: store,
  });
  return { refresh, cancel };
}
