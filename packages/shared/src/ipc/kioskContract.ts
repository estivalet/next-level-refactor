import { z } from 'zod';

/** What kiosk mode can hide (D54); everything is ticked by default. */
export const KIOSK_HIDE = [
  'desktop',
  'settings',
  'themeSwitcher',
  'catalog',
  'account',
  'quit',
] as const;
export type KioskHide = (typeof KIOSK_HIDE)[number];

/** A kiosk PIN: 4–8 digits (D54). */
export const KioskPinSchema = z.string().regex(/^\d{4,8}$/);

export const KioskStateSchema = z.object({
  enabled: z.boolean(),
  /** Locked at every start; unlocked with the PIN until restart or Lock now. */
  locked: z.boolean(),
  hide: z.array(z.enum(KIOSK_HIDE)),
  /** After 5 wrong PINs: how long until the next try is accepted (0 = now). */
  retryAfterMs: z.number().int().min(0),
});
export type KioskState = z.output<typeof KioskStateSchema>;

export const KioskUnlockResultSchema = z.discriminatedUnion('ok', [
  z.object({ ok: z.literal(true) }),
  z.object({ ok: z.literal(false), retryAfterMs: z.number().int().min(0) }),
]);
export type KioskUnlockResult = z.output<typeof KioskUnlockResultSchema>;

/** Kiosk channels (FR-SET-6, US-D4, D54). */
export const kioskContract = {
  'kiosk.state': { input: z.void(), output: KioskStateSchema },
  'kiosk.unlock': {
    input: z.strictObject({ pin: z.string().max(16) }),
    output: KioskUnlockResultSchema,
  },
  /** Lock now. */
  'kiosk.lock': { input: z.void(), output: KioskStateSchema },
  /**
   * Settings → Kiosk (unlocked only): turns kiosk on or off and picks what it hides. Turning it
   * on needs `pin` unless one is already set; `pin` also changes it.
   */
  'kiosk.configure': {
    input: z.strictObject({
      enabled: z.boolean(),
      pin: KioskPinSchema.optional(),
      hide: z.array(z.enum(KIOSK_HIDE)).max(KIOSK_HIDE.length),
    }),
    output: KioskStateSchema,
  },
} as const;

export const kioskEvents = {
  'kiosk.changed': KioskStateSchema,
} as const;
