import type { BatchStatus } from '@nextlevel/shared';
import { Loader2 } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { BatchKind } from './batchApi.ts';
import { BatchControls } from './BatchControls.tsx';
import { shortDateTime, useBatchLine } from './batchText.ts';

/** Jobs whose "Resumed" note was seen this session (US-C8): shown until the details open. */
const resumedSeen = new Set<number>();

const LINE_CLASS: Record<BatchStatus['state'], string> = {
  idle: '',
  running: 'max-w-md text-[11px] text-slate-400',
  paused: 'max-w-md text-[11px] text-amber-200',
  finished: 'max-w-md text-[11px] text-slate-500',
};

/**
 * The batch job in the Library header (S7, US-C6): progress with Pause / Cancel, why it paused
 * (with Resume, or Open Settings for credentials), or the finished summary. With `onOpenDetails`
 * the line is a button that opens the job's details (FR-SCR-8), and a job picked up from the last
 * session says "Resumed · started …" until then (US-C8).
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
  const { line } = useBatchLine(status, kind);
  const [, setSeen] = useState(0);
  if (status.state === 'idle') return null;

  const resumed =
    status.state !== 'finished' &&
    status.jobId !== null &&
    status.resumedAt &&
    status.startedAt &&
    !resumedSeen.has(status.jobId)
      ? t('library.batch.resumed', { date: shortDateTime(status.startedAt, i18n.language) })
      : null;
  const openDetails = onOpenDetails
    ? () => {
        if (status.jobId !== null) resumedSeen.add(status.jobId);
        setSeen((n) => n + 1);
        onOpenDetails();
      }
    : null;

  return (
    <div className="flex items-center gap-2">
      {status.state === 'running' && (
        <Loader2 aria-hidden="true" className="h-3.5 w-3.5 animate-spin text-emerald-400" />
      )}
      {resumed && <p className="text-[11px] text-sky-300">{resumed}</p>}
      <p role="status" className={LINE_CLASS[status.state]}>
        {openDetails ? (
          <button
            type="button"
            title={t('library.batch.openDetails')}
            className="text-left hover:text-white hover:underline"
            onClick={openDetails}
          >
            {line}
            <span className="sr-only"> · {t('library.batch.openDetails')}</span>
          </button>
        ) : (
          line
        )}
      </p>
      <BatchControls status={status} kind={kind} onShowReview={onShowReview} />
    </div>
  );
}
