import type { Settings } from '@nextlevel/shared';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { PRIMARY_BUTTON, SECONDARY_BUTTON } from '../../library/Modal.tsx';
import { SettingsSection } from '../form/SettingsSection.tsx';
import { EmulatorCard } from './EmulatorCard.tsx';
import { newId, pickExecutable, usePresets } from './emulatorsApi.ts';
import { EmulatorDialogs, type Dialog } from './EmulatorDialogs.tsx';
import { removeProfile } from './fromPreset.ts';
import { ProfileEditor } from './ProfileEditor.tsx';

/** The errors under `prefix`, keyed by the rest of the path. */
function scoped(errors: Record<string, string>, prefix: string): Record<string, string> {
  return Object.fromEntries(
    Object.entries(errors)
      .filter(([path]) => path.startsWith(prefix))
      .map(([path, key]) => [path.slice(prefix.length), key]),
  );
}

/** Settings → Emulators (FR-EMU-2, FR-EMU-7, US-D1): emulators, their profiles and presets. */
export function EmulatorsSection() {
  const { t } = useTranslation();
  const presets = usePresets().data ?? [];
  const [dialog, setDialog] = useState<Dialog | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const close = () => {
    setDialog(null);
  };

  return (
    <SettingsSection>
      {({ draft, update, errors }) => {
        const apply = (change: (settings: Settings) => Settings) => {
          update(change);
          close();
        };
        const emulator = (id: string) => draft.emulators.find((e) => e.id === id);
        const presetOf = (id: string) => presets.find((p) => p.id === emulator(id)?.presetId);
        const editingIndex = draft.profiles.findIndex((p) => p.id === editingId);
        const editing = draft.profiles[editingIndex];
        const editingEmulatorIndex = draft.emulators.findIndex((e) => e.id === editing?.emulatorId);
        const editingEmulator = draft.emulators[editingEmulatorIndex];
        const profileErrors = scoped(errors, `profiles.${String(editingIndex)}.`);
        const emulatorErrors = scoped(errors, `emulators.${String(editingEmulatorIndex)}.`);

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
            {editing && editingEmulator && (
              <ProfileEditor
                key={editing.id}
                profile={editing}
                emulator={editingEmulator}
                errors={profileErrors}
                valid={
                  Object.keys(profileErrors).length === 0 &&
                  Object.keys(emulatorErrors).length === 0
                }
                onChange={(change) => {
                  update((s) => ({
                    ...s,
                    profiles: s.profiles.map((p) => (p.id === editing.id ? change(p) : p)),
                  }));
                }}
                onClose={() => {
                  setEditingId(null);
                }}
              />
            )}
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
            {dialog && (
              <EmulatorDialogs
                dialog={dialog}
                draft={draft}
                presets={presets}
                apply={apply}
                onClose={close}
              />
            )}
          </div>
        );
      }}
    </SettingsSection>
  );
}
