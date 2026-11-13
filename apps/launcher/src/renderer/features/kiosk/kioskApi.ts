import type { KioskHide, KioskState } from '@nextlevel/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import type { AppId } from '../../apps/registry.ts';
import { getBridge } from '../../bridge.ts';
import { useIpcEvent } from '../../events.ts';
import { unwrap } from '../settings/settingsApi.ts';

const KIOSK_KEY = ['kiosk.state'] as const;

/** Kiosk mode as main sees it (FR-SET-6): read once, then kept current by `kiosk.changed`. */
export function useKioskState() {
  const client = useQueryClient();
  useIpcEvent('kiosk.changed', (state) => {
    client.setQueryData<KioskState>(KIOSK_KEY, state);
  });
  return useQuery({
    queryKey: KIOSK_KEY,
    queryFn: async () => unwrap(await getBridge().invoke('kiosk.state')),
    retry: false,
  });
}

/** Whether a part is hidden right now (kiosk on and locked). Unknown state hides nothing. */
export function useKioskHides(): (part: KioskHide) => boolean {
  const state = useKioskState().data;
  return useCallback(
    (part: KioskHide) => Boolean(state?.locked && state.hide.includes(part)),
    [state],
  );
}

/** The kiosk part that hides each desktop app (the Menu Editor goes with Settings). */
const APP_PART: Partial<Record<AppId, KioskHide>> = {
  settings: 'settings',
  'menu-editor': 'settings',
  catalog: 'catalog',
  account: 'account',
};

export function useKioskHidesApp(): (app: AppId) => boolean {
  const hides = useKioskHides();
  return useCallback(
    (app: AppId) => {
      const part = APP_PART[app];
      return part ? hides(part) : false;
    },
    [hides],
  );
}

function useKioskCall<TInput, TOutput>(call: (input: TInput) => Promise<TOutput>) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: call,
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: KIOSK_KEY });
    },
  });
}

export const useUnlockKiosk = () =>
  useKioskCall(async (pin: string) => unwrap(await getBridge().invoke('kiosk.unlock', { pin })));
export const useLockKiosk = () =>
  useKioskCall(async () => unwrap(await getBridge().invoke('kiosk.lock')));
export const useConfigureKiosk = () =>
  useKioskCall(async (input: { enabled: boolean; pin?: string; hide: KioskHide[] }) =>
    unwrap(await getBridge().invoke('kiosk.configure', input)),
  );
