import { removeProfile, type Settings } from '@nextlevel/shared';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { PRIMARY_BUTTON, SECONDARY_BUTTON } from '../../library/Modal.tsx';
import { SettingsSection } from '../form/SettingsSection.tsx';
import { EmulatorCard } from './EmulatorCard.tsx';
import { newId, pickExecutable, usePresets } from './emulatorsApi.ts';
import { EmulatorDialogs, type Dialog } from './EmulatorDialogs.tsx';
import { ProfileEditor } from './ProfileEditor.tsx';
import { useFocusRequest, type FocusRequest } from '../focusRequest.ts';

/** The errors under `prefix`, keyed by the rest of the path. */
function scoped(errors: Record<string, string>, prefix: string): Record<string, string> {
  return Object.fromEntries(
    Object.entries(errors)
      .filter(([path]) => path.startsWith(prefix))
      .map(([path, key]) => [path.slice(prefix.length), key]),
  );
}

/**
 * Settings → Emulators (FR-EMU-2, FR-EMU-7, US-D1): emulators, their profiles and presets.
 * `focus` opens that profile's editor (US-C2: "Fix in Settings").
 */
export function EmulatorsSection({ focus }: { focus?: FocusRequest }) {
  const { t } = useTranslation();
  const presets = usePresets().data ?? [];
  const [dialog, setDialog] = useState<Dialog | null>(null);
  const [editingId, setEditingId] = useState<string | null>(focus?.id ?? null);
  useFocusRequest(focus, setEditingId);
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
            <fieldset
              aria-label={t('settings.emulators.mountTool')}
              className="flex flex-col gap-1 rounded-lg border border-white/10 p-3 text-xs"
            >
              <legend className="px-1 text-[11px] text-slate-400">
                {t('settings.emulators.mountTool')}
              </legend>
              <p className="text-[11px] text-slate-500">{t('settings.emulators.mountToolHelp')}</p>
              <div className="flex flex-wrap items-center gap-2">
                {draft.tools.squashfsMount ? (
                  <code className="break-all text-slate-200">{draft.tools.squashfsMount}</code>
                ) : (
                  <span className="text-slate-400">{t('settings.emulators.mountToolAuto')}</span>
                )}
                <button
                  type="button"
                  className={SECONDARY_BUTTON}
                  onClick={() => {
                    void pickExecutable(t('settings.emulators.mountToolPick')).then((path) => {
                      if (!path) return;
                      update((s) => ({ ...s, tools: { ...s.tools, squashfsMount: path } }));
                    });
                  }}
                >
                  {t('settings.emulators.mountToolChoose')}
                </button>
                {draft.tools.squashfsMount && (
                  <button
                    type="button"
                    className={SECONDARY_BUTTON}
                    onClick={() => {
                      update((s) => ({ ...s, tools: { ...s.tools, squashfsMount: null } }));
                    }}
                  >
                    {t('settings.emulators.mountToolClear')}
                  </button>
                )}
              </div>
            </fieldset>
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
                          squashfs: 'pass',
                          entries: [],
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
