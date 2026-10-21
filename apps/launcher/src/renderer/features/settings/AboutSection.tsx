import { useTranslation } from 'react-i18next';
import { useAppVersion } from './api.ts';

export function AboutSection() {
  const { t } = useTranslation();
  const version = useAppVersion();

  return (
    <section className="flex flex-col gap-1 p-6">
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
  );
}
