import { z } from 'zod';

// Service-wide settings kept in the API's `app_settings` table (FR-ADM-4, D22, D28).

/** Trimmed and lowercased, so allow-list checks ignore case. */
export const EmailSchema = z.preprocess(
  (value) => (typeof value === 'string' ? value.trim().toLowerCase() : value),
  z.email().max(254),
);

const allowList = z
  .array(EmailSchema)
  .max(1000)
  .transform((emails) => [...new Set(emails)]);

/** An empty or blank banner is no banner. */
const banner = z.preprocess(
  (value) => (typeof value === 'string' && value.trim() === '' ? null : value),
  z.string().trim().max(280).nullable(),
);

export const SIGN_UP_MODES = ['open', 'allowList', 'closed'] as const;

export const AppSettingsSchema = z.strictObject({
  /** Days the launcher may run offline after its last entitlement check (FR-AUTH-5). */
  graceDays: z.number().int().min(1).max(90),
  /** Who may sign in: anyone, `ADMIN_EMAILS` + the allow-list, or existing users only. */
  signUpMode: z.enum(SIGN_UP_MODES),
  allowList,
  banner,
});

export const AppSettingsPatchSchema = AppSettingsSchema.partial();

/**
 * The same settings as a response: plain types without the input normalizing (Zod can't encode
 * through transforms, and the API's serializer encodes responses).
 */
export const AppSettingsViewSchema = z.object({
  graceDays: z.number().int(),
  signUpMode: z.enum(SIGN_UP_MODES),
  allowList: z.array(z.string()),
  banner: z.string().nullable(),
});

export function defaultAppSettings(): AppSettings {
  return { graceDays: 14, signUpMode: 'allowList', allowList: [], banner: null };
}

export type AppSettings = z.output<typeof AppSettingsSchema>;
export type AppSettingsPatch = z.output<typeof AppSettingsPatchSchema>;
export type SignUpMode = (typeof SIGN_UP_MODES)[number];
