import type { BatchStatus } from '@nextlevel/shared';
import { Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useOpenApp } from '../shell/useOpenApp.ts';
import { useCancelBatch, usePauseBatch, useResumeBatch } from './batchApi.ts';

const BUTTON =
  'rounded-md bg-white/5 px-2 py-1 text-[11px] text-slate-300 hover:bg-white/10 hover:text-white';

/**
 * The batch job in the Library header (S7, US-C6): progress with Pause / Cancel, why it paused
 * (with Resume, or Open Settings for credentials), or the finished summary.
 */
export function BatchProgress({
  status,
  onShowReview,
}: {
  status: BatchStatus;
  onShowReview?: () => void;
}) {
  const { t, i18n } = useTranslation();
  const openApp = useOpenApp();
  const pause = usePauseBatch();
  const resume = useResumeBatch();
  const cancel = useCancelBatch();
  const counts = { done: status.done, total: status.total, applied: status.applied };

  if (status.state === 'idle') return null;
  if (status.state === 'finished') {
    return (
      <div className="flex items-center gap-2">
        <p role="status" className="max-w-md text-[11px] text-slate-500">
          {t('library.batch.finished', { ...status })}
        </p>
        {status.review > 0 && onShowReview && (
          <button type="button" className={BUTTON} onClick={onShowReview}>
            {t('library.batch.showReview')}
          </button>
        )}
      </div>
    );
  }
  const cancelButton = (
    <button
      type="button"
      className={BUTTON}
      onClick={() => {
        cancel.mutate();
      }}
    >
      {t('library.batch.cancel')}
    </button>
  );
  if (status.state === 'running') {
    return (
      <div className="flex items-center gap-2">
        <Loader2 aria-hidden="true" className="h-3.5 w-3.5 animate-spin text-emerald-400" />
        <p role="status" className="max-w-md text-[11px] text-slate-400">
          {t('library.batch.running', { ...counts, review: status.review })}
        </p>
        <button
          type="button"
          className={BUTTON}
          onClick={() => {
            pause.mutate();
          }}
        >
          {t('library.batch.pause')}
        </button>
        {cancelButton}
      </div>
    );
  }
  const reason = status.pausedReason ?? 'user';
  const time = status.resumeAt
    ? new Date(status.resumeAt).toLocaleTimeString(i18n.language, {
        hour: '2-digit',
        minute: '2-digit',
      })
    : '';
  return (
    <div className="flex items-center gap-2">
      <p role="status" className="max-w-md text-[11px] text-amber-200">
        {t(`library.batch.paused.${reason}`, { ...counts, time })}
      </p>
      {reason === 'credentials' && (
        <button
          type="button"
          className={BUTTON}
          onClick={() => {
            openApp('settings', { section: 'scraper' });
          }}
        >
          {t('library.batch.openSettings')}
        </button>
      )}
      <button
        type="button"
        className={BUTTON}
        onClick={() => {
          resume.mutate();
        }}
      >
        {t('library.batch.resume')}
      </button>
      {cancelButton}
    </div>
  );
}
