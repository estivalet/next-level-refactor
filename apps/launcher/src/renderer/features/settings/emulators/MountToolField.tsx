import type { Settings } from '@nextlevel/shared';
import { useTranslation } from 'react-i18next';
import { pickExecutable } from './emulatorsApi.ts';

const SMALL_BUTTON =
  'rounded-md bg-white/5 px-2 py-1 text-[11px] text-slate-300 hover:bg-white/10 hover:text-white';

/** The squashfs mount tool (FR-EMU-9), under Tools at the foot of the emulator list. */
export function MountToolField({
  path,
  update,
}: {
  path: string | null | undefined;
  update: (change: (settings: Settings) => Settings) => void;
}) {
  const { t } = useTranslation();
  return (
    <fieldset
      aria-label={t('settings.emulators.mountTool')}
      className="flex flex-col gap-1 text-xs"
    >
      <legend className="mb-1 text-[11px] text-slate-400">
        {t('settings.emulators.mountTool')}
      </legend>
      <p className="text-[11px] text-slate-500">{t('settings.emulators.mountToolHelp')}</p>
      {path ? (
        <code className="break-all text-[11px] text-slate-200">{path}</code>
      ) : (
        <span className="text-[11px] text-slate-400">{t('settings.emulators.mountToolAuto')}</span>
      )}
      <div className="flex flex-wrap gap-1.5">
        <button
          type="button"
          className={SMALL_BUTTON}
          onClick={() => {
            void pickExecutable(t('settings.emulators.mountToolPick')).then((picked) => {
              if (!picked) return;
              update((s) => ({ ...s, tools: { ...s.tools, squashfsMount: picked } }));
            });
          }}
        >
          {t('settings.emulators.mountToolChoose')}
        </button>
        {path && (
          <button
            type="button"
            className={SMALL_BUTTON}
            onClick={() => {
              update((s) => ({ ...s, tools: { ...s.tools, squashfsMount: null } }));
            }}
          >
            {t('settings.emulators.mountToolClear')}
          </button>
        )}
      </div>
    </fieldset>
  );
}
