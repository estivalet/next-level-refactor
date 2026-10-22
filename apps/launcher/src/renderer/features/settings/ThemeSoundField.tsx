import type { Settings, ThemeSound } from '@nextlevel/shared';
import { useId } from 'react';
import { useTranslation } from 'react-i18next';
import type { SettingsDraft } from './form/useSettingsDraft.ts';
import { Switch } from './form/Switch.tsx';

function withSound(settings: Settings, patch: Partial<ThemeSound>): Settings {
  return {
    ...settings,
    themes: { ...settings.themes, sound: { ...settings.themes.sound, ...patch } },
  };
}

/**
 * Settings → General → Theme sounds (FR-THM-4, D7): the navigation sounds of every theme, on/off
 * and volume. The open theme follows a save at once.
 */
export function ThemeSoundField({ draft, update }: Pick<SettingsDraft, 'draft' | 'update'>) {
  const { t } = useTranslation();
  const id = useId();
  const { enabled, volume } = draft.themes.sound;

  return (
    <div className="flex items-start justify-between gap-6 border-b border-white/5 py-4">
      <div className="flex flex-col gap-1">
        <span id={`${id}-label`} className="text-sm font-medium text-white">
          {t('settings.general.themeSound.label')}
        </span>
        <p id={`${id}-help`} className="text-xs text-slate-400">
          {t('settings.general.themeSound.help')}
        </p>
      </div>
      <div className="flex items-center gap-3">
        <input
          type="range"
          min={0}
          max={100}
          step={5}
          value={volume}
          disabled={!enabled}
          aria-label={t('settings.general.themeSound.volume')}
          aria-valuetext={t('settings.general.themeSound.volumeValue', { volume })}
          onChange={(event) => {
            update((current) => withSound(current, { volume: Number(event.target.value) }));
          }}
          className="w-32 accent-[#990033] disabled:opacity-40"
        />
        <span className="w-10 text-right text-xs text-slate-300 tabular-nums">{volume}%</span>
        <Switch
          checked={enabled}
          labelledBy={`${id}-label`}
          describedBy={`${id}-help`}
          onChange={(on) => {
            update((current) => withSound(current, { enabled: on }));
          }}
        />
      </div>
    </div>
  );
}
