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
