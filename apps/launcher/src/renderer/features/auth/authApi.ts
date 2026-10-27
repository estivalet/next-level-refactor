import type { AuthState, BillingInterval, Device } from '@nextlevel/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getBridge } from '../../bridge.ts';
import { useIpcEvent } from '../../events.ts';
import { unwrap } from '../settings/settingsApi.ts';

const AUTH_KEY = ['auth.state'] as const;
const DEVICES_KEY = ['auth.devices.list'] as const;
const PLANS_KEY = ['auth.plans'] as const;

/**
 * The sign-in state as main sees it (FR-AUTH-*): read once, then kept current by
 * `auth.changed`, so the gate follows sign-in, sign-out, offline and suspension without a reload.
 */
export function useAuthState() {
  const client = useQueryClient();
  useIpcEvent('auth.changed', (state) => {
    client.setQueryData<AuthState>(AUTH_KEY, state);
  });
  return useQuery({
    queryKey: AUTH_KEY,
    queryFn: async () => unwrap(await getBridge().invoke('auth.state')),
  });
}

/** Calls that answer with the new state put it straight into the query. */
function useAuthCall<TInput = void>(call: (input: TInput) => Promise<AuthState>) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: call,
    onSuccess: (state) => {
      client.setQueryData<AuthState>(AUTH_KEY, state);
    },
  });
}

export const useSignIn = () =>
  useAuthCall(async () => unwrap(await getBridge().invoke('auth.signIn')));
export const useCancelSignIn = () =>
  useAuthCall(async () => unwrap(await getBridge().invoke('auth.cancelSignIn')));
export const useSignOut = () =>
  useAuthCall(async () => unwrap(await getBridge().invoke('auth.signOut')));
export const useRefreshEntitlement = () =>
  useAuthCall(async () => unwrap(await getBridge().invoke('auth.refreshEntitlement')));
export const useResolveDeviceLimit = () =>
  useAuthCall(async (revokeDeviceId: string) =>
    unwrap(await getBridge().invoke('auth.resolveDeviceLimit', { revokeDeviceId })),
  );

/** The account's devices (Account app); offline it fails with API_UNREACHABLE. */
export function useDevices(enabled: boolean) {
  return useQuery({
    queryKey: DEVICES_KEY,
    queryFn: async () => unwrap(await getBridge().invoke('auth.devices.list')),
    enabled,
    retry: false,
  });
}

export function useRevokeDevice() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (deviceId: string) =>
      unwrap(await getBridge().invoke('auth.devices.revoke', { deviceId })),
    onSuccess: (devices) => {
      client.setQueryData<Device[]>(DEVICES_KEY, devices);
    },
  });
}

/** The plans on sale (S3). */
export function usePlans() {
  return useQuery({
    queryKey: PLANS_KEY,
    queryFn: async () => unwrap(await getBridge().invoke('auth.plans')),
    retry: false,
  });
}

/** Opens Checkout in the browser; main then waits for the payment (IA F7). */
export const useOpenCheckout = () =>
  useAuthCall(async (input: { planSlug: string; interval: BillingInterval }) =>
    unwrap(await getBridge().invoke('auth.openCheckout', input)),
  );
export const useStopWaiting = () =>
  useAuthCall(async () => unwrap(await getBridge().invoke('auth.stopWaiting')));

/** Opens the Stripe Customer Portal in the browser (S12 Manage billing). */
export function useOpenPortal() {
  return useMutation({
    mutationFn: async () => {
      unwrap(await getBridge().invoke('auth.openPortal'));
    },
  });
}
