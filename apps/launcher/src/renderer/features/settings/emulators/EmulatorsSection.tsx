import type { Settings } from '@nextlevel/shared';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal, PRIMARY_BUTTON, SECONDARY_BUTTON } from '../../library/Modal.tsx';
import { SettingsSection } from '../form/SettingsSection.tsx';
import { AddEmulatorDialog } from './AddEmulatorDialog.tsx';
import { EmulatorCard } from './EmulatorCard.tsx';
import { newId, pickExecutable, usePresets } from './emulatorsApi.ts';
import { FindEmulatorsDialog } from './FindEmulatorsDialog.tsx';
import {
  addEmulator,
  addPresetProfiles,
  remainingPresetProfiles,
  removeEmulator,
  removeProfile,
} from './fromPreset.ts';
import { PresetProfilesDialog } from './PresetProfilesDialog.tsx';

type Dialog =
  | { kind: 'add' }
  | { kind: 'find' }
  | { kind: 'preset'; emulatorId: string }
  | { kind: 'delete'; emulatorId: string };

/** Settings → Emulators (FR-EMU-2, FR-EMU-7, US-D1): emulators, their profiles and presets. */
export function EmulatorsSection() {
  const { t } = useTranslation();
  const presets = usePresets().data ?? [];
  const [dialog, setDialog] = useState<Dialog | null>(null);
  const [, setEditingId] = useState<string | null>(null);
  const close = () => {
    setDialog(null);
  };

  return (
    <SettingsSection>
      {({ draft, update }) => {
        const apply = (change: (settings: Settings) => Settings) => {
          update(change);
          close();
        };
        const emulator = (id: string) => draft.emulators.find((e) => e.id === id);
        const presetOf = (id: string) => presets.find((p) => p.id === emulator(id)?.presetId);
        const target = dialog && 'emulatorId' in dialog ? emulator(dialog.emulatorId) : undefined;
        const targetPreset = target ? presetOf(target.id) : undefined;
        const targetProfiles = draft.profiles.filter((p) => p.emulatorId === target?.id);

        return (
          <div className="flex flex-col gap-3 py-4">
            <p className="text-sm text-slate-300">{t('settings.emulators.intro')}</p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className={PRIMARY_BUTTON}
                onClick={() => {
                  setDialog({ kind: 'add' });
                }}
              >
                {t('settings.emulators.add')}
              </button>
              <button
                type="button"
                className={SECONDARY_BUTTON}
                onClick={() => {
                  setDialog({ kind: 'find' });
                }}
              >
                {t('settings.emulators.find')}
              </button>
            </div>
            {draft.emulators.length === 0 && (
              <p className="text-sm text-slate-400">{t('settings.emulators.empty')}</p>
            )}
            <ul aria-label={t('settings.emulators.list')} className="flex flex-col gap-3">
              {draft.emulators.map((item) => (
                <EmulatorCard
                  key={item.id}
                  emulator={item}
                  profiles={draft.profiles.filter((p) => p.emulatorId === item.id)}
                  hasPreset={presetOf(item.id) !== undefined}
                  onChangeProgram={() => {
                    void pickExecutable(t('settings.emulators.pickTitle')).then((path) => {
                      if (!path) return;
                      update((s) => ({
                        ...s,
                        emulators: s.emulators.map((e) =>
                          e.id === item.id ? { ...e, executable: path } : e,
                        ),
                      }));
                    });
                  }}
                  onAddFromPreset={() => {
                    setDialog({ kind: 'preset', emulatorId: item.id });
                  }}
                  onNewProfile={() => {
                    const id = newId();
                    update((s) => ({
                      ...s,
                      profiles: [
                        ...s.profiles,
                        {
                          id,
                          name: item.name,
                          emulatorId: item.id,
                          systems: [],
                          args: ['{rom}'],
                          archives: 'pass',
                          env: {},
                        },
                      ],
                    }));
                    setEditingId(id);
                  }}
                  onEditProfile={setEditingId}
                  onDeleteProfile={(id) => {
                    update((s) => removeProfile(s, id));
                  }}
                  onDelete={() => {
                    setDialog({ kind: 'delete', emulatorId: item.id });
                  }}
                />
              ))}
            </ul>
            {dialog?.kind === 'add' && (
              <AddEmulatorDialog
                presets={presets}
                onAdd={({ preset, executable }) => {
                  apply((s) => addEmulator(s, { preset, executable, newId }));
                }}
                onClose={close}
              />
            )}
            {dialog?.kind === 'find' && (
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
            {dialog?.kind === 'preset' && target && targetPreset && (
              <PresetProfilesDialog
                presetName={targetPreset.name}
                profiles={remainingPresetProfiles(targetPreset, target.id, draft.profiles)}
                onAdd={(ids) => {
                  apply((s) => addPresetProfiles(s, target.id, ids, targetPreset, newId));
                }}
                onClose={close}
              />
            )}
            {dialog?.kind === 'delete' && target && (
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
          </div>
        );
      }}
    </SettingsSection>
  );
}
