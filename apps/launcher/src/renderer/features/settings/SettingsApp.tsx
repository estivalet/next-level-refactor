import { useTranslation } from 'react-i18next';

export function SettingsApp() {
  const { t } = useTranslation();
  return <h2 className="sr-only">{t('apps.settings.title')}</h2>;
}
