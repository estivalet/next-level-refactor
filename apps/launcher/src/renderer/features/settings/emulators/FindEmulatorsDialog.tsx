import type { DetectedEmulator, EmulatorPreset } from '@nextlevel/shared';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal, PRIMARY_BUTTON, SECONDARY_BUTTON } from '../../library/Modal.tsx';
import { detectEmulators, pickFolder } from './emulatorsApi.ts';

/** Find emulators in a folder (owner decision D6): detected programs, checked unless added. */
export function FindEmulatorsDialog({
  presets,
  known,
  onAdd,
  onClose,
}: {
  presets: readonly EmulatorPreset[];
  /** Programs already set up, compared ignoring case. */
  known: readonly string[];
  onAdd: (found: DetectedEmulator[]) => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const [state, setState] = useState<'idle' | 'searching' | 'done'>('idle');
  const [found, setFound] = useState<DetectedEmulator[]>([]);
  const [checked, setChecked] = useState<ReadonlySet<string>>(new Set());
  const added = new Set(known.map((path) => path.toLowerCase()));
  const choose = async () => {
    const folder = await pickFolder(t('settings.emulators.findDialog.title'));
    if (!folder) return;
    setState('searching');
    const result = await detectEmulators(folder);
    setFound(result);
    setChecked(new Set(result.map((e) => e.executable).filter((p) => !added.has(p.toLowerCase()))));
    setState('done');
  };
  const chosen = found.filter((e) => checked.has(e.executable));

  return (
    <Modal
      title={t('settings.emulators.findDialog.title')}
      onClose={onClose}
      footer={
        <>
          <button type="button" className={SECONDARY_BUTTON} onClick={onClose}>
            {t('settings.emulators.cancel')}
          </button>
          <button
            type="button"
            className={PRIMARY_BUTTON}
            disabled={chosen.length === 0}
            onClick={() => {
              onAdd(chosen);
            }}
          >
            {t('settings.emulators.findDialog.submit', { count: chosen.length })}
          </button>
        </>
      }
    >
      <button type="button" className={SECONDARY_BUTTON} onClick={() => void choose()}>
        {t('settings.emulators.findDialog.choose')}
      </button>
      {state === 'searching' && (
        <p role="status" className="mt-3 text-xs text-slate-400">
          {t('settings.emulators.findDialog.searching')}
        </p>
      )}
      {state === 'done' && found.length === 0 && (
        <p className="mt-3 text-xs text-slate-400">{t('settings.emulators.findDialog.none')}</p>
      )}
      <ul className="mt-3 flex flex-col gap-1">
        {found.map((emulator) => {
          const isKnown = added.has(emulator.executable.toLowerCase());
          const name = presets.find((p) => p.id === emulator.presetId)?.name ?? emulator.presetId;
          return (
            <li key={emulator.executable}>
              <label className="flex items-center gap-2 text-xs text-slate-200">
                <input
                  type="checkbox"
                  disabled={isKnown}
                  checked={checked.has(emulator.executable)}
                  onChange={(event) => {
                    const next = new Set(checked);
                    if (event.target.checked) next.add(emulator.executable);
                    else next.delete(emulator.executable);
                    setChecked(next);
                  }}
                />
                <span className="font-medium text-white">{name}</span>
                <span className="min-w-0 truncate text-slate-400">{emulator.executable}</span>
                {isKnown && (
                  <span className="text-slate-500">{t('settings.emulators.findDialog.added')}</span>
                )}
              </label>
            </li>
          );
        })}
      </ul>
    </Modal>
  );
}
