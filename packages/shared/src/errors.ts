import { z } from 'zod';

/** Every error code the app can return, mapped to its user-facing i18n message key. */
export const ERROR_CODES = {
  VALIDATION_FAILED: 'errors.validationFailed',
  INTERNAL: 'errors.internal',
  CONFLICT: 'errors.conflict',
  NOT_FOUND: 'errors.notFound',
  INVALID_SETTINGS: 'errors.invalidSettings',
  LIBRARY_UNAVAILABLE: 'errors.libraryUnavailable',
  NAME_TAKEN: 'errors.nameTaken',
  NO_PROFILE: 'errors.noProfile',
  EMULATOR_MISSING: 'errors.emulatorMissing',
  ROM_MISSING: 'errors.romMissing',
  CORE_MISSING: 'errors.coreMissing',
  LAUNCH_FAILED: 'errors.launchFailed',
  ALREADY_RUNNING: 'errors.alreadyRunning',
  BUSY: 'errors.busy',
  SCRAPER_CREDENTIALS: 'errors.scraperCredentials',
  SCRAPER_QUOTA: 'errors.scraperQuota',
  SCRAPER_UNAVAILABLE: 'errors.scraperUnavailable',
  SCRAPER_NETWORK: 'errors.scraperNetwork',
  NO_SCRAPER_SYSTEM: 'errors.noScraperSystem',
  NO_CREDENTIALS: 'errors.noCredentials',
  SECRETS_UNAVAILABLE: 'errors.secretsUnavailable',
  UNAUTHENTICATED: 'errors.unauthenticated',
  FORBIDDEN: 'errors.forbidden',
  SUBSCRIPTION_REQUIRED: 'errors.subscriptionRequired',
  SUSPENDED: 'errors.suspended',
  DEVICE_LIMIT: 'errors.deviceLimit',
  NOT_ALLOWED: 'errors.notAllowed',
  RATE_LIMITED: 'errors.rateLimited',
  API_UNREACHABLE: 'errors.apiUnreachable',
  BILLING_UNAVAILABLE: 'errors.billingUnavailable',
  /** A catalog download failed; `details.reason` is a DownloadFailure. */
  DOWNLOAD_FAILED: 'errors.downloadFailed',
} as const;

export type ErrorCode = keyof typeof ERROR_CODES;

const errorCodeValues = Object.keys(ERROR_CODES) as [ErrorCode, ...ErrorCode[]];

/** An expected failure as it crosses a boundary: stable code, user-facing message, optional details. */
export const AppErrorSchema = z.object({
  code: z.enum(errorCodeValues),
  message: z.string(),
  details: z.unknown().optional(),
});

export type AppError = z.infer<typeof AppErrorSchema>;

/** Carries an AppError through code that throws (main handlers, renderer mutations). */
export class AppErrorException extends Error {
  readonly error: AppError;

  constructor(error: AppError) {
    super(error.code);
    this.name = 'AppErrorException';
    this.error = error;
  }
}
