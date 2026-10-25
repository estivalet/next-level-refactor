import { describe, expect, it } from 'vitest';
import { AuthStateSchema, ipcContract, SessionRecordSchema } from '../index.ts';

const USER = { id: 'u1', email: 'p@example.test', name: 'P', avatarUrl: null, role: 'subscriber' };
const ENTITLEMENT = {
  userId: 'u1',
  role: 'subscriber',
  status: 'active',
  plan: { slug: 'default', name: 'Default', deviceLimit: 3 },
  scopes: [],
  checkedAt: '2026-10-25T12:00:00.000Z',
  offlineUntil: '2026-11-08T12:00:00.000Z',
};

describe('launcher auth state (FR-AUTH-2, FR-AUTH-5, FR-AUTH-6)', () => {
  it('each state the gate shows parses', () => {
    for (const state of [
      { kind: 'disabled' },
      { kind: 'checking' },
      { kind: 'signingIn' },
      { kind: 'signedOut', reason: null, banner: null },
      { kind: 'signedOut', reason: 'offlineExpired', banner: 'Maintenance' },
      { kind: 'deviceLimit', devices: [] },
      {
        kind: 'signedIn',
        user: USER,
        entitlement: ENTITLEMENT,
        offline: true,
        banner: null,
        remembered: true,
      },
    ]) {
      expect(AuthStateSchema.safeParse(state).success, state.kind).toBe(true);
    }
    expect(
      AuthStateSchema.safeParse({ kind: 'signedOut', reason: 'nope', banner: null }).success,
    ).toBe(false);
  });

  it('the stored session keeps the refresh token with the last entitlement', () => {
    const record = {
      deviceId: 'd1',
      refreshToken: 'r',
      user: USER,
      entitlement: ENTITLEMENT,
      localCheckedAt: '2026-10-25T12:00:01.000Z',
    };
    expect(SessionRecordSchema.parse(record)).toEqual(record);
  });

  it('auth channels: device revoke takes only a device id', () => {
    const revoke = ipcContract['auth.devices.revoke'].input;
    expect(revoke.safeParse({ deviceId: 'd1' }).success).toBe(true);
    expect(revoke.safeParse({ deviceId: 'd1', extra: 1 }).success).toBe(false);
    expect(
      ipcContract['auth.resolveDeviceLimit'].input.safeParse({ revokeDeviceId: 'd' }).success,
    ).toBe(true);
    expect(ipcContract['auth.state'].output.safeParse({ kind: 'checking' }).success).toBe(true);
  });
});
