import type { AppPathKey } from '@nextlevel/shared';
import { useTranslation } from 'react-i18next';
import { ImportPanel } from './import/ImportPanel.tsx';
import { LaunchLog } from './LaunchLog.tsx';
import { useAppPaths, useOpenPath } from './settingsApi.ts';

// The settings file is shown but not opened: only folders can be opened (app.openPath keys).
const ROWS: readonly { key: 'data' | 'settings' | 'backups' | 'logs'; openable: boolean }[] = [
  { key: 'data', openable: true },
  { key: 'settings', openable: false },
  { key: 'backups', openable: true },
  { key: 'logs', openable: true },
];

/**
 * Settings → Data & logs (FR-SET-7, FR-IMP-2, FR-EMU-10): where data lives, the NextLevelOS import
 * and the launch log.
 */
export function DataSection() {
  const { t } = useTranslation();
  const paths = useAppPaths();
  const openPath = useOpenPath();

  return (
    <section className="flex flex-col gap-2 p-6">
      <p className="text-sm text-slate-300">{t('settings.data.intro')}</p>
      <dl className="flex flex-col">
        {ROWS.map(({ key, openable }) => {
          const label = t(`settings.data.${key}`);
          return (
            <div
              key={key}
              className="flex items-center justify-between gap-4 border-b border-white/5 py-3"
            >
              <div className="flex min-w-0 flex-col gap-1">
                <dt className="text-sm font-medium text-white">{label}</dt>
                <dd>
                  <code className="text-xs break-all text-slate-300 select-text">
                    {paths.data?.[key]}
                  </code>
                </dd>
              </div>
              {openable && (
                <button
                  type="button"
                  aria-label={t('settings.data.open', { name: label })}
                  onClick={() => {
                    openPath.mutate(key as AppPathKey);
                  }}
                  className="shrink-0 rounded-lg bg-white/10 px-3 py-1.5 text-xs font-medium text-white hover:bg-white/20 focus-visible:ring-2 focus-visible:ring-white focus-visible:outline-none"
                >
                  {t('settings.data.open', { name: label })}
                </button>
              )}
            </div>
          );
        })}
      </dl>
      <div className="mt-4 border-t border-white/10 pt-4">
        <ImportPanel />
      </div>
      <h3 className="mt-4 text-sm font-semibold text-white">
        {t('settings.data.launchLog.title')}
      </h3>
      <p className="text-xs text-slate-400">{t('settings.data.launchLog.intro')}</p>
      <LaunchLog />
    </section>
  );
}
