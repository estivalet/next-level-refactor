import type { Settings } from '@nextlevel/shared';
import { getTheme, THEMES } from '@nextlevel/themes';
import { useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { frontendThemeId } from '../frontend/frontendTheme.ts';
import { SettingsSection } from './form/SettingsSection.tsx';
import { PackBadge } from './themes/PackBadge.tsx';
import { ThemePage } from './themes/ThemePage.tsx';

const BUTTON =
  'w-fit rounded-lg bg-white/10 px-3 py-1.5 text-xs font-medium text-white hover:bg-white/20 focus-visible:ring-2 focus-visible:ring-white focus-visible:outline-none';

function withTheme(settings: Settings, themeId: string): Settings {
  return { ...settings, themes: { ...settings.themes, activeDefault: themeId, lastUsed: themeId } };
}

/**
 * Settings → Themes (IA §1, FR-THM-1, FR-THM-4): the bundled themes; the one in use is what the
 * front-end opens. Each card shows its pack's art coverage (FR-THM-2); Options open the theme's
 * page of options.
 */
export function ThemesSection() {
  const { t } = useTranslation();
  const [openId, setOpenId] = useState<string | null>(null);
  const container = useRef<HTMLDivElement>(null);
  const open = openId ? getTheme(openId) : undefined;

  return (
    <SettingsSection>
      {(form) => {
        const { draft, update, errors } = form;
        if (open) {
          // A page with invalid values stays open: leaving it would hide the only messages
          // while Save stays disabled.
          const hasErrors = Object.keys(errors).some((path) =>
            path.startsWith(`themes.entries.${open.id}.`),
          );
          return (
            <ThemePage
              theme={open}
              form={form}
              onBack={() => {
                if (hasErrors) return;
                flushSync(() => {
                  setOpenId(null);
                });
                // Back to the card the page was opened from (NFR-A11Y-1).
                container.current
                  ?.querySelector<HTMLButtonElement>(
                    `[data-theme-id="${CSS.escape(open.id)}"] [data-action="options"]`,
                  )
                  ?.focus();
              }}
            />
          );
        }
        const inUse = frontendThemeId(draft);
        return (
          <div ref={container} className="flex flex-col gap-3 py-4">
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
                    data-theme-id={theme.id}
                    className={`flex flex-col gap-2 rounded-xl border p-4 ${
                      active ? 'border-white/40 bg-white/10' : 'border-white/10'
                    }`}
                  >
                    <h3 className="text-sm font-semibold text-white">{name}</h3>
                    {theme.descriptionKey && (
                      <p className="text-xs text-slate-300">{t(theme.descriptionKey)}</p>
                    )}
                    <PackBadge theme={theme} userArt={draft.themes.entries[theme.id]?.art} />
                    {active && (
                      <span className="text-xs font-medium text-emerald-300">
                        {t('settings.themes.inUse')}
                      </span>
                    )}
                    <div className="flex flex-wrap gap-2">
                      {!named && (
                        <button
                          type="button"
                          onClick={() => {
                            update((current) => withTheme(current, theme.id));
                          }}
                          className={BUTTON}
                        >
                          {t('settings.themes.use')}
                        </button>
                      )}
                      <button
                        type="button"
                        data-action="options"
                        onClick={() => {
                          setOpenId(theme.id);
                        }}
                        className={BUTTON}
                      >
                        {t('settings.themes.options.open')}
                      </button>
                    </div>
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
