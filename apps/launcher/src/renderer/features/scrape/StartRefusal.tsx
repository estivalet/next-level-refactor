import { AppErrorException } from '@nextlevel/shared';
import { useTranslation } from 'react-i18next';
import { errorMessageKey, useSystemCatalog } from '../settings/settingsApi.ts';
import { useOpenApp } from '../shell/useOpenApp.ts';

const ids = (details: unknown, key: string): string[] => {
  const value = (details as Record<string, unknown> | undefined)?.[key];
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string') : [];
};

/**
 * Why main refused to start a batch (US-C6): another job (cancel it first), systems without a
 * ScreenScraper id (named, with Open Settings on Systems), or the generic message.
 */
export function StartRefusal({ error }: { error: unknown }) {
  const { t } = useTranslation();
  const openApp = useOpenApp();
  const catalog = useSystemCatalog();
  const app = error instanceof AppErrorException ? error.error : null;
  const unmapped = app?.code === 'NO_SCRAPER_SYSTEM' ? ids(app.details, 'systemIds') : [];
  const first = unmapped[0];
  let text = t(errorMessageKey(error));
  if (app?.code === 'BUSY' && (app.details as { batch?: boolean } | undefined)?.batch) {
    text = t('library.batch.busy');
  } else if (first !== undefined) {
    const name = (id: string) => catalog.data?.find((s) => s.id === id)?.name ?? id;
    text = t('library.batch.noSystem', { systems: unmapped.map(name).join(', ') });
  }
  return (
    <div role="alert" className="flex flex-col items-start gap-2 text-xs text-red-300">
      <p>{text}</p>
      {first !== undefined && (
        <button
          type="button"
          className="rounded-md bg-white/5 px-2 py-1 text-[11px] text-slate-300 hover:bg-white/10 hover:text-white"
          onClick={() => {
            openApp('settings', { section: 'systems', focusId: first });
          }}
        >
          {t('library.batch.openSettings')}
        </button>
      )}
    </div>
  );
}
