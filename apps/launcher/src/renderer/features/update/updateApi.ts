import type { UpdateState } from '@nextlevel/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getBridge } from '../../bridge.ts';
import { useIpcEvent } from '../../events.ts';
import { unwrap } from '../settings/settingsApi.ts';

const UPDATE_KEY = ['update.state'] as const;

/** What the updater is doing (NFR-UPD-1): read once, then kept current by `update.changed`. */
export function useUpdateState() {
  const client = useQueryClient();
  useIpcEvent('update.changed', (state) => {
    client.setQueryData<UpdateState>(UPDATE_KEY, state);
  });
  return useQuery({
    queryKey: UPDATE_KEY,
    queryFn: async () => unwrap(await getBridge().invoke('update.state')),
    retry: false,
  });
}

/** Check now; the answer is the state right after the check started. */
export function useCheckForUpdates() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async () => unwrap(await getBridge().invoke('update.check')),
    onSuccess: (state) => {
      client.setQueryData<UpdateState>(UPDATE_KEY, state);
    },
  });
}

/** Restart to update: NextLevel quits, installs the update and starts again. */
export function useRestartToUpdate() {
  return useMutation({
    mutationFn: async () => {
      unwrap(await getBridge().invoke('update.restart'));
    },
  });
}

/** Opens the download page of a newer release in the browser (zip copies). */
export function useOpenReleasePage() {
  return useMutation({
    mutationFn: async () => {
      unwrap(await getBridge().invoke('update.openRelease'));
    },
  });
}
