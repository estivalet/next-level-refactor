import { AppErrorException, ERROR_CODES } from '@nextlevel/shared';

/** The i18n key for a failed console call; the admin guards have their own wording. */
export function errorKey(error: unknown): string {
  if (!(error instanceof AppErrorException)) return 'errors.internal';
  const reason = (error.error.details as { reason?: unknown } | undefined)?.reason;
  if (error.error.code === 'CONFLICT' && reason === 'lastAdmin') return 'admin.user.lastAdmin';
  if (error.error.code === 'CONFLICT' && reason === 'self') return 'admin.user.self';
  return ERROR_CODES[error.error.code];
}

export function formatTime(iso: string | null, language: string, never: string): string {
  if (!iso) return never;
  return new Intl.DateTimeFormat(language, { dateStyle: 'medium', timeStyle: 'short' }).format(
    new Date(iso),
  );
}
