import { useTranslation } from 'react-i18next';
import { UpdatePanel } from '../update/UpdatePanel.tsx';
import { useAppVersion } from './api.ts';
import { useOpenPath } from './settingsApi.ts';
import { SettingsForm } from './form/SettingsForm.tsx';

/**
 * Settings → About: the version, updates (NFR-UPD-1, D53) — status, Check now, Restart to
 * update — the update channel and automatic checks, and the third-party licenses.
 */
export function AboutSection() {
  const { t } = useTranslation();
  const version = useAppVersion();
  const openPath = useOpenPath();

  return (
    <div className="flex h-full flex-col overflow-y-auto">
      <section className="flex flex-col gap-1 px-6 pt-6">
        <h3 className="text-lg font-semibold text-white">{t('settings.about.product')}</h3>
        {version.isSuccess && (
          <p className="text-sm text-slate-300">
            {t('settings.about.version', { version: version.data })}
          </p>
        )}
        {version.isError && (
          <p className="text-sm text-slate-400">{t('settings.about.versionUnavailable')}</p>
        )}
        <div>
          <button
            type="button"
            className="mt-1 text-sm text-sky-300 underline-offset-2 hover:underline focus-visible:ring-2 focus-visible:ring-white focus-visible:outline-none"
            onClick={() => {
              openPath.mutate('licenses');
            }}
          >
            {t('settings.about.licenses')}
          </button>
        </div>
      </section>
      <section className="flex flex-col gap-2 px-6 pt-6">
        <h4 className="text-sm font-semibold text-white">{t('settings.about.updates')}</h4>
        <UpdatePanel checkLabel={t('update.checkNow')} />
      </section>
      <div className="min-h-0 flex-1">
        <SettingsForm sectionKey="updates" />
      </div>
    </div>
  );
}
