import {
  AppErrorException,
  type AppPathKey,
  type Result,
  type Settings,
  type SettingsLoad,
  type SettingsSnapshot,
} from '@nextlevel/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getBridge } from '../../bridge.ts';

const SETTINGS = ['settings'] as const;
const BACKUPS = ['settings.backups'] as const;

const loaded = (snapshot: SettingsSnapshot): SettingsLoad => ({ kind: 'ok', snapshot });

/** Unwraps an IPC Result; failures become AppErrorException so queries keep the error code. */
export function unwrap<T>(result: Result<T>): T {
  if (!result.ok) throw new AppErrorException(result.error);
  return result.value;
}

/** The code of a failed query or mutation, when it came from main. */
export function errorCode(error: unknown): string | undefined {
  return error instanceof AppErrorException ? error.error.code : undefined;
}

export function useSettings() {
  return useQuery({
    queryKey: SETTINGS,
    queryFn: async (): Promise<SettingsLoad> => unwrap(await getBridge().invoke('settings.get')),
  });
}

/** After any write: the new snapshot is the settings, and the backup list changed. */
function useSnapshotWrite<TInput>(write: (input: TInput) => Promise<SettingsSnapshot>) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: write,
    onSuccess: async (snapshot) => {
      client.setQueryData(SETTINGS, loaded(snapshot));
      await client.invalidateQueries({ queryKey: BACKUPS });
    },
  });
}

export function useSaveSettings() {
  return useSnapshotWrite(async (input: { settings: Settings; baseRevision: number }) =>
    unwrap(await getBridge().invoke('settings.save', input)),
  );
}

export function useResetSettings() {
  return useSnapshotWrite(async () => unwrap(await getBridge().invoke('settings.reset')));
}

export function useRestoreBackup() {
  return useSnapshotWrite(async (id: string) =>
    unwrap(await getBridge().invoke('settings.backups.restore', { id })),
  );
}

export function useImportSettings() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async () => unwrap(await getBridge().invoke('settings.import')),
    onSuccess: async (result) => {
      if (result.status !== 'imported') return;
      client.setQueryData(SETTINGS, loaded(result.snapshot));
      await client.invalidateQueries({ queryKey: BACKUPS });
    },
  });
}

export function useExportSettings() {
  return useMutation({
    mutationFn: async () => unwrap(await getBridge().invoke('settings.export')),
  });
}

export function useBackups() {
  return useQuery({
    queryKey: BACKUPS,
    queryFn: async () => unwrap(await getBridge().invoke('settings.backups.list')),
  });
}

export function useAppPaths() {
  return useQuery({
    queryKey: ['app.paths'],
    queryFn: async () => unwrap(await getBridge().invoke('app.paths')),
    staleTime: Infinity,
  });
}

/** The shipped system catalog (FR-EMU-1); it never changes while the app runs. */
export function useSystemCatalog() {
  return useQuery({
    queryKey: ['systems.catalog'],
    queryFn: async () => unwrap(await getBridge().invoke('systems.catalog')),
    staleTime: Infinity,
  });
}

/** Native folder picker in main; resolves null when cancelled. */
export function usePickFolder() {
  return useMutation({
    mutationFn: async (title: string) =>
      unwrap(await getBridge().invoke('app.pickFolder', { title })),
  });
}

export function useOpenPath() {
  return useMutation({
    mutationFn: async (key: AppPathKey) => {
      unwrap(await getBridge().invoke('app.openPath', { key }));
    },
  });
}
