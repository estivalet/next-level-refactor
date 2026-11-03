import type { BatchRules, BatchScope, BatchStatus, GeminiBatchRules } from '@nextlevel/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getBridge } from '../../bridge.ts';
import { useIpcEvent } from '../../events.ts';
import { unwrap } from '../settings/settingsApi.ts';

/** Which batch: the scrape batch (FR-SCR-2) or the Gemini batch (FR-SCR-7); they run side by side. */
export type BatchKind = 'scrape' | 'gemini';

const keyOf = (kind: BatchKind) =>
  kind === 'gemini' ? (['gemini.batch.status'] as const) : (['scraper.batch.status'] as const);

/**
 * A batch job as main sees it: read on mount — the job lives in main, so a Library closed and
 * reopened mid-batch shows it — then kept current by its progress event.
 */
export function useBatchStatus(kind: BatchKind = 'scrape') {
  const client = useQueryClient();
  useIpcEvent(kind === 'gemini' ? 'gemini.batch.progress' : 'scraper.batch.progress', (status) => {
    client.setQueryData<BatchStatus>(keyOf(kind), status);
  });
  return useQuery({
    queryKey: keyOf(kind),
    queryFn: async () =>
      unwrap(
        await (kind === 'gemini'
          ? getBridge().invoke('gemini.batch.status')
          : getBridge().invoke('scraper.batch.status')),
      ),
  });
}

/** Control calls answer with the new status; it goes straight into the query. */
function useControl<TInput>(kind: BatchKind, call: (input: TInput) => Promise<BatchStatus>) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: call,
    onSuccess: (status) => {
      client.setQueryData<BatchStatus>(keyOf(kind), status);
    },
  });
}

export const useStartBatch = () =>
  useControl('scrape', async (input: { scope: BatchScope; rules: BatchRules }) =>
    unwrap(await getBridge().invoke('scraper.batch.start', input)),
  );
export const useStartGeminiBatch = () =>
  useControl('gemini', async (input: { scope: BatchScope; rules: GeminiBatchRules }) =>
    unwrap(await getBridge().invoke('gemini.batch.start', input)),
  );
export const usePauseBatch = (kind: BatchKind = 'scrape') =>
  useControl(kind, async () =>
    unwrap(
      await (kind === 'gemini'
        ? getBridge().invoke('gemini.batch.pause')
        : getBridge().invoke('scraper.batch.pause')),
    ),
  );
export const useResumeBatch = (kind: BatchKind = 'scrape') =>
  useControl(kind, async () =>
    unwrap(
      await (kind === 'gemini'
        ? getBridge().invoke('gemini.batch.resume')
        : getBridge().invoke('scraper.batch.resume')),
    ),
  );
export const useCancelBatch = (kind: BatchKind = 'scrape') =>
  useControl(kind, async () =>
    unwrap(
      await (kind === 'gemini'
        ? getBridge().invoke('gemini.batch.cancel')
        : getBridge().invoke('scraper.batch.cancel')),
    ),
  );
