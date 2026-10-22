import { useEffect, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useSettings } from '../settings/settingsApi.ts';
import { BootRouteContext, useBootRoute } from './bootRoute.ts';
import { RecoveryScreen } from './RecoveryScreen.tsx';
import { Splash } from './Splash.tsx';

/**
 * Boot routing: splash while settings load, recovery when they can't be used, otherwise the
 * shell, starting in the front-end or on the desktop per the boot target (FR-THM-5). Keeps the
 * UI language in sync with the saved setting.
 */
export function BootGate({ children }: { children: ReactNode }) {
  const settings = useSettings();
  // useTranslation re-renders this component when the language changes.
  const { i18n } = useTranslation();
  const loaded = settings.data?.kind === 'ok' ? settings.data.snapshot.settings : null;
  const language = loaded?.general.language ?? null;
  const route = useBootRoute(loaded);
  // Wait for the saved language only at boot; later language changes must not unmount the shell
  // (that would close every window).
  const [booted, setBooted] = useState(false);
  if (!booted && language !== null && i18n.language === language) setBooted(true);

  useEffect(() => {
    if (!language) return;
    void i18n.changeLanguage(language);
    document.documentElement.lang = language;
  }, [i18n, language]);

  if (settings.isPending) return <Splash />;
  // The settings service itself could not be reached; the file may be fine. A failed background
  // refresh keeps the last good data, so the shell (and its windows) stay open.
  if (!settings.data) return <RecoveryScreen reason="unavailable" latestBackupId={null} />;
  if (settings.data.kind === 'invalid') {
    return (
      <RecoveryScreen reason={settings.data.reason} latestBackupId={settings.data.latestBackupId} />
    );
  }
  // At boot, show the shell only once the language matches, so it never flashes in English.
  if (!booted || !route.data) return <Splash />;
  return <BootRouteContext value={route.data}>{children}</BootRouteContext>;
}
