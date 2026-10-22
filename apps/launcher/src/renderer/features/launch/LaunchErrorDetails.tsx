import {
  AppErrorException,
  ERROR_CODES,
  LaunchErrorDetailsSchema,
  type AppError,
  type LaunchErrorDetails as Details,
} from '@nextlevel/shared';
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

/** The launch details of an error; anything unexpected reads as no details. */
export function launchDetails(error: AppError | null): Details {
  const parsed = LaunchErrorDetailsSchema.safeParse(error?.details ?? {});
  return parsed.success ? parsed.data : {};
}

/** A launch error's message, why it happened and the path involved (US-C2: errors say what to fix). */
export function LaunchErrorDetails({ error }: { error: AppError | null }) {
  const { t } = useTranslation();
  const message = error ? ERROR_CODES[error.code] : 'errors.internal';
  const { reason, path } = launchDetails(error);
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
