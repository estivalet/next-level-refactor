import { IDLE_BATCH } from '@nextlevel/shared';
import { X } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useBatchDetails, useBatchStatus } from '../batchApi.ts';
import { BATCH_BUTTON, BatchControls } from '../BatchControls.tsx';
import { shortDateTime, useBatchLine } from '../batchText.ts';
import { BatchItemList } from './BatchItemList.tsx';
import { BatchRulesSummary } from './BatchRulesSummary.tsx';

const REFRESH_MS = 1000;

/**
 * The scrape job's details (FR-SCR-8, US-C8): a drawer on the right of the Library with its scope,
 * state and start time, progress by outcome, the game being scraped, its controls, the rules it
 * was started with and every game it handled. It follows the job live; Esc or ✕ closes it.
 */
export function BatchDetailsPanel({
  onClose,
  onShowReview,
  onOpenGame,
}: {
  onClose: () => void;
  onShowReview?: ((systemIds: string[] | null) => void) | undefined;
  onOpenGame: (game: { gameId: number; title: string }) => void;
}) {
  const { t, i18n } = useTranslation();
  const statusQuery = useBatchStatus();
  const status = statusQuery.data;
  const details = useBatchDetails(status?.jobId ?? null);
  const close = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    close.current?.focus();
  }, []);
  // FR-SCR-8: follow the job, at most once a second, only when a game was handled, so an open
  // panel never floods main while it scrapes (spec anti-goal).
  const client = useQueryClient();
  const refresh = useRef<ReturnType<typeof setTimeout> | null>(null);
  const done = status?.done;
  useEffect(() => {
    if (done === undefined || refresh.current) return;
    refresh.current = setTimeout(() => {
      refresh.current = null;
      void client.invalidateQueries({ queryKey: ['scraper.batch.details'] });
      void client.invalidateQueries({ queryKey: ['scraper.batch.items'] });
    }, REFRESH_MS);
  }, [done, client]);
  useEffect(
    () => () => {
      if (refresh.current) clearTimeout(refresh.current);
    },
    [],
  );
  const { line, scope } = useBatchLine(status ?? IDLE_BATCH);
  if (!status || status.state === 'idle' || status.jobId === null) return null;

  const at = (iso: string) => shortDateTime(iso, i18n.language);
  const stateText = status.state === 'paused' ? line : t(`library.batch.details.${status.state}`);
  const when = [
    stateText,
    status.startedAt ? t('library.batch.details.started', { date: at(status.startedAt) }) : null,
    status.resumedAt ? t('library.batch.details.resumedAt', { date: at(status.resumedAt) }) : null,
  ].filter(Boolean);
  const skipped = Math.max(
    0,
    status.done - status.applied - status.review - status.notFound - status.failed,
  );
  const counts = [
    t('library.batch.details.applied', { count: status.applied }) +
      (status.launchbox > 0
        ? t('library.batch.details.launchbox', { count: status.launchbox })
        : ''),
    t('library.batch.details.review', { count: status.review }),
    t('library.batch.details.notFound', { count: status.notFound }),
    t('library.batch.details.failed', { count: status.failed }),
    t('library.batch.details.skipped', { count: skipped }),
  ].join(' · ');
  const showReview = onShowReview
    ? (systemIds: string[] | null) => {
        onShowReview(systemIds);
        onClose();
      }
    : undefined;
  // Both from the same snapshot: the live status runs ahead of the details between refreshes.
  const unlisted = details.data ? details.data.listed < details.data.status.done : false;

  return (
    <div
      role="dialog"
      aria-label={t('library.batch.details.title', { scope })}
      className="absolute inset-y-0 right-0 z-40 flex w-96 max-w-full flex-col gap-3 border-l border-white/10 bg-[#111115] p-4 text-slate-300 shadow-2xl"
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          event.stopPropagation();
          onClose();
        }
      }}
    >
      <div className="flex items-start justify-between gap-2">
        <h2 className="text-sm font-medium text-white">
          {t('library.batch.details.title', { scope })}
        </h2>
        <button
          ref={close}
          type="button"
          aria-label={t('library.batch.details.close')}
          className="rounded p-1 text-slate-400 hover:bg-white/10 hover:text-white"
          onClick={onClose}
        >
          <X aria-hidden="true" className="h-4 w-4" />
        </button>
      </div>
      <p className="text-[11px] text-slate-400">{when.join(' · ')}</p>
      <progress
        aria-label={t('library.batch.details.progress')}
        value={Math.min(status.done, status.total)}
        max={Math.max(status.total, 1)}
        aria-valuenow={Math.min(status.done, status.total)}
        aria-valuemax={status.total}
        className="h-2 w-full accent-emerald-500"
      />
      <p className="text-[11px] text-slate-300">{counts}</p>
      {status.state === 'running' && status.current && (
        <p className="truncate text-[11px] text-slate-400">
          {t('library.batch.details.now', { title: status.current.title })}
        </p>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <BatchControls status={status} onShowReview={showReview} />
        {status.state !== 'finished' && status.review > 0 && showReview && (
          <button
            type="button"
            className={BATCH_BUTTON}
            onClick={() => {
              showReview(status.systemIds);
            }}
          >
            {t('library.batch.showReview')}
          </button>
        )}
      </div>
      {details.data && <BatchRulesSummary rules={details.data.rules} />}
      {unlisted && (
        <p className="text-[11px] text-slate-500">{t('library.batch.details.notListed')}</p>
      )}
      <BatchItemList
        jobId={status.jobId}
        onOpenGame={(game) => {
          onOpenGame(game);
          onClose();
        }}
      />
    </div>
  );
}
