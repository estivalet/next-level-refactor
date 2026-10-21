import { FolderOpen, ScanSearch, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import {
  errorCode,
  errorMessageKey,
  useOpenPath,
  useSystemCatalog,
} from '../settings/settingsApi.ts';
import { useLibraryEvents, useSystemSummaries } from './libraryApi.ts';
import { summaryLine } from './scanSummary.ts';
import { ScanResults } from './ScanResults.tsx';
import { useCancelScan, useScanStatus, useStartScan } from './scanApi.ts';

const BUTTON =
  'flex w-fit items-center gap-2 rounded-lg bg-white/10 px-3 py-1.5 text-xs font-medium text-white hover:bg-white/20 focus-visible:ring-2 focus-visible:ring-white focus-visible:outline-none disabled:opacity-40';

/**
 * Settings → Storage scan (S9, FR-LIB-3): start, progress with cancel, and the last result.
 * Scans use the saved settings, so unsaved storage changes must be saved first.
 */
export function ScanPanel({ dirty, hasLocations }: { dirty: boolean; hasLocations: boolean }) {
  const { t } = useTranslation();
  const status = useScanStatus();
  const start = useStartScan();
  const cancel = useCancelScan();
  const openPath = useOpenPath();
  const catalog = useSystemCatalog();
  // Totals per system, so systems still missing games from earlier scans show them (FR-LIB-4).
  useLibraryEvents();
  const summaries = useSystemSummaries();
  const missingOf = (id: string, fallback: number) =>
    summaries.data?.find((system) => system.id === id)?.missing ?? fallback;
  const nameOf = (id: string) => catalog.data?.find((system) => system.id === id)?.name ?? id;

  if (errorCode(status.error) === 'LIBRARY_UNAVAILABLE') {
    return (
      <section className="flex flex-col gap-2 border-t border-white/10 pt-4">
        <p className="text-sm text-[#ff8a80]">{t('errors.libraryUnavailable')}</p>
        <button
          type="button"
          className={BUTTON}
          onClick={() => {
            openPath.mutate('data');
          }}
        >
          <FolderOpen aria-hidden="true" className="h-4 w-4" />
          {t('settings.storage.scan.openData')}
        </button>
      </section>
    );
  }

  const progress = status.data?.running ? status.data.progress : null;
  const last = status.data?.last ?? null;
  const hint = dirty
    ? t('settings.storage.scan.saveFirst')
    : hasLocations
      ? null
      : t('settings.storage.scan.noLocations');

  return (
    <section
      aria-labelledby="scan-heading"
      className="flex flex-col gap-3 border-t border-white/10 pt-4"
    >
      <h3 id="scan-heading" className="text-sm font-medium text-white">
        {t('settings.storage.scan.title')}
      </h3>
      <p className="text-xs text-slate-300">{t('settings.storage.scan.intro')}</p>
      {progress ? (
        <div className="flex flex-col gap-2">
          <progress
            aria-label={t('settings.storage.scan.progress')}
            value={progress.systemsDone}
            max={Math.max(progress.systemsTotal, 1)}
            aria-valuenow={progress.systemsDone}
            aria-valuemax={progress.systemsTotal}
            className="h-2 w-full accent-[#990033]"
          />
          <p className="text-xs text-slate-300">
            {progress.systemId
              ? t('settings.storage.scan.scanning', {
                  system: nameOf(progress.systemId),
                  count: progress.filesSeen,
                })
              : t('settings.storage.scan.starting')}
          </p>
          <button
            type="button"
            className={BUTTON}
            onClick={() => {
              cancel.mutate();
            }}
          >
            <X aria-hidden="true" className="h-4 w-4" />
            {t('settings.storage.scan.cancel')}
          </button>
        </div>
      ) : (
        <>
          <button
            type="button"
            className={BUTTON}
            disabled={hint !== null || start.isPending}
            onClick={() => {
              start.mutate();
            }}
          >
            <ScanSearch aria-hidden="true" className="h-4 w-4" />
            {t('settings.storage.scan.start')}
          </button>
          {hint && <p className="text-xs text-slate-400">{hint}</p>}
          {start.isError && (
            <p role="alert" className="text-xs text-[#ff8a80]">
              {t(errorMessageKey(start.error))}
            </p>
          )}
        </>
      )}
      {last && (
        <div className="flex flex-col gap-2" role="status">
          {last.outcome !== 'completed' && (
            <p className="text-xs text-[#ffcc80]">{t(`settings.storage.scan.${last.outcome}`)}</p>
          )}
          <p className="text-xs text-white">{summaryLine(t, last)}</p>
          <ScanResults
            results={last.systems.filter(
              (system) => system.present + missingOf(system.systemId, system.missing) > 0,
            )}
            nameOf={nameOf}
            missingOf={missingOf}
          />
        </div>
      )}
    </section>
  );
}
