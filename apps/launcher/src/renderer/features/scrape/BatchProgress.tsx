import type { BatchStatus } from '@nextlevel/shared';
import { Loader2 } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useSystemCatalog } from '../settings/settingsApi.ts';
import { useOpenApp } from '../shell/useOpenApp.ts';
import { useCancelBatch, usePauseBatch, useResumeBatch, type BatchKind } from './batchApi.ts';
import { scopeLabel } from './batchScope.ts';

const BUTTON =
  'rounded-md bg-white/5 px-2 py-1 text-[11px] text-slate-300 hover:bg-white/10 hover:text-white disabled:opacity-50 disabled:hover:bg-white/5';

/** Jobs whose "Resumed" note was seen this session (US-C8): shown until the details open. */
const resumedSeen = new Set<number>();

/** A Pause or Cancel main has accepted but not carried out yet (it waits for the current game). */
interface Pending {
  action: 'pause' | 'cancel';
  jobId: number | null;
  state: BatchStatus['state'];
}

/**
 * The batch job in the Library header (S7, US-C6): progress with Pause / Cancel, why it paused
 * (with Resume, or Open Settings for credentials), or the finished summary.
 */
export function BatchProgress({
  status,
  onShowReview,
  onOpenDetails,
  kind = 'scrape',
}: {
  status: BatchStatus;
  /** FR-SCR-8: the status text opens the job's details panel. */
  onOpenDetails?: () => void;
  /** FR-SCR-7: the Gemini batch has its own texts and controls. */
  kind?: BatchKind;
  /** Gets the job's systems (null for a selection batch). */
  onShowReview?: (systemIds: string[] | null) => void;
}) {
  const { t, i18n } = useTranslation();
  const openApp = useOpenApp();
  const pause = usePauseBatch(kind);
  const resume = useResumeBatch(kind);
  const cancel = useCancelBatch(kind);
  const texts = kind === 'gemini' ? 'library.geminiBatch' : 'library.batch';
  const [pending, setPending] = useState<Pending | null>(null);
  const catalog = useSystemCatalog();
  const nameOf = (id: string) => catalog.data?.find((system) => system.id === id)?.name ?? id;
  const [, setSeen] = useState(0);
  // Pending until the job changes state (main pauses or cancels after the current game).
  if (pending && (pending.jobId !== status.jobId || pending.state !== status.state)) {
    setPending(null);
  }
  const done = Math.min(status.done, status.total);
  const counts = {
    done,
    total: status.total,
    applied: status.applied,
    scope: scopeLabel(status.systemIds, nameOf, t),
  };
  const resumed =
    status.jobId !== null && status.resumedAt && status.startedAt && !resumedSeen.has(status.jobId)
      ? t('library.batch.resumed', {
          date: new Date(status.startedAt).toLocaleString(i18n.language, {
            day: 'numeric',
            month: 'short',
            hour: '2-digit',
            minute: '2-digit',
          }),
        })
      : null;
  const openDetails = onOpenDetails
    ? () => {
        if (status.jobId !== null) resumedSeen.add(status.jobId);
        setSeen((n) => n + 1);
        onOpenDetails();
      }
    : null;
  /** The status line; a button that opens the details when the panel is offered (US-C8). */
  const statusText = (className: string, text: ReactNode) => (
    <p role="status" className={className}>
      {openDetails ? (
        <button
          type="button"
          title={t('library.batch.openDetails')}
          className="text-left hover:text-white hover:underline"
          onClick={openDetails}
        >
          {text}
          <span className="sr-only"> · {t('library.batch.openDetails')}</span>
        </button>
      ) : (
        text
      )}
    </p>
  );
  // FR-SCR-6: "… · 2 from LaunchBox" once LaunchBox filled any game.
  const fromLaunchBox =
    status.launchbox > 0 ? t('library.batch.fromLaunchBox', { count: status.launchbox }) : '';
  const request = (action: Pending['action']) => {
    setPending({ action, jobId: status.jobId, state: status.state });
    (action === 'pause' ? pause : cancel).mutate(undefined, {
      onError: () => {
        setPending(null);
      },
    });
  };

  if (status.state === 'idle') return null;
  if (status.state === 'finished') {
    return (
      <div className="flex items-center gap-2">
        {statusText(
          'max-w-md text-[11px] text-slate-500',
          <>
            {t(`${texts}.finished`, { ...status, count: done })}
            {fromLaunchBox}
          </>,
        )}
        {status.review > 0 && onShowReview && (
          <button
            type="button"
            className={BUTTON}
            onClick={() => {
              onShowReview(status.systemIds);
            }}
          >
            {t(`${texts}.showReview`)}
          </button>
        )}
      </div>
    );
  }
  const cancelButton = (
    <button
      type="button"
      className={BUTTON}
      disabled={pending !== null}
      onClick={() => {
        request('cancel');
      }}
    >
      {t(pending?.action === 'cancel' ? `${texts}.cancelling` : `${texts}.cancel`)}
    </button>
  );
  if (status.state === 'running') {
    return (
      <div className="flex items-center gap-2">
        <Loader2 aria-hidden="true" className="h-3.5 w-3.5 animate-spin text-emerald-400" />
        {resumed && <p className="text-[11px] text-sky-300">{resumed}</p>}
        {statusText(
          'max-w-md text-[11px] text-slate-400',
          <>
            {t(`${texts}.running`, { ...counts, review: status.review })}
            {fromLaunchBox}
          </>,
        )}
        <button
          type="button"
          className={BUTTON}
          disabled={pending !== null}
          onClick={() => {
            request('pause');
          }}
        >
          {t(pending?.action === 'pause' ? `${texts}.pausing` : `${texts}.pause`)}
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
      {resumed && <p className="text-[11px] text-sky-300">{resumed}</p>}
      {statusText(
        'max-w-md text-[11px] text-amber-200',
        t(`${texts}.paused.${reason}`, { ...counts, time }),
      )}
      {(reason === 'credentials' || reason === 'launchbox' || reason === 'webTool') && (
        <button
          type="button"
          className={BUTTON}
          onClick={() => {
            openApp('settings', { section: 'scraper' });
          }}
        >
          {t(`${texts}.openSettings`)}
        </button>
      )}
      <button
        type="button"
        className={BUTTON}
        onClick={() => {
          resume.mutate();
        }}
      >
        {t(`${texts}.resume`)}
      </button>
      {cancelButton}
    </div>
  );
}
