import type { AuthState, Device } from '@nextlevel/shared';
import { describe, expect, it } from 'vitest';
import { createAuthHandlers, DISABLED_AUTH, type AuthApi } from './authHandlers.ts';

const SIGNED_OUT: AuthState = { kind: 'signedOut', reason: null, banner: null };

describe('auth channels (FR-AUTH-2, FR-AUTH-6, FR-AUTH-8)', () => {
  it('every channel goes to the auth service', async () => {
    const calls: unknown[] = [];
    const device: Device = {
      id: 'd2',
      name: 'Den',
      platform: 'win32',
      appVersion: '0.7.0',
      createdAt: '2026-10-25T12:00:00.000Z',
      lastSeenAt: '2026-10-25T12:00:00.000Z',
      revokedAt: null,
      current: false,
    };
    const auth: AuthApi = {
      state: () => SIGNED_OUT,
      signIn: () => (calls.push('signIn'), Promise.resolve({ kind: 'signingIn' })),
      cancelSignIn: () => (calls.push('cancel'), SIGNED_OUT),
      signOut: () => (calls.push('signOut'), Promise.resolve(SIGNED_OUT)),
      refreshEntitlement: () => (calls.push('refresh'), Promise.resolve(SIGNED_OUT)),
      resolveDeviceLimit: (id) => (calls.push(['resolve', id]), Promise.resolve(SIGNED_OUT)),
      devices: () => Promise.resolve([device]),
      revokeDevice: (id) => (calls.push(['revoke', id]), Promise.resolve([])),
    };
    const handlers = createAuthHandlers(auth);
    expect(handlers['auth.state']()).toEqual(SIGNED_OUT);
    await handlers['auth.signIn']();
    handlers['auth.cancelSignIn']();
    await handlers['auth.signOut']();
    await handlers['auth.refreshEntitlement']();
    await handlers['auth.resolveDeviceLimit']({ revokeDeviceId: 'd1' });
    expect(await handlers['auth.devices.list']()).toEqual([device]);
    await handlers['auth.devices.revoke']({ deviceId: 'd2' });
    expect(calls).toEqual([
      'signIn',
      'cancel',
      'signOut',
      'refresh',
      ['resolve', 'd1'],
      ['revoke', 'd2'],
    ]);
  });

  it('D25: with sign-in off every channel answers disabled and there are no devices', async () => {
    const handlers = createAuthHandlers(DISABLED_AUTH);
    expect(handlers['auth.state']()).toEqual({ kind: 'disabled' });
    expect(await handlers['auth.signIn']()).toEqual({ kind: 'disabled' });
    expect(await handlers['auth.devices.list']()).toEqual([]);
  });
});
