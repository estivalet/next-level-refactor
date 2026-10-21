import { FolderOpen, Library, ScanSearch } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useStartScan } from './scanApi.ts';
import { useOpenPath } from '../settings/settingsApi.ts';

const BUTTON =
  'flex items-center gap-2 rounded-xl bg-emerald-500 px-5 py-2 text-sm font-semibold text-black shadow-lg shadow-emerald-500/20 hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-40';

/** No game in any system yet: point at storage and offer a scan (S7 empty state). */
export function LibraryEmpty() {
  const { t } = useTranslation();
  const start = useStartScan();
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 p-8 text-center text-slate-400">
      <Library aria-hidden="true" className="h-12 w-12 text-emerald-400/30" />
      <h2 className="text-base font-semibold text-white">{t('library.empty.title')}</h2>
      <p className="max-w-sm text-sm">{t('library.empty.hint')}</p>
      <button
        type="button"
        className={BUTTON}
        disabled={start.isPending}
        onClick={() => {
          start.mutate(undefined);
        }}
      >
        <ScanSearch aria-hidden="true" className="h-4 w-4" />
        {t('library.empty.scan')}
      </button>
    </div>
  );
}

/** `library.db` could not be opened (LIBRARY_UNAVAILABLE): say so and open the data folder. */
export function LibraryUnavailable() {
  const { t } = useTranslation();
  const openPath = useOpenPath();
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 p-8 text-center text-slate-400">
      <p role="alert" className="text-sm text-red-300">
        {t('errors.libraryUnavailable')}
      </p>
      <button
        type="button"
        className="flex items-center gap-2 rounded-lg bg-white/5 px-3 py-1.5 text-xs text-slate-300 hover:bg-white/10 hover:text-white"
        onClick={() => {
          openPath.mutate('data');
        }}
      >
        <FolderOpen aria-hidden="true" className="h-3.5 w-3.5" />
        {t('library.openData')}
      </button>
    </div>
  );
}
