import {
  addEmulator,
  addPresetProfiles,
  remainingPresetProfiles,
  removeEmulator,
  type EmulatorPreset,
  type Settings,
} from '@nextlevel/shared';
import { useTranslation } from 'react-i18next';
import { Modal, PRIMARY_BUTTON, SECONDARY_BUTTON } from '../../library/Modal.tsx';
import { AddEmulatorDialog } from './AddEmulatorDialog.tsx';
import { newId } from './emulatorsApi.ts';
import { FindEmulatorsDialog } from './FindEmulatorsDialog.tsx';
import { PresetProfilesDialog } from './PresetProfilesDialog.tsx';

export type Dialog =
  | { kind: 'add' }
  | { kind: 'find' }
  | { kind: 'preset'; emulatorId: string }
  | { kind: 'delete'; emulatorId: string };

/** The Emulators section's dialogs; `apply` changes the draft and closes the dialog. */
export function EmulatorDialogs({
  dialog,
  draft,
  presets,
  apply,
  onClose,
}: {
  dialog: Dialog;
  draft: Settings;
  presets: readonly EmulatorPreset[];
  apply: (change: (settings: Settings) => Settings) => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const target =
    'emulatorId' in dialog ? draft.emulators.find((e) => e.id === dialog.emulatorId) : undefined;
  const targetPreset = presets.find((p) => p.id === target?.presetId);
  const targetProfiles = draft.profiles.filter((p) => p.emulatorId === target?.id);
  const close = onClose;

  return (
    <>
      {dialog.kind === 'add' && (
        <AddEmulatorDialog
          presets={presets}
          onAdd={({ preset, executable }) => {
            apply((s) => addEmulator(s, { preset, executable, newId }));
          }}
          onClose={close}
        />
      )}
      {dialog.kind === 'find' && (
        <FindEmulatorsDialog
          presets={presets}
          known={draft.emulators.map((e) => e.executable)}
          onAdd={(found) => {
            apply((s) =>
              found.reduce(
                (next, { presetId, executable }) =>
                  addEmulator(next, {
                    preset: presets.find((p) => p.id === presetId),
                    executable,
                    newId,
                  }),
                s,
              ),
            );
          }}
          onClose={close}
        />
      )}
      {dialog.kind === 'preset' && target && targetPreset && (
        <PresetProfilesDialog
          presetName={targetPreset.name}
          profiles={remainingPresetProfiles(targetPreset, target.id, draft.profiles)}
          onAdd={(ids) => {
            apply((s) => addPresetProfiles(s, target.id, ids, targetPreset, newId));
          }}
          onClose={close}
        />
      )}
      {dialog.kind === 'delete' && target && (
        <Modal
          title={t('settings.emulators.confirmDelete', {
            name: target.name,
            count: targetProfiles.length,
          })}
          onClose={close}
          footer={
            <>
              <button type="button" className={SECONDARY_BUTTON} onClick={close}>
                {t('settings.emulators.cancel')}
              </button>
              <button
                type="button"
                className={PRIMARY_BUTTON}
                onClick={() => {
                  apply((s) => removeEmulator(s, target.id));
                }}
              >
                {t('settings.emulators.delete', { name: target.name })}
              </button>
            </>
          }
        >
          {null}
        </Modal>
      )}
    </>
  );
}
