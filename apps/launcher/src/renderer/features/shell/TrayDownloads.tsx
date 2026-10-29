import { Download } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useCatalogEvents, useDownloads } from '../catalog/catalogApi.ts';
import { useOpenApp } from './useOpenApp.ts';

/**
 * Catalog downloads in the tray (FR-SHELL-4, D47): how many are waiting or running and how far
 * along they are overall; a click opens Catalog → Downloads. Hidden when there are none.
 */
export function TrayDownloads() {
  const { t } = useTranslation();
  useCatalogEvents();
  const openApp = useOpenApp();
  const active = (useDownloads().data ?? []).filter(
    (row) => row.state === 'queued' || row.state === 'downloading' || row.state === 'paused',
  );
  if (active.length === 0) return null;
  const done = active.reduce((sum, row) => sum + row.bytesDone, 0);
  const total = active.reduce((sum, row) => sum + row.bytesTotal, 0);
  const percent = total > 0 ? Math.floor((done / total) * 100) : 0;
  const label = t('catalog.downloads.tray', { count: active.length, percent });
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={() => {
        openApp('catalog', { tab: 'downloads' });
      }}
      className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-sky-200 hover:bg-white/10 focus-visible:ring-2 focus-visible:ring-white focus-visible:outline-none"
    >
      <Download aria-hidden="true" className="h-4 w-4" />
      <span>{percent}%</span>
    </button>
  );
}
