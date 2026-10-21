import type { AppError, ErrorCode } from './errors.ts';

export type Result<T> = { ok: true; value: T } | { ok: false; error: AppError };

/** Wraps a successful value. */
export function ok<T>(value: T): Result<T> {
  return { ok: true, value };
}

/** Builds a failed result; `details` is included only when given. */
export function err(code: ErrorCode, message: string, details?: unknown): Result<never> {
  const error: AppError = details === undefined ? { code, message } : { code, message, details };
  return { ok: false, error };
}
