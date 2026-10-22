import type { Settings } from '@nextlevel/shared';
import type { ThemeModule } from '@nextlevel/themes';
import { ArrowLeft } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { SettingsDraft } from '../form/useSettingsDraft.ts';
import { useSystemCatalog } from '../settingsApi.ts';
import { ArtOptions } from './ArtOptions.tsx';
import { SettingsOptions } from './SettingsOptions.tsx';
import {
  resetThemeOptions,
  setArtOption,
  setThemeSetting,
  setWheelOption,
} from './themeOptions.ts';
import { useThemeArtIndex } from './useThemeArtIndex.ts';

const BUTTON =
  'flex items-center gap-2 rounded-lg bg-white/10 px-3 py-1.5 text-xs font-medium text-white hover:bg-white/20 focus-visible:ring-2 focus-visible:ring-white focus-visible:outline-none';

/** The error keys under `prefix`, keyed by the rest of the path (or its first segment). */
function errorsUnder(
  errors: Record<string, string>,
  prefix: string,
  firstSegment = false,
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [path, key] of Object.entries(errors)) {
    if (!path.startsWith(prefix)) continue;
    const rest = path.slice(prefix.length);
    out[firstSegment ? (rest.split('.')[0] ?? rest) : rest] ??= key;
  }
  return out;
}

/**
 * Settings → Themes → one theme (FR-THM-4, D3): its art options and its own settings, saved in
 * `settings.themes.entries[id]` (data model §2.5); the open theme follows a save at once.
 */
export function ThemePage({
  theme,
  form,
  onBack,
}: {
  theme: ThemeModule;
  form: Pick<SettingsDraft, 'draft' | 'update' | 'errors'>;
  /** False when the page has to stay (an invalid value). */
  onBack: () => boolean;
}) {
  const { t } = useTranslation();
  const { draft, update, errors } = form;
  const index = useThemeArtIndex(theme.id).data;
  const catalog = useSystemCatalog().data ?? [];
  const systems = catalog
    .filter((system) => draft.systems[system.id]?.enabled === true)
    .map((system) => ({ id: system.id, name: system.name }))
    .sort((a, b) => a.name.localeCompare(b.name));
  const entry = draft.themes.entries[theme.id];
  const base = `themes.entries.${theme.id}.`;
  const edit = (change: (settings: Settings) => Settings) => {
    update(change);
  };
  const heading = useRef<HTMLHeadingElement>(null);
  const page = useRef<HTMLDivElement>(null);
  const [blocked, setBlocked] = useState(false);
  const back = () => {
    if (onBack()) return;
    // Say why the page stays, and go to the first value to fix (NFR-A11Y-1).
    setBlocked(true);
    page.current?.querySelector<HTMLElement>('[aria-invalid="true"], [role="alert"]')?.focus();
  };
  useEffect(() => {
    heading.current?.focus();
  }, []);

  return (
    <div ref={page} className="flex flex-col py-4">
      <div className="flex items-center gap-3">
        <button type="button" onClick={back} className={BUTTON}>
          <ArrowLeft aria-hidden="true" className="h-4 w-4" />
          {t('settings.themes.options.back')}
        </button>
        <h2 ref={heading} tabIndex={-1} className="text-base font-semibold text-white outline-none">
          {t(theme.nameKey)}
        </h2>
        <button
          type="button"
          disabled={!entry}
          onClick={() => {
            edit((current) => resetThemeOptions(current, theme.id));
          }}
          className={`${BUTTON} ml-auto disabled:opacity-40`}
        >
          {t('settings.themes.options.reset')}
        </button>
      </div>
      {blocked && Object.keys(errors).some((path) => path.startsWith(base)) && (
        <p role="status" className="mt-3 rounded-lg bg-white/10 px-3 py-2 text-xs text-white">
          {t('settings.themes.options.blocked')}
        </p>
      )}
      <ArtOptions
        theme={theme}
        index={index}
        userArt={entry?.art}
        errors={errorsUnder(errors, `${base}art.`, true)}
        systems={systems}
        onArt={(key, value) => {
          edit((current) => setArtOption(current, theme.id, key, value));
        }}
      />
      <SettingsOptions
        theme={theme}
        manifest={index?.manifest}
        userSettings={entry?.settings}
        errors={errorsUnder(errors, `${base}settings.`)}
        onSetting={(key, value) => {
          edit((current) => setThemeSetting(current, theme.id, key, value));
        }}
        onWheel={(wheel, key, value) => {
          edit((current) => setWheelOption(current, theme.id, wheel, key, value));
        }}
      />
    </div>
  );
}
