import type { GeminiKeyStatus } from '@nextlevel/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getBridge } from '../../../bridge.ts';
import { unwrap } from '../settingsApi.ts';

export const GEMINI_KEY_STATUS = ['gemini.key.status'] as const;

/** Whether a Gemini key is stored (FR-SCR-7); never the key itself. */
export function useGeminiKeyStatus() {
  return useQuery({
    queryKey: GEMINI_KEY_STATUS,
    queryFn: async () => unwrap(await getBridge().invoke('gemini.key.status')),
  });
}

/** Save (or with null, remove) the key; `test` sends one tiny request. */
export function useGeminiKeyActions() {
  const client = useQueryClient();
  const set = useMutation({
    mutationFn: async (apiKey: string | null) =>
      unwrap(await getBridge().invoke('gemini.key.set', { apiKey })),
    onSuccess: (status: GeminiKeyStatus) => {
      client.setQueryData(GEMINI_KEY_STATUS, status);
    },
  });
  const test = useMutation({
    mutationFn: async () => unwrap(await getBridge().invoke('gemini.test')),
  });
  return { set, test };
}
