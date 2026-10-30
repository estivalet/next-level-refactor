import type { DownloadSummary } from '@nextlevel/shared';
import type { TFunction } from 'i18next';
import { useTranslation } from 'react-i18next';
import { useDownloadAction, useDownloads } from './catalogApi.ts';
import { actionErrorKey, formatBytes, percentOf } from './catalogText.ts';

const BUTTON =
  'rounded-lg bg-white/10 px-3 py-1 text-xs font-medium text-white hover:bg-white/20 focus-visible:ring-2 focus-visible:ring-white focus-visible:outline-none disabled:opacity-50';

function stateLine(t: TFunction, row: DownloadSummary): string {
  if (row.state === 'paused') return t(`catalog.downloads.paused.${row.pausedReason ?? 'user'}`);
  if (row.state === 'failed') return t(`catalog.downloads.failed.${row.error ?? 'network'}`);
  return t(`catalog.downloads.${row.state}`, { percent: percentOf(row) });
}

/** Catalog → Downloads (FR-CAT-4, D47): the queue with progress, pause, resume, retry, cancel. */
export function DownloadsTab() {
  const { t, i18n } = useTranslation();
  const downloads = useDownloads();
  const act = useDownloadAction();
  const rows = downloads.data ?? [];
  const run = (downloadId: string, action: 'pause' | 'resume' | 'cancel') => {
    act.mutate({ downloadId, action });
  };
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-4">
      {act.error && (
        <p role="alert" className="text-xs text-[#ff8a80]">
          {t(actionErrorKey(act.error))}
        </p>
      )}
      {downloads.isSuccess && rows.length === 0 && (
        <p className="text-sm text-slate-400">{t('catalog.downloads.empty')}</p>
      )}
      <ul aria-label={t('catalog.downloads.title')} className="flex flex-col gap-2">
        {rows.map((row) => (
          <li key={row.id} className="flex flex-col gap-2 rounded-lg border border-white/10 p-3">
            <div className="flex items-center gap-3">
              <span className="min-w-0 flex-1 truncate text-sm text-white">{row.title}</span>
              {(row.state === 'downloading' || row.state === 'queued') && (
                <button
                  type="button"
                  className={BUTTON}
                  onClick={() => {
                    run(row.id, 'pause');
                  }}
                >
                  {t('catalog.downloads.pause')}
                </button>
              )}
              {(row.state === 'paused' || row.state === 'failed') && (
                <button
                  type="button"
                  className={BUTTON}
                  onClick={() => {
                    run(row.id, 'resume');
                  }}
                >
                  {t(
                    row.state === 'failed' ? 'catalog.downloads.retry' : 'catalog.downloads.resume',
                  )}
                </button>
              )}
              <button
                type="button"
                className={BUTTON}
                aria-label={t('catalog.downloads.cancelLabel', { title: row.title })}
                onClick={() => {
                  run(row.id, 'cancel');
                }}
              >
                {t('catalog.downloads.cancel')}
              </button>
            </div>
            <progress
              aria-label={t('catalog.downloads.progress', { title: row.title })}
              value={row.bytesDone}
              max={Math.max(row.bytesTotal, 1)}
              className="h-1.5 w-full"
            />
            <span
              className={`text-xs ${row.state === 'failed' ? 'text-[#ff8a80]' : 'text-slate-400'}`}
            >
              {stateLine(t, row)} · {formatBytes(row.bytesDone, i18n.language)} /{' '}
              {formatBytes(row.bytesTotal, i18n.language)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
