import type { EmulatorPreset } from '@nextlevel/shared';
import { useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal, PRIMARY_BUTTON, SECONDARY_BUTTON } from '../../library/Modal.tsx';
import { pickExecutable } from './emulatorsApi.ts';

const CUSTOM = '';

/** The preset whose program has this file name, ignoring case. */
export function presetFor(
  presets: readonly EmulatorPreset[],
  executable: string,
): EmulatorPreset | undefined {
  const name = (executable.split(/[\\/]/).pop() ?? '').toLowerCase();
  return presets.find((preset) => preset.executableNames.some((n) => n.toLowerCase() === name));
}

/** Add emulator (US-D1): choose a preset, or Custom, and the emulator's program. */
export function AddEmulatorDialog({
  presets,
  onAdd,
  onClose,
}: {
  presets: readonly EmulatorPreset[];
  onAdd: (input: { preset: EmulatorPreset | undefined; executable: string }) => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const name = useId();
  const [presetId, setPresetId] = useState(CUSTOM);
  const [executable, setExecutable] = useState<string | null>(null);
  const preset = presets.find((p) => p.id === presetId);
  const suggested = executable ? presetFor(presets, executable) : undefined;
  const choose = async () => {
    const path = await pickExecutable(t('settings.emulators.pickTitle'));
    if (path) setExecutable(path);
  };

  return (
    <Modal
      title={t('settings.emulators.addDialog.title')}
      onClose={onClose}
      footer={
        <>
          <button type="button" className={SECONDARY_BUTTON} onClick={onClose}>
            {t('settings.emulators.cancel')}
          </button>
          <button
            type="button"
            className={PRIMARY_BUTTON}
            disabled={!executable}
            onClick={() => {
              if (executable) onAdd({ preset, executable });
            }}
          >
            {t('settings.emulators.addDialog.submit')}
          </button>
        </>
      }
    >
      <fieldset className="mb-4">
        <legend className="mb-2 text-[11px] text-slate-400">
          {t('settings.emulators.addDialog.preset')}
        </legend>
        <div className="grid grid-cols-2 gap-1">
          {[{ id: CUSTOM, name: t('settings.emulators.addDialog.custom') }, ...presets].map((p) => (
            <label
              key={p.id}
              className={`flex items-center gap-2 rounded-md px-2 py-1 text-xs text-slate-200 hover:bg-white/5 ${p.id === CUSTOM ? 'col-span-2' : ''}`}
            >
              <input
                type="radio"
                name={name}
                checked={presetId === p.id}
                onChange={() => {
                  setPresetId(p.id);
                }}
              />
              {p.name}
            </label>
          ))}
        </div>
      </fieldset>
      <p className="mb-1 text-[11px] text-slate-400">{t('settings.emulators.addDialog.program')}</p>
      <div className="flex items-center gap-2">
        <button type="button" className={SECONDARY_BUTTON} onClick={() => void choose()}>
          {t('settings.emulators.addDialog.choose')}
        </button>
        <span className="min-w-0 truncate text-xs text-slate-300">
          {executable ?? t('settings.emulators.addDialog.none')}
        </span>
      </div>
      {suggested && suggested.id !== presetId && (
        <p className="mt-3 flex flex-wrap items-center gap-2 text-xs text-amber-200">
          {t('settings.emulators.addDialog.suggest', { name: suggested.name })}
          <button
            type="button"
            className={SECONDARY_BUTTON}
            onClick={() => {
              setPresetId(suggested.id);
            }}
          >
            {t('settings.emulators.addDialog.usePreset', { name: suggested.name })}
          </button>
        </p>
      )}
    </Modal>
  );
}
