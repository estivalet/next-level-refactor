import { useTranslation } from 'react-i18next';
import { errorMessageKey } from '../settingsApi.ts';
import { useLaunchBoxActions, useLaunchBoxStatus } from './launchboxApi.ts';

const BUTTON =
  'rounded-md bg-white/10 px-3 py-1.5 text-xs text-white hover:bg-white/20 disabled:opacity-40 focus-visible:ring-2 focus-visible:ring-white/70 focus-visible:outline-none';

/**
 * Settings → Scraper → LaunchBox (FR-SCR-6): the free LaunchBox Games Database, downloaded into
 * the data folder and indexed; Download / Refresh, progress with Cancel, its date and size.
 */
export function LaunchBoxPanel() {
  const { t, i18n } = useTranslation();
  const status = useLaunchBoxStatus();
  const { refresh, cancel } = useLaunchBoxActions();
  const data = status.data;
  const working = data?.state === 'downloading' || data?.state === 'building';
  const percent = Math.round((data?.progress ?? 0) * 100);

  return (
    <section
      aria-labelledby="launchbox-title"
      className="flex flex-col gap-2 border-t border-white/10 py-4"
    >
      <h3 id="launchbox-title" className="text-sm font-semibold text-white">
        {t('settings.scraper.launchbox.title')}
      </h3>
      <p className="text-xs text-slate-400">{t('settings.scraper.launchbox.help')}</p>
      {status.isError && (
        <p role="alert" className="text-xs text-[#ff8a80]">
          {t(errorMessageKey(status.error))}
        </p>
      )}
      {data && (
        <>
          <p className="text-xs text-slate-200">
            {data.builtAt
              ? t('settings.scraper.launchbox.updated', {
                  date: new Date(data.builtAt).toLocaleDateString(i18n.language),
                  count: data.games,
                  games: data.games.toLocaleString(i18n.language),
                })
              : t('settings.scraper.launchbox.missing')}
          </p>
          {working && (
            <div className="flex items-center gap-3">
              <div
                role="progressbar"
                aria-label={t(`settings.scraper.launchbox.${data.state}`)}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={percent}
                className="h-1.5 w-64 overflow-hidden rounded-full bg-white/10"
              >
                <div className="h-full bg-emerald-400" style={{ width: `${String(percent)}%` }} />
              </div>
              <span className="text-xs text-slate-400">
                {t(`settings.scraper.launchbox.${data.state}`)} · {percent}%
              </span>
            </div>
          )}
          {data.error && (
            <p role="alert" className="text-xs text-[#ff8a80]">
              {t(data.error)}
            </p>
          )}
          {refresh.isError && (
            <p role="alert" className="text-xs text-[#ff8a80]">
              {t(errorMessageKey(refresh.error))}
            </p>
          )}
          <div className="flex gap-2">
            {working ? (
              <button
                type="button"
                className={BUTTON}
                onClick={() => {
                  cancel.mutate();
                }}
              >
                {t('settings.scraper.launchbox.cancel')}
              </button>
            ) : (
              <button
                type="button"
                className={BUTTON}
                disabled={refresh.isPending}
                onClick={() => {
                  refresh.mutate();
                }}
              >
                {data.builtAt
                  ? t('settings.scraper.launchbox.refresh')
                  : t('settings.scraper.launchbox.download')}
              </button>
            )}
          </div>
        </>
      )}
    </section>
  );
}
