import { X } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useIpcEvent } from '../../events.ts';

/**
 * Games the lapse rule removed (D43): announced above the taskbar whatever is open, since the
 * sync runs at boot and hourly, usually with the Catalog closed. Dismissable.
 */
export function CatalogRemovedNotice() {
  const { t } = useTranslation();
  const [titles, setTitles] = useState<string[] | null>(null);
  useIpcEvent('catalog.removed', (payload) => {
    setTitles(payload.titles);
  });
  return (
    <div role="status" className="absolute right-2 bottom-full mb-2 max-w-sm">
      {titles && (
        <div className="flex items-start gap-2 rounded-lg bg-[#2a2416] px-3 py-2 text-sm text-amber-100 shadow-xl ring-1 ring-amber-500/30">
          <span className="flex-1">{t('catalog.removed', { titles: titles.join(', ') })}</span>
          <button
            type="button"
            aria-label={t('catalog.dismiss')}
            onClick={() => {
              setTitles(null);
            }}
            className="rounded p-0.5 hover:bg-white/10"
          >
            <X aria-hidden="true" className="h-4 w-4" />
          </button>
        </div>
      )}
    </div>
  );
}
