import type { ScanStatus } from '@nextlevel/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getBridge } from '../../bridge.ts';
import { useIpcEvent } from '../../events.ts';
import { unwrap } from '../settings/settingsApi.ts';

const STATUS = ['scan.status'] as const;

/** The scan status, kept live by `scan.progress` and `scan.finished` events (FR-LIB-3). */
export function useScanStatus() {
  const client = useQueryClient();
  useIpcEvent('scan.progress', (progress) => {
    client.setQueryData<ScanStatus>(STATUS, (current) => ({
      running: true,
      progress,
      last: current?.last ?? null,
    }));
  });
  useIpcEvent('scan.finished', (last) => {
    client.setQueryData<ScanStatus>(STATUS, { running: false, progress: null, last });
  });
  return useQuery({
    queryKey: STATUS,
    queryFn: async () => unwrap(await getBridge().invoke('scan.status')),
    retry: false,
  });
}

/**
 * Starts a scan of the given systems, or of every eligible one. The reply is not written to the cache: a fast scan can
 * finish before it arrives, so the status is fetched again instead.
 */
export function useStartScan() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (systemIds?: string[]) =>
      unwrap(await getBridge().invoke('scan.start', systemIds ? { systemIds } : {})),
    onSettled: () => client.invalidateQueries({ queryKey: STATUS }),
  });
}

export function useCancelScan() {
  return useMutation({
    mutationFn: async () => unwrap(await getBridge().invoke('scan.cancel')),
  });
}
