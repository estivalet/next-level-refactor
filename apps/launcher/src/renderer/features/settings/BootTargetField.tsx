import type { BootTarget, Settings } from '@nextlevel/shared';
import { resolveTheme, THEMES } from '@nextlevel/themes';
import { useId } from 'react';
import { useTranslation } from 'react-i18next';
import type { SettingsDraft } from './form/useSettingsDraft.ts';

const SELECT =
  'rounded-lg border border-white/10 bg-black/30 px-3 py-1.5 text-sm text-white focus-visible:ring-2 focus-visible:ring-white/70 focus-visible:outline-none';

const KINDS: readonly BootTarget['kind'][] = ['lastTheme', 'theme', 'desktop'];

function withTarget(settings: Settings, bootTarget: BootTarget): Settings {
  return { ...settings, general: { ...settings.general, bootTarget } };
}

/**
 * Settings → General → Start in (FR-THM-5, D1): the last theme, a chosen theme or the desktop.
 * A chosen theme that no longer exists reads as Big Box, which is what the front-end opens.
 */
export function BootTargetField({ draft, update }: Pick<SettingsDraft, 'draft' | 'update'>) {
  const { t } = useTranslation();
  const id = useId();
  const target = draft.general.bootTarget;

  return (
    <div className="flex items-start justify-between gap-6 border-b border-white/5 py-4">
      <div className="flex flex-col gap-1">
        <label htmlFor={`${id}-kind`} className="text-sm font-medium text-white">
          {t('settings.general.bootTarget.label')}
        </label>
        <p id={`${id}-help`} className="text-xs text-slate-400">
          {t('settings.general.bootTarget.help')}
        </p>
      </div>
      <div className="flex flex-col items-end gap-2">
        <select
          id={`${id}-kind`}
          value={target.kind}
          aria-describedby={`${id}-help`}
          onChange={(event) => {
            const kind = event.target.value as BootTarget['kind'];
            const next: BootTarget =
              kind === 'theme' ? { kind, themeId: resolveTheme(null).id } : { kind };
            update((current) => withTarget(current, next));
          }}
          className={SELECT}
        >
          {KINDS.map((kind) => (
            <option key={kind} value={kind}>
              {t(`settings.general.bootTarget.options.${kind}`)}
            </option>
          ))}
        </select>
        {target.kind === 'theme' && (
          <select
            aria-label={t('settings.general.bootTarget.theme')}
            value={resolveTheme(target.themeId).id}
            onChange={(event) => {
              update((current) =>
                withTarget(current, { kind: 'theme', themeId: event.target.value }),
              );
            }}
            className={SELECT}
          >
            {THEMES.map((theme) => (
              <option key={theme.id} value={theme.id}>
                {t(theme.nameKey)}
              </option>
            ))}
          </select>
        )}
      </div>
    </div>
  );
}
