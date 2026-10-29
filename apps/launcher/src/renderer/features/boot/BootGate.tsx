import { useEffect, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useSettings } from '../settings/settingsApi.ts';
import { AuthGate } from '../auth/AuthGate.tsx';
import { SetupWizard } from '../setup/SetupWizard.tsx';
import { BootRouteContext, SetupLandingContext, useBootRoute } from './bootRoute.ts';
import { RecoveryScreen } from './RecoveryScreen.tsx';
import { Splash } from './Splash.tsx';

/**
 * Boot routing: splash while settings load, recovery when they can't be used, then the sign-in
 * gate (FR-AUTH-*), then the shell, starting in the front-end or on the desktop per the boot target (FR-THM-5). Keeps the
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
  // The wizard is decided once, from the first usable settings (D48): "Run setup again" shows
  // it at the next start, not at once.
  const [setup, setSetup] = useState<'pending' | 'wizard' | 'done'>('pending');
  if (setup === 'pending' && loaded) {
    setSetup(loaded.general.setupCompletedAt === null ? 'wizard' : 'done');
  }
  const [landing, setLanding] = useState<'catalog' | null>(null);

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
  // The gate layer (IA §1): after settings, so its screens are in the user's language.
  return (
    <AuthGate>
      {setup === 'wizard' ? (
        <SetupWizard
          onDone={(where) => {
            setLanding(where);
            setSetup('done');
          }}
        />
      ) : (
        <SetupLandingContext value={landing}>
          <BootRouteContext value={route.data}>{children}</BootRouteContext>
        </SetupLandingContext>
      )}
    </AuthGate>
  );
}
