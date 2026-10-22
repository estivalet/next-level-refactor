import { defaultSettings, type MenuDraft } from '@nextlevel/shared';
import {
  ThemeArtProvider,
  ThemeEngineProvider,
  resolveTheme,
  useInputActions,
} from '@nextlevel/themes';
import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useSettings } from '../settings/settingsApi.ts';
import { frontendThemeId } from './frontendTheme.ts';
import { useLauncherThemeHost } from './useLauncherThemeHost.ts';

const noop = () => undefined;

/**
 * The Menu Editor's live preview (US-D5): the current theme over an unsaved menu, above
 * everything. Back at the root or the to-desktop action returns to the editor. It never records
 * the theme as last used, and games don't launch from it.
 */
export function MenuPreviewLayer({ draft, onClose }: { draft: MenuDraft; onClose: () => void }) {
  const { t } = useTranslation();
  const loaded = useSettings().data;
  const settings = loaded?.kind === 'ok' ? loaded.snapshot.settings : defaultSettings();
  const theme = resolveTheme(frontendThemeId(settings));
  const layerRef = useRef<HTMLDivElement>(null);
  const host = useLauncherThemeHost({
    settings,
    t,
    report: noop,
    launching: noop,
    previewDraft: draft,
  });
  useEffect(() => {
    layerRef.current?.focus();
  }, []);
  useInputActions({
    targetRef: layerRef,
    enabled: true,
    input: settings.input,
    onAction: (action) => {
      if (action === 'toDesktop') onClose();
    },
  });
  const Theme = theme.Component;
  return (
    <div
      ref={layerRef}
      data-testid="menu-preview-layer"
      data-theme={theme.id}
      tabIndex={-1}
      aria-label={t('menuEditor.previewLabel')}
      className="fixed inset-0 z-[110] bg-black outline-none"
    >
      <ThemeEngineProvider host={host} onExit={onClose}>
        <ThemeArtProvider
          host={host}
          themeId={theme.id}
          moduleArt={theme.art}
          {...(theme.settings ? { moduleSettings: theme.settings } : {})}
        >
          <Theme onExit={onClose} inputEnabled active />
        </ThemeArtProvider>
      </ThemeEngineProvider>
      <p className="pointer-events-none absolute top-3 left-1/2 z-[120] -translate-x-1/2 rounded-full bg-amber-500/90 px-3 py-1 text-xs font-semibold text-black">
        {t('menuEditor.previewBanner')}
      </p>
    </div>
  );
}
