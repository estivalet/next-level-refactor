import type { CatalogQuery, DownloadSummary } from '@nextlevel/shared';
import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { getBridge } from '../../bridge.ts';
import { useIpcEvent } from '../../events.ts';
import { unwrap } from '../settings/settingsApi.ts';

// The Catalog app's calls (S8, FR-CAT-1..7). Main talks to the API; this only uses the bridge.

const LIST_KEY = 'catalog.list';
const ITEM_KEY = 'catalog.get';
const INSTALLED_KEY = ['catalog.installed'] as const;
const DOWNLOADS_KEY = ['downloads.list'] as const;

export type BrowseQuery = Partial<CatalogQuery>;

function refreshAll(client: QueryClient) {
  return Promise.all([
    client.invalidateQueries({ queryKey: [LIST_KEY] }),
    client.invalidateQueries({ queryKey: [ITEM_KEY] }),
    client.invalidateQueries({ queryKey: INSTALLED_KEY }),
    client.invalidateQueries({ queryKey: DOWNLOADS_KEY }),
  ]);
}

/**
 * Keeps the app in step with main: download progress patches the queue in place (it comes up to
 * 4 times a second); a state change, a finished download or a library change refetch.
 */
export function useCatalogEvents() {
  const client = useQueryClient();
  useIpcEvent('downloads.progress', (progress) => {
    const before = client.getQueryData<DownloadSummary[]>(DOWNLOADS_KEY);
    const known = before?.find((row) => row.id === progress.downloadId);
    if (!known || known.state !== progress.state) {
      void refreshAll(client);
      return;
    }
    client.setQueryData<DownloadSummary[]>(DOWNLOADS_KEY, (rows) =>
      rows?.map((row) =>
        row.id === progress.downloadId
          ? { ...row, bytesDone: progress.bytesDone, bytesTotal: progress.bytesTotal }
          : row,
      ),
    );
  });
  useIpcEvent('downloads.finished', () => {
    void refreshAll(client);
  });
  useIpcEvent('library.changed', () => {
    void client.invalidateQueries({ queryKey: INSTALLED_KEY });
  });
}

export function useCatalogList(query: BrowseQuery, enabled = true) {
  return useQuery({
    queryKey: [LIST_KEY, query],
    queryFn: async () => unwrap(await getBridge().invoke('catalog.list', { limit: 50, ...query })),
    enabled,
    retry: false,
  });
}

export function useCatalogItem(itemId: string | null) {
  return useQuery({
    queryKey: [ITEM_KEY, itemId],
    queryFn: async () => unwrap(await getBridge().invoke('catalog.get', { itemId: itemId ?? '' })),
    enabled: itemId !== null,
    retry: false,
  });
}

export function useInstalled() {
  return useQuery({
    queryKey: INSTALLED_KEY,
    queryFn: async () => unwrap(await getBridge().invoke('catalog.installed')),
  });
}

export function useDownloads() {
  return useQuery({
    queryKey: DOWNLOADS_KEY,
    queryFn: async () => unwrap(await getBridge().invoke('downloads.list')),
  });
}

function useCatalogWrite<T>(call: (input: T) => Promise<unknown>) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: call,
    onSettled: () => refreshAll(client),
  });
}

export const useInstall = () =>
  useCatalogWrite(async (itemId: string) =>
    unwrap(await getBridge().invoke('catalog.install', { itemId })),
  );

export const useUninstall = () =>
  useCatalogWrite(async (input: { itemId: string; confirm: boolean }) => {
    unwrap(await getBridge().invoke('catalog.uninstall', input));
  });

export const useDownloadAction = () =>
  useCatalogWrite(async (input: { downloadId: string; action: 'pause' | 'resume' | 'cancel' }) => {
    unwrap(await getBridge().invoke(`downloads.${input.action}`, { downloadId: input.downloadId }));
  });
