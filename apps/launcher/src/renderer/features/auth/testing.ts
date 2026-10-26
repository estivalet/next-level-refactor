import type { AuthState, Device, Entitlement } from '@nextlevel/shared';

export const ENTITLEMENT: Entitlement = {
  userId: 'u1',
  role: 'subscriber',
  status: 'active',
  plan: { slug: 'default', name: 'Default', deviceLimit: 3 },
  scopes: [],
  checkedAt: '2026-10-25T12:00:00.000Z',
  offlineUntil: '2026-11-08T12:00:00.000Z',
};

export const signedIn = (
  overrides: Partial<Extract<AuthState, { kind: 'signedIn' }>> = {},
  entitlement: Partial<Entitlement> = {},
): AuthState => ({
  kind: 'signedIn',
  user: {
    id: 'u1',
    email: 'player@example.test',
    name: 'Player One',
    avatarUrl: null,
    role: 'subscriber',
  },
  entitlement: { ...ENTITLEMENT, ...entitlement },
  offline: false,
  banner: null,
  remembered: true,
  ...overrides,
});

export const device = (id: string, name: string, current = false): Device => ({
  id,
  name,
  platform: 'win32',
  appVersion: '0.7.0',
  createdAt: '2026-10-01T10:00:00.000Z',
  lastSeenAt: '2026-10-24T10:00:00.000Z',
  revokedAt: null,
  current,
});
