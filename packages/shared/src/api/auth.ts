import { z } from 'zod';

// HTTP contracts between the launcher and the API (api-spec §2 Auth / Me, ADR-006).

const isoTime = z.iso.datetime();

export const DeviceInfoSchema = z.strictObject({
  name: z.string().trim().min(1).max(100),
  platform: z.enum(['win32', 'darwin', 'linux']),
  appVersion: z.string().min(1).max(40),
});

export const EntitlementSchema = z.object({
  userId: z.string(),
  role: z.enum(['admin', 'subscriber']),
  status: z.enum(['active', 'grace', 'none', 'suspended']),
  plan: z
    .object({ slug: z.string(), name: z.string(), deviceLimit: z.number().int().positive() })
    .nullable(),
  /** Catalog scope slugs. */
  scopes: z.array(z.string()),
  /** Server time of the check. */
  checkedAt: isoTime,
  /** `checkedAt` + grace days: the launcher refuses to run offline after this (FR-AUTH-5). */
  offlineUntil: isoTime,
});

export const UserProfileSchema = z.object({
  id: z.string(),
  email: z.string(),
  name: z.string(),
  avatarUrl: z.string().nullable(),
  role: z.enum(['admin', 'subscriber']),
});

export const DeviceSchema = z.object({
  id: z.string(),
  name: z.string(),
  platform: z.string(),
  appVersion: z.string(),
  createdAt: isoTime,
  lastSeenAt: isoTime,
  revokedAt: isoTime.nullable(),
  /** The device that made the request. */
  current: z.boolean(),
});

/** What the launcher needs to start a sign-in, plus the maintenance banner (D28). */
export const LauncherConfigSchema = z.object({
  authorizeUrl: z.url(),
  clientId: z.string(),
  scopes: z.array(z.string()),
  banner: z.string().nullable(),
});

/** RFC 8252 loopback redirect: the launcher's listener on 127.0.0.1, any port, path /callback. */
export const LoopbackRedirectSchema = z
  .string()
  .regex(/^http:\/\/127\.0\.0\.1:\d{1,5}\/callback$/, 'loopback redirect expected');

/** RFC 7636: 43–128 characters. */
export const CodeVerifierSchema = z
  .string()
  .min(43)
  .max(128)
  .regex(/^[A-Za-z0-9._~-]+$/);

export const ExchangeRequestSchema = z.strictObject({
  code: z.string().min(1).max(2000),
  codeVerifier: CodeVerifierSchema,
  redirectUri: LoopbackRedirectSchema,
  device: DeviceInfoSchema,
});

export const SessionResponseSchema = z.object({
  accessToken: z.string(),
  refreshToken: z.string(),
  deviceId: z.string(),
  user: UserProfileSchema,
  entitlement: EntitlementSchema,
  banner: z.string().nullable(),
});

/** `DEVICE_LIMIT` details: the active devices and a 5-minute ticket to finish the sign-in. */
export const DeviceLimitDetailsSchema = z.object({
  ticket: z.string(),
  devices: z.array(DeviceSchema),
});

export const CompleteRequestSchema = z.strictObject({
  ticket: z.string().min(1).max(4000),
  revokeDeviceId: z.string().min(1).max(100),
  device: DeviceInfoSchema,
});

export const RefreshRequestSchema = z.strictObject({
  refreshToken: z.string().min(1).max(200),
  deviceId: z.string().min(1).max(100),
});

export const LogoutRequestSchema = z.strictObject({
  refreshToken: z.string().min(1).max(200),
});

export const TokenPairSchema = z.object({
  accessToken: z.string(),
  refreshToken: z.string(),
});

export const MeSchema = z.object({ user: UserProfileSchema, entitlement: EntitlementSchema });

export const EntitlementResponseSchema = z.object({
  entitlement: EntitlementSchema,
  banner: z.string().nullable(),
});

export type DeviceInfo = z.output<typeof DeviceInfoSchema>;
export type Entitlement = z.output<typeof EntitlementSchema>;
export type UserProfile = z.output<typeof UserProfileSchema>;
export type Device = z.output<typeof DeviceSchema>;
export type LauncherConfig = z.output<typeof LauncherConfigSchema>;
export type ExchangeRequest = z.output<typeof ExchangeRequestSchema>;
export type SessionResponse = z.output<typeof SessionResponseSchema>;
export type DeviceLimitDetails = z.output<typeof DeviceLimitDetailsSchema>;
export type CompleteRequest = z.output<typeof CompleteRequestSchema>;
export type RefreshRequest = z.output<typeof RefreshRequestSchema>;
export type TokenPair = z.output<typeof TokenPairSchema>;
export type Me = z.output<typeof MeSchema>;
export type EntitlementResponse = z.output<typeof EntitlementResponseSchema>;
