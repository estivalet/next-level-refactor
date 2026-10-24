import type { IpcInput } from '@nextlevel/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getBridge } from '../../../bridge.ts';
import { unwrap } from '../settingsApi.ts';

const STATUS_KEY = ['scraper.credentials.status'] as const;

/** Which ScreenScraper credentials the OS store holds (FR-SCR-3); flags only. */
export function useCredentialStatus() {
  return useQuery({
    queryKey: STATUS_KEY,
    queryFn: async () => unwrap(await getBridge().invoke('scraper.credentials.status')),
  });
}

export function useSetCredentials() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (input: IpcInput<'scraper.credentials.set'>) =>
      unwrap(await getBridge().invoke('scraper.credentials.set', input)),
    onSuccess: (status) => {
      client.setQueryData(STATUS_KEY, status);
    },
  });
}

/** Settings → Scraper → Test (US-D6). */
export function useTestCredentials() {
  return useMutation({
    mutationFn: async () => unwrap(await getBridge().invoke('scraper.test')),
  });
}
