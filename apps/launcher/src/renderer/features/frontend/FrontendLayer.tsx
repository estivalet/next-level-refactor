import { defaultSettings, type Settings } from '@nextlevel/shared';
import {
  resolveTheme,
  ThemeArtProvider,
  ThemeEngineProvider,
  ThemeExitMenu,
  useInputActions,
} from '@nextlevel/themes';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { getBridge } from '../../bridge.ts';
import { useSettings } from '../settings/settingsApi.ts';
import { useOpenApp } from '../shell/useOpenApp.ts';
import { FrontendLaunchError } from './FrontendLaunchError.tsx';
import { useFrontend } from './useFrontend.ts';
import { useFrontendSession } from './useFrontendSession.ts';
import { useLauncherThemeHost } from './useLauncherThemeHost.ts';

/** The theme the front-end shows: the last one used, else the default; unknown ids → Big Box. */
export function frontendThemeId(settings: Settings): string {
  return resolveTheme(settings.themes.lastUsed ?? settings.themes.activeDefault).id;
}

/**
 * Front-end mode (IA §1, FR-THM-1): the theme fullscreen above the shell. It stays mounted while
 * hidden, so M / View+Start to the desktop and back returns to the same level and focus. Back at
 * the root (or Start) opens the theme menu; theme input pauses while a game runs (US-C2).
 */
export function FrontendLayer() {
  const { t } = useTranslation();
  const { visible, hide } = useFrontend();
  const openApp = useOpenApp();
  const loaded = useSettings().data;
  const settings = loaded?.kind === 'ok' ? loaded.snapshot.settings : defaultSettings();
  const session = useFrontendSession(visible);
  const [menuOpen, setMenuOpen] = useState(false);
  const layerRef = useRef<HTMLDivElement>(null);

  const host = useLauncherThemeHost({ settings, t, report: session.report });

  const theme = resolveTheme(frontendThemeId(settings));
  useEffect(() => {
    void getBridge().invoke('frontend.themeOpened', { themeId: theme.id });
  }, [theme.id]);

  const toDesktop = () => {
    setMenuOpen(false);
    hide();
  };
  const themeInput =
    visible && !menuOpen && session.runningGameId === null && session.failure === null;
  useInputActions({
    targetRef: layerRef,
    enabled: themeInput,
    input: settings.input,
    onAction: (action) => {
      if (action === 'toDesktop') toDesktop();
    },
  });

  // Hidden behind the desktop: let go of focus so keys typed there never reach the theme.
  useEffect(() => {
    if (visible) return;
    const active = document.activeElement;
    if (active instanceof HTMLElement && layerRef.current?.contains(active)) active.blur();
  }, [visible]);

  const openMenu = () => {
    setMenuOpen(true);
  };
  const Theme = theme.Component;
  return (
    <div
      ref={layerRef}
      data-testid="frontend-layer"
      data-theme={theme.id}
      hidden={!visible}
      tabIndex={-1}
      aria-label={t('frontend.label')}
      className="fixed inset-0 z-[100] bg-black outline-none"
    >
      <ThemeEngineProvider host={host} onExit={openMenu}>
        <ThemeArtProvider
          host={host}
          themeId={theme.id}
          moduleArt={theme.art}
          {...(theme.settings ? { moduleSettings: theme.settings } : {})}
        >
          <Theme key={theme.id} onExit={openMenu} inputEnabled={themeInput} />
        </ThemeArtProvider>
      </ThemeEngineProvider>
      {menuOpen && (
        <ThemeExitMenu
          input={settings.input}
          onDesktop={toDesktop}
          onClose={() => {
            setMenuOpen(false);
          }}
        />
      )}
      {session.runningGameId !== null && (
        <div
          role="status"
          aria-label={t('frontend.playing')}
          className="absolute inset-0 z-[65] flex items-center justify-center bg-black/80 text-sm text-white/80"
        >
          {t('frontend.playingHint')}
        </div>
      )}
      {session.failure && (
        <FrontendLaunchError
          failure={session.failure}
          input={settings.input}
          onClose={session.dismiss}
          onFix={(fix) => {
            session.dismiss();
            toDesktop();
            openApp('settings', { section: fix.section, ...(fix.id ? { focusId: fix.id } : {}) });
          }}
        />
      )}
    </div>
  );
}
