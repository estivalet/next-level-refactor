import type { Settings } from '@nextlevel/shared';
import { THEMES } from '@nextlevel/themes';
import { useTranslation } from 'react-i18next';
import { frontendThemeId } from '../frontend/frontendTheme.ts';
import { SettingsSection } from './form/SettingsSection.tsx';

function withTheme(settings: Settings, themeId: string): Settings {
  return { ...settings, themes: { ...settings.themes, activeDefault: themeId, lastUsed: themeId } };
}

/**
 * Settings → Themes (IA §1, FR-THM-1): the bundled themes; the one in use is what the front-end
 * opens. Per-theme options and pack coverage join this page in M4d.
 */
export function ThemesSection() {
  const { t } = useTranslation();
  return (
    <SettingsSection>
      {({ draft, update }) => {
        const inUse = frontendThemeId(draft);
        return (
          <div className="flex flex-col gap-3 py-4">
            <p className="text-xs text-slate-400">{t('settings.themes.help')}</p>
            <div className="grid grid-cols-2 gap-3">
              {THEMES.map((theme) => {
                const name = t(theme.nameKey);
                // In use = what the front-end opens (an unknown last theme falls back to Big Box);
                // "Use" stays offered until the settings name this theme themselves.
                const active = theme.id === inUse;
                const named =
                  draft.themes.activeDefault === theme.id &&
                  (draft.themes.lastUsed ?? theme.id) === theme.id;
                return (
                  <article
                    key={theme.id}
                    aria-label={name}
                    className={`flex flex-col gap-2 rounded-xl border p-4 ${
                      active ? 'border-white/40 bg-white/10' : 'border-white/10'
                    }`}
                  >
                    <h3 className="text-sm font-semibold text-white">{name}</h3>
                    {theme.descriptionKey && (
                      <p className="text-xs text-slate-300">{t(theme.descriptionKey)}</p>
                    )}
                    {active && (
                      <span className="text-xs font-medium text-emerald-300">
                        {t('settings.themes.inUse')}
                      </span>
                    )}
                    {!named && (
                      <button
                        type="button"
                        onClick={() => {
                          update((current) => withTheme(current, theme.id));
                        }}
                        className="w-fit rounded-lg bg-white/10 px-3 py-1.5 text-xs font-medium text-white hover:bg-white/20 focus-visible:ring-2 focus-visible:ring-white focus-visible:outline-none"
                      >
                        {t('settings.themes.use')}
                      </button>
                    )}
                  </article>
                );
              })}
            </div>
          </div>
        );
      }}
    </SettingsSection>
  );
}
