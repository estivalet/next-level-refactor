import type { SystemInfo } from '@nextlevel/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getBridge } from '../../bridge.ts';
import { useIpcEvent } from '../../events.ts';
import { unwrap } from '../settings/settingsApi.ts';

export const MUSEUM_KEY = ['museum'] as const;

/** Every system's museum row (FR-MUS-2), refreshed when an entry or the settings change. */
export function useSystemInfoList() {
  const client = useQueryClient();
  const refresh = () => {
    void client.invalidateQueries({ queryKey: MUSEUM_KEY });
  };
  useIpcEvent('systems.infoChanged', refresh);
  useIpcEvent('settings.changed', refresh);
  return useQuery({
    queryKey: [...MUSEUM_KEY, 'list'],
    queryFn: async () => unwrap(await getBridge().invoke('systems.info.list')),
  });
}

/** One system's merged entry and whether the user has edited it (FR-MUS-2). */
export function useSystemInfo(systemId: string | null) {
  return useQuery({
    queryKey: [...MUSEUM_KEY, 'entry', systemId],
    enabled: systemId !== null,
    queryFn: async () =>
      unwrap(await getBridge().invoke('systems.info.get', { systemId: systemId ?? '' })),
  });
}

function useMuseumMutation<Input>(run: (input: Input) => Promise<SystemInfo>) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: run,
    onSuccess: () => client.invalidateQueries({ queryKey: MUSEUM_KEY }),
  });
}

export function useSaveSystemInfo() {
  return useMuseumMutation(async (input: { systemId: string; entry: SystemInfo }) =>
    unwrap(await getBridge().invoke('systems.info.save', input)),
  );
}

export function useResetSystemInfo() {
  return useMuseumMutation(async (input: { systemId: string }) =>
    unwrap(await getBridge().invoke('systems.info.reset', input)),
  );
}
