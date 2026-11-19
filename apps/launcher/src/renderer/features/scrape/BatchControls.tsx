import type { BatchStatus } from '@nextlevel/shared';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useOpenApp } from '../shell/useOpenApp.ts';
import { useCancelBatch, usePauseBatch, useResumeBatch, type BatchKind } from './batchApi.ts';

export const BATCH_BUTTON =
  'rounded-md bg-white/5 px-2 py-1 text-[11px] text-slate-300 hover:bg-white/10 hover:text-white disabled:opacity-50 disabled:hover:bg-white/5';

/** A Pause or Cancel main has accepted but not carried out yet (it waits for the current game). */
interface Pending {
  action: 'pause' | 'cancel';
  jobId: number | null;
  state: BatchStatus['state'];
}

/**
 * A batch job's buttons (US-C6), shared by the strip and the details panel (FR-SCR-8): Pause /
 * Cancel while running; Open Settings (credentials, LaunchBox, web tool), Resume and Cancel when
 * paused; Show Needs review when finished with games to review.
 */
export function BatchControls({
  status,
  kind = 'scrape',
  onShowReview,
}: {
  status: BatchStatus;
  kind?: BatchKind;
  onShowReview?: ((systemIds: string[] | null) => void) | undefined;
}) {
  const { t } = useTranslation();
  const openApp = useOpenApp();
  const pause = usePauseBatch(kind);
  const resume = useResumeBatch(kind);
  const cancel = useCancelBatch(kind);
  const texts = kind === 'gemini' ? 'library.geminiBatch' : 'library.batch';
  const [pending, setPending] = useState<Pending | null>(null);
  // Pending until the job changes state (main pauses or cancels after the current game).
  if (pending && (pending.jobId !== status.jobId || pending.state !== status.state)) {
    setPending(null);
  }
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
    return status.review > 0 && onShowReview ? (
      <button
        type="button"
        className={BATCH_BUTTON}
        onClick={() => {
          onShowReview(status.systemIds);
        }}
      >
        {t(`${texts}.showReview`)}
      </button>
    ) : null;
  }
  const cancelButton = (
    <button
      key="cancel"
      type="button"
      className={BATCH_BUTTON}
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
      <>
        {/* NFR-A11Y-1: Pause and Resume share a key, so Resume hands the keyboard to Pause. */}
        <button
          key="primary"
          data-batch-primary=""
          type="button"
          className={BATCH_BUTTON}
          disabled={pending !== null}
          onClick={() => {
            request('pause');
          }}
        >
          {t(pending?.action === 'pause' ? `${texts}.pausing` : `${texts}.pause`)}
        </button>
        {cancelButton}
      </>
    );
  }
  const reason = status.pausedReason ?? 'user';
  return (
    <>
      {(reason === 'credentials' || reason === 'launchbox' || reason === 'webTool') && (
        <button
          key="settings"
          type="button"
          className={BATCH_BUTTON}
          onClick={() => {
            openApp('settings', { section: 'scraper' });
          }}
        >
          {t(`${texts}.openSettings`)}
        </button>
      )}
      <button
        key="primary"
        data-batch-primary=""
        type="button"
        className={BATCH_BUTTON}
        onClick={() => {
          resume.mutate();
        }}
      >
        {t(`${texts}.resume`)}
      </button>
      {cancelButton}
    </>
  );
}
