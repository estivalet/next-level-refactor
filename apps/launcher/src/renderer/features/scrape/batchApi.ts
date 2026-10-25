import type { BatchRules, BatchScope, BatchStatus } from '@nextlevel/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getBridge } from '../../bridge.ts';
import { useIpcEvent } from '../../events.ts';
import { unwrap } from '../settings/settingsApi.ts';

const BATCH_KEY = ['scraper.batch.status'] as const;

/**
 * The batch job as main sees it (FR-SCR-2): read on mount — the job lives in main, so a Library
 * closed and reopened mid-batch shows it — then kept current by `scraper.batch.progress`.
 */
export function useBatchStatus() {
  const client = useQueryClient();
  useIpcEvent('scraper.batch.progress', (status) => {
    client.setQueryData<BatchStatus>(BATCH_KEY, status);
  });
  return useQuery({
    queryKey: BATCH_KEY,
    queryFn: async () => unwrap(await getBridge().invoke('scraper.batch.status')),
  });
}

/** Control calls answer with the new status; it goes straight into the query. */
function useControl<TInput>(call: (input: TInput) => Promise<BatchStatus>) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: call,
    onSuccess: (status) => {
      client.setQueryData<BatchStatus>(BATCH_KEY, status);
    },
  });
}

export const useStartBatch = () =>
  useControl(async (input: { scope: BatchScope; rules: BatchRules }) =>
    unwrap(await getBridge().invoke('scraper.batch.start', input)),
  );
export const usePauseBatch = () =>
  useControl(async () => unwrap(await getBridge().invoke('scraper.batch.pause')));
export const useResumeBatch = () =>
  useControl(async () => unwrap(await getBridge().invoke('scraper.batch.resume')));
export const useCancelBatch = () =>
  useControl(async () => unwrap(await getBridge().invoke('scraper.batch.cancel')));
