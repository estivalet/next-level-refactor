import { z } from 'zod';
import { DeviceSchema, EntitlementSchema, UserProfileSchema } from '../api/auth.ts';

// The launcher's sign-in state as main sees it (IA §1 gate layer, F2 boot routing).

export const SIGNED_OUT_REASONS = [
  'cancelled',
  'timeout',
  'notAllowed',
  'revoked',
  'offlineExpired',
  'unreachable',
  'error',
] as const;

export const AuthStateSchema = z.discriminatedUnion('kind', [
  /** `NEXTLEVEL_AUTH=off` in a development build (D25): no gate. */
  z.object({ kind: z.literal('disabled') }),
  z.object({ kind: z.literal('checking') }),
  z.object({
    kind: z.literal('signedOut'),
    reason: z.enum(SIGNED_OUT_REASONS).nullable(),
    banner: z.string().nullable(),
  }),
  /** Waiting for the browser (up to 5 minutes). */
  z.object({ kind: z.literal('signingIn') }),
  /** The plan's devices are all in use: remove one to continue (US-A4). */
  z.object({ kind: z.literal('deviceLimit'), devices: z.array(DeviceSchema) }),
  z.object({
    kind: z.literal('signedIn'),
    user: UserProfileSchema,
    entitlement: EntitlementSchema,
    /** Running on the cached entitlement inside the grace period (FR-AUTH-5). */
    offline: z.boolean(),
    banner: z.string().nullable(),
    /** False when the OS store is unavailable: the sign-in lasts until quit. */
    remembered: z.boolean(),
    /** Checkout is open in the browser and main is polling the entitlement (IA F7). */
    waitingForPayment: z.boolean().optional(),
  }),
]);

/** What main keeps in the OS credential store under `auth.session` (never in settings). */
export const SessionRecordSchema = z.object({
  deviceId: z.string(),
  refreshToken: z.string(),
  user: UserProfileSchema,
  entitlement: EntitlementSchema,
  /** This PC's clock when the entitlement was last checked (grace is counted from it). */
  localCheckedAt: z.iso.datetime(),
});

export type AuthState = z.output<typeof AuthStateSchema>;
export type SignedOutReason = (typeof SIGNED_OUT_REASONS)[number];
export type SessionRecord = z.output<typeof SessionRecordSchema>;
