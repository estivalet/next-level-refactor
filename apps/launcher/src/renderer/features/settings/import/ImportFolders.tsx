import { useId } from 'react';
import { useTranslation } from 'react-i18next';
import { SECONDARY_BUTTON } from '../../library/Modal.tsx';
import { pickFolder } from '../emulators/emulatorsApi.ts';

const INPUT =
  'w-full rounded-md border border-white/10 bg-black/30 px-2 py-1 text-sm text-white focus-visible:ring-2 focus-visible:ring-white/70 focus-visible:outline-none';

/** The two folders of an import: NextLevelOS's `public\data` and an optional emulators folder. */
export function ImportFolders({
  folder,
  emulatorsFolder,
  disabled,
  onChooseFolder,
  onEmulatorsFolder,
}: {
  folder: string | null;
  emulatorsFolder: string | null;
  disabled: boolean;
  onChooseFolder: () => void;
  onEmulatorsFolder: (folder: string | null) => void;
}) {
  const { t } = useTranslation();
  const id = useId();
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <span className="text-xs text-slate-200">{t('settings.import.folder')}</span>
        <div className="flex items-center gap-2">
          <code className="min-w-0 flex-1 text-xs break-all text-slate-300 select-text">
            {folder ?? t('settings.import.noFolder')}
          </code>
          <button
            type="button"
            disabled={disabled}
            onClick={onChooseFolder}
            className={SECONDARY_BUTTON}
          >
            {t('settings.import.chooseFolder')}
          </button>
        </div>
        <p className="text-xs text-slate-400">{t('settings.import.folderHelp')}</p>
      </div>
      <label className="flex flex-col gap-1 text-xs text-slate-200" htmlFor={`${id}-emulators`}>
        {t('settings.import.emulators')}
        <div className="flex items-center gap-2">
          <input
            id={`${id}-emulators`}
            type="text"
            value={emulatorsFolder ?? ''}
            disabled={disabled}
            placeholder={t('settings.import.noEmulators')}
            aria-describedby={`${id}-emulators-help`}
            onChange={(event) => {
              onEmulatorsFolder(event.target.value.trim() === '' ? null : event.target.value);
            }}
            className={INPUT}
          />
          <button
            type="button"
            disabled={disabled}
            onClick={() => {
              void pickFolder(t('settings.import.chooseEmulators')).then((picked) => {
                if (picked) onEmulatorsFolder(picked);
              });
            }}
            className={SECONDARY_BUTTON}
          >
            {t('settings.import.chooseEmulators')}
          </button>
        </div>
      </label>
      <p id={`${id}-emulators-help`} className="text-xs text-slate-400">
        {t('settings.import.emulatorsHelp')}
      </p>
    </div>
  );
}
