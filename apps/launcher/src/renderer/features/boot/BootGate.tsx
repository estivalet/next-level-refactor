import { useEffect, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useSettings } from '../settings/settingsApi.ts';
import { RecoveryScreen } from './RecoveryScreen.tsx';
import { Splash } from './Splash.tsx';

/**
 * Boot routing for M1: splash while settings load, recovery when they can't be used, otherwise
 * the shell. Keeps the UI language in sync with the saved setting.
 */
export function BootGate({ children }: { children: ReactNode }) {
  const settings = useSettings();
  // useTranslation re-renders this component when the language changes.
  const { i18n } = useTranslation();
  const language =
    settings.data?.kind === 'ok' ? settings.data.snapshot.settings.general.language : null;

  useEffect(() => {
    if (!language) return;
    void i18n.changeLanguage(language);
    document.documentElement.lang = language;
  }, [i18n, language]);

  if (settings.isPending) return <Splash />;
  // The settings service itself could not be reached; the file may be fine.
  if (settings.isError) return <RecoveryScreen reason="unavailable" latestBackupId={null} />;
  if (settings.data.kind === 'invalid') {
    return (
      <RecoveryScreen reason={settings.data.reason} latestBackupId={settings.data.latestBackupId} />
    );
  }
  // Render only once the language matches, so the shell never flashes in the wrong language.
  if (i18n.language !== language) return <Splash />;
  return children;
}
