import { z } from 'zod';

/** Every error code the app can return, mapped to its user-facing i18n message key. */
export const ERROR_CODES = {
  VALIDATION_FAILED: 'errors.validationFailed',
  INTERNAL: 'errors.internal',
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
