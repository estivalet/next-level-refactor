import { Loader2, ScanSearch } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useScanStatus, useStartScan } from '../../library/scanApi.ts';
import { summaryLine } from '../../library/scanSummary.ts';
import { errorMessageKey } from '../settingsApi.ts';

/**
 * Settings → Systems → system editor: scans just this system (FR-LIB-3), shipped or custom, so a
 * system added or fixed here doesn't need a full scan. Scans read the saved settings, so unsaved
 * changes must be saved first. A scan of given ids walks them even when switched off.
 */
export function ScanSystemButton({
  systemId,
  name,
  unsaved,
  hasLocations,
}: {
  systemId: string;
  name: string;
  unsaved: boolean;
  /** The saved settings have a storage location. */
  hasLocations: boolean;
}) {
  const { t } = useTranslation();
  const status = useScanStatus();
  const start = useStartScan();
  // The scan this button started: only its result is shown here.
  const [scanId, setScanId] = useState<string | null>(null);
  const running = status.data?.running === true;
  const progress = running ? status.data?.progress : null;
  const last = status.data?.last ?? null;
  const hint = unsaved
    ? t('settings.storage.scan.saveFirst')
    : hasLocations
      ? null
      : t('settings.storage.scan.noLocations');

  return (
    <div className="flex flex-col gap-1">
      <button
        type="button"
        disabled={hint !== null || running || start.isPending}
        onClick={() => {
          start.mutate([systemId], {
            onSuccess: (started) => {
              setScanId(started.progress?.scanId ?? started.last?.scanId ?? null);
            },
          });
        }}
        className="flex w-fit items-center gap-2 rounded-lg bg-white/10 px-3 py-1.5 text-xs font-medium text-white hover:bg-white/20 focus-visible:ring-2 focus-visible:ring-white focus-visible:outline-none disabled:opacity-40"
      >
        {running ? (
          <Loader2 aria-hidden="true" className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <ScanSearch aria-hidden="true" className="h-3.5 w-3.5" />
        )}
        {t('library.scan.system', { system: name })}
      </button>
      {hint && <p className="text-xs text-slate-400">{hint}</p>}
      {progress && (
        <p role="status" className="text-xs text-slate-300">
          {progress.systemId
            ? t('settings.storage.scan.scanning', {
                system: progress.systemId === systemId ? name : progress.systemId,
                count: progress.filesSeen,
              })
            : t('settings.storage.scan.starting')}
        </p>
      )}
      {!running && last && last.scanId === scanId && (
        <p role="status" className="text-xs text-white">
          {last.outcome === 'completed'
            ? summaryLine(t, last)
            : t(`settings.storage.scan.${last.outcome}`)}
        </p>
      )}
      {start.isError && (
        <p role="alert" className="text-xs text-[#ff8a80]">
          {t(errorMessageKey(start.error))}
        </p>
      )}
    </div>
  );
}
