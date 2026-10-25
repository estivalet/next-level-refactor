import { describe, expect, it } from 'vitest';
import {
  AdminUserPatchSchema,
  ApiErrorEnvelopeSchema,
  AppSettingsPatchSchema,
  AppSettingsSchema,
  DeviceLimitDetailsSchema,
  EntitlementSchema,
  ExchangeRequestSchema,
  defaultAppSettings,
} from '../index.ts';

const DEVICE = { name: 'Living room', platform: 'win32', appVersion: '0.7.0' } as const;
const VERIFIER = 'v'.repeat(43);

describe('launcher sign-in contracts (FR-AUTH-2, ADR-006)', () => {
  const exchange = (overrides: Record<string, unknown> = {}) =>
    ExchangeRequestSchema.safeParse({
      code: 'abc',
      codeVerifier: VERIFIER,
      redirectUri: 'http://127.0.0.1:51234/callback',
      device: DEVICE,
      ...overrides,
    });

  it('a loopback exchange with a 43-character verifier is valid', () => {
    expect(exchange().success).toBe(true);
  });

  it.each([
    'http://localhost:51234/callback',
    'https://127.0.0.1:51234/callback',
    'http://127.0.0.1/callback',
    'http://127.0.0.1:51234/other',
    'http://127.0.0.1:51234/callback?x=1',
  ])('the redirect must be http://127.0.0.1:<port>/callback: %s is refused', (redirectUri) => {
    expect(exchange({ redirectUri }).success).toBe(false);
  });

  it('a 42-character verifier and unknown keys are refused', () => {
    expect(exchange({ codeVerifier: 'v'.repeat(42) }).success).toBe(false);
    expect(exchange({ extra: true }).success).toBe(false);
  });

  it('the entitlement carries the offline deadline (FR-AUTH-5)', () => {
    const entitlement = {
      userId: 'u1',
      role: 'subscriber',
      status: 'active',
      plan: { slug: 'default', name: 'Default', deviceLimit: 3 },
      scopes: [],
      checkedAt: '2026-10-25T12:00:00.000Z',
      offlineUntil: '2026-11-08T12:00:00.000Z',
    };
    expect(EntitlementSchema.parse(entitlement)).toEqual(entitlement);
    expect(EntitlementSchema.safeParse({ ...entitlement, status: 'expired' }).success).toBe(false);
  });
});

describe('app settings (FR-ADM-4, D22)', () => {
  it('defaults: 14 grace days, allow-list sign-up, no list, no banner', () => {
    expect(defaultAppSettings()).toEqual({
      graceDays: 14,
      signUpMode: 'allowList',
      allowList: [],
      banner: null,
    });
    expect(AppSettingsSchema.parse(defaultAppSettings())).toEqual(defaultAppSettings());
  });

  it('grace days run from 1 to 90', () => {
    const at = (graceDays: number) =>
      AppSettingsSchema.safeParse({ ...defaultAppSettings(), graceDays }).success;
    expect([at(0), at(1), at(90), at(91)]).toEqual([false, true, true, false]);
  });

  it('allow-list emails are trimmed, lowercased and de-duplicated; a bad one is refused', () => {
    const parsed = AppSettingsPatchSchema.parse({
      allowList: [' Tester@Example.TEST ', 'tester@example.test', 'b@example.test'],
    });
    expect(parsed.allowList).toEqual(['tester@example.test', 'b@example.test']);
    expect(AppSettingsPatchSchema.safeParse({ allowList: ['nope'] }).success).toBe(false);
  });

  it('the banner is at most 280 characters; an empty one is no banner', () => {
    expect(AppSettingsPatchSchema.parse({ banner: '  ' }).banner).toBeNull();
    expect(AppSettingsPatchSchema.safeParse({ banner: 'x'.repeat(281) }).success).toBe(false);
    expect(AppSettingsPatchSchema.safeParse({ unknown: 1 }).success).toBe(false);
  });
});

describe('admin and error contracts (FR-ADM-1, FR-AUTH-7)', () => {
  it('suspending needs a reason of 1–500 characters (US-F3)', () => {
    expect(AdminUserPatchSchema.safeParse({ status: 'suspended' }).success).toBe(false);
    expect(
      AdminUserPatchSchema.safeParse({ status: 'suspended', suspendedReason: ' ' }).success,
    ).toBe(false);
    expect(
      AdminUserPatchSchema.safeParse({ status: 'suspended', suspendedReason: 'abuse' }).success,
    ).toBe(true);
    expect(AdminUserPatchSchema.safeParse({ role: 'admin' }).success).toBe(true);
  });

  it('a DEVICE_LIMIT envelope round-trips with its devices and ticket (US-A4)', () => {
    const envelope = {
      error: {
        code: 'DEVICE_LIMIT',
        message: 'Device limit reached.',
        requestId: 'req-1',
        details: {
          ticket: 't',
          devices: [
            {
              id: 'd1',
              name: 'Den',
              platform: 'win32',
              appVersion: '0.7.0',
              createdAt: '2026-10-01T00:00:00.000Z',
              lastSeenAt: '2026-10-20T00:00:00.000Z',
              revokedAt: null,
              current: false,
            },
          ],
        },
      },
    };
    const parsed = ApiErrorEnvelopeSchema.parse(envelope);
    expect(parsed).toEqual(envelope);
    expect(DeviceLimitDetailsSchema.parse(parsed.error.details).devices).toHaveLength(1);
  });
});
