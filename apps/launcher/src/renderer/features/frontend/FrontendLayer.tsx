import { defaultSettings } from '@nextlevel/shared';
import {
  THEMES,
  ThemeArtProvider,
  ThemeEngineProvider,
  ThemeExitMenu,
  ThemeSwitcher,
  useInputActions,
} from '@nextlevel/themes';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSettings } from '../settings/settingsApi.ts';
import { useOpenApp } from '../shell/useOpenApp.ts';
import { FrontendLaunchError } from './FrontendLaunchError.tsx';
import { useFrontend } from './useFrontend.ts';
import { useFrontendSession } from './useFrontendSession.ts';
import { useFrontendTheme } from './useFrontendTheme.ts';
import { useLauncherThemeHost } from './useLauncherThemeHost.ts';

/**
 * Front-end mode (IA §1, FR-THM-1): the theme fullscreen above the shell. It stays mounted while
 * hidden, so M / View+Start to the desktop and back returns to the same level and focus. Back at
 * the root (or Start) opens the theme menu; T or the menu's Switch theme opens the theme switcher,
 * which swaps the theme inside the same engine so the level and focus survive. Theme input pauses
 * while a game runs (US-C2).
 */
export function FrontendLayer() {
  const { t } = useTranslation();
  const { visible, hide, show } = useFrontend();
  const openApp = useOpenApp();
  const loaded = useSettings().data;
  const settings = loaded?.kind === 'ok' ? loaded.snapshot.settings : defaultSettings();
  const session = useFrontendSession(visible);
  const [menuOpen, setMenuOpen] = useState(false);
  const [switcherOpen, setSwitcherOpen] = useState(false);
  const layerRef = useRef<HTMLDivElement>(null);

  const host = useLauncherThemeHost({
    settings,
    t,
    report: session.report,
    launching: session.launching,
  });

  const { theme, switchTo } = useFrontendTheme(settings);

  const toDesktop = () => {
    setMenuOpen(false);
    setSwitcherOpen(false);
    hide();
  };
  const openSwitcher = () => {
    setMenuOpen(false);
    setSwitcherOpen(true);
  };
  const themeInput =
    visible &&
    !menuOpen &&
    !switcherOpen &&
    session.playingGameId === null &&
    session.failure === null;
  useInputActions({
    targetRef: layerRef,
    enabled: themeInput,
    input: settings.input,
    onAction: (action) => {
      if (action === 'toDesktop') toDesktop();
      else if (action === 'switchTheme') openSwitcher();
    },
  });

  // Behind the desktop the same toDesktop action (View+Start) brings the front-end back, so a
  // gamepad alone is never stranded there. Keys are read from the layer, which has no focus
  // then, so only the gamepad reaches this.
  useInputActions({
    targetRef: layerRef,
    enabled: !visible,
    input: settings.input,
    onAction: (action) => {
      if (action === 'toDesktop') show();
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
          <Theme
            key={theme.id}
            onExit={openMenu}
            inputEnabled={themeInput}
            active={visible && session.playingGameId === null}
          />
        </ThemeArtProvider>
      </ThemeEngineProvider>
      {menuOpen && (
        <ThemeExitMenu
          input={settings.input}
          onDesktop={toDesktop}
          onSwitchTheme={openSwitcher}
          onClose={() => {
            setMenuOpen(false);
          }}
        />
      )}
      {switcherOpen && (
        <ThemeSwitcher
          themes={THEMES}
          activeId={theme.id}
          input={settings.input}
          onApply={(id) => {
            setSwitcherOpen(false);
            switchTo(id);
          }}
          onCancel={() => {
            setSwitcherOpen(false);
          }}
        />
      )}
      {session.playingGameId !== null && (
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
