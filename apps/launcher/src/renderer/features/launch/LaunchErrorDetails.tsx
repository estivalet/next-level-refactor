import { AppErrorException, ERROR_CODES, type AppError } from '@nextlevel/shared';
import { useTranslation } from 'react-i18next';

/** Reasons main puts on launch errors that have their own sentence (errors.launchReason.*). */
const KNOWN_REASONS = new Set([
  'script',
  'emptyArchive',
  'cwdMissing',
  'ENOENT',
  'EACCES',
  'EPERM',
]);

/** The launch error behind a failed IPC call or a Test launch result, if it came from main. */
export function launchAppError(error: unknown): AppError | null {
  return error instanceof AppErrorException ? error.error : null;
}

function text(details: unknown, key: 'path' | 'reason'): string | undefined {
  if (typeof details !== 'object' || details === null) return undefined;
  const value = (details as Record<string, unknown>)[key];
  return typeof value === 'string' && value ? value : undefined;
}

/** A launch error's message, why it happened and the path involved (US-C2: errors say what to fix). */
export function LaunchErrorDetails({ error }: { error: AppError | null }) {
  const { t } = useTranslation();
  const message =
    error && error.code in ERROR_CODES
      ? ERROR_CODES[error.code as keyof typeof ERROR_CODES]
      : 'errors.internal';
  const reason = text(error?.details, 'reason');
  const path = text(error?.details, 'path');
  return (
    <div className="flex flex-col gap-0.5 text-xs text-red-300">
      <p>{t(message)}</p>
      {reason && (
        <p>
          {KNOWN_REASONS.has(reason)
            ? t(`errors.launchReason.${reason}`)
            : t('errors.launchReason.other', { reason })}
        </p>
      )}
      {path && (
        <p className="flex gap-1">
          <span>{t('errors.pathLabel')}</span>
          <code className="break-all text-red-200">{path}</code>
        </p>
      )}
    </div>
  );
}
