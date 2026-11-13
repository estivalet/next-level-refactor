import { useTranslation } from 'react-i18next';
import { UpdatePanel } from '../update/UpdatePanel.tsx';
import { useAppVersion } from './api.ts';
import { SettingsForm } from './form/SettingsForm.tsx';

/**
 * Settings → About: the version, updates (NFR-UPD-1, D53) — status, Check now, Restart to
 * update — and the update channel and automatic checks.
 */
export function AboutSection() {
  const { t } = useTranslation();
  const version = useAppVersion();

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
