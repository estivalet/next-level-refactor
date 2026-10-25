import type { AuthState, Device } from '@nextlevel/shared';
import type { IpcHandlers } from '../ipc/router.ts';

type AuthChannel =
  | 'auth.state'
  | 'auth.signIn'
  | 'auth.cancelSignIn'
  | 'auth.signOut'
  | 'auth.refreshEntitlement'
  | 'auth.resolveDeviceLimit'
  | 'auth.devices.list'
  | 'auth.devices.revoke';

/** What the auth channels need from main's AuthService. */
export interface AuthApi {
  state(): AuthState;
  signIn(): Promise<AuthState>;
  cancelSignIn(): AuthState;
  signOut(): Promise<AuthState>;
  refreshEntitlement(): Promise<AuthState>;
  resolveDeviceLimit(revokeDeviceId: string): Promise<AuthState>;
  devices(): Promise<Device[]>;
  revokeDevice(deviceId: string): Promise<Device[]>;
}

const disabled: AuthState = { kind: 'disabled' };

/** Sign-in off (`NEXTLEVEL_AUTH=off`, development builds only, D25): no gate, no account. */
export const DISABLED_AUTH: AuthApi = {
  state: () => disabled,
  signIn: () => Promise.resolve(disabled),
  cancelSignIn: () => disabled,
  signOut: () => Promise.resolve(disabled),
  refreshEntitlement: () => Promise.resolve(disabled),
  resolveDeviceLimit: () => Promise.resolve(disabled),
  devices: () => Promise.resolve([]),
  revokeDevice: () => Promise.resolve([]),
};

/** Launcher sign-in channels (api-spec §3 Auth). */
export function createAuthHandlers(auth: AuthApi): Pick<IpcHandlers, AuthChannel> {
  return {
    'auth.state': () => auth.state(),
    'auth.signIn': () => auth.signIn(),
    'auth.cancelSignIn': () => auth.cancelSignIn(),
    'auth.signOut': () => auth.signOut(),
    'auth.refreshEntitlement': () => auth.refreshEntitlement(),
    'auth.resolveDeviceLimit': ({ revokeDeviceId }) => auth.resolveDeviceLimit(revokeDeviceId),
    'auth.devices.list': () => auth.devices(),
    'auth.devices.revoke': ({ deviceId }) => auth.revokeDevice(deviceId),
  };
}
