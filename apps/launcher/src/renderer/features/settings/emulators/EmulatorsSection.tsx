import { removeProfile, type Settings } from '@nextlevel/shared';
import { ArrowLeft } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { SettingsSection } from '../form/SettingsSection.tsx';
import type { SettingsDraft } from '../form/useSettingsDraft.ts';
import { useFocusRequest, type FocusRequest } from '../focusRequest.ts';
import { EmulatorDetail } from './EmulatorDetail.tsx';
import { EmulatorDialogs, type Dialog } from './EmulatorDialogs.tsx';
import { EmulatorList, type EmulatorRow } from './EmulatorList.tsx';
import { byName, needsAttention } from './emulatorSearch.ts';
import { newId, pickExecutable, usePresets } from './emulatorsApi.ts';
import { MountToolField } from './MountToolField.tsx';
import { ProfileEditor } from './ProfileEditor.tsx';

/** The errors under `prefix`, keyed by the rest of the path. */
function scoped(errors: Record<string, string>, prefix: string): Record<string, string> {
  return Object.fromEntries(
    Object.entries(errors)
      .filter(([path]) => path.startsWith(prefix))
      .map(([path, key]) => [path.slice(prefix.length), key]),
  );
}

/**
 * Settings → Emulators (FR-EMU-2, FR-EMU-7, US-D1): the emulators A–Z on the left, the selected
 * one's program and profiles on the right; a profile's editor replaces the profile list.
 * `focus` opens that profile's editor (US-C2: "Fix in Settings").
 */
export function EmulatorsSection({ focus }: { focus?: FocusRequest }) {
  return <SettingsSection>{(draft) => <EmulatorsPage {...draft} focus={focus} />}</SettingsSection>;
}

function EmulatorsPage({
  draft,
  update,
  errors,
  focus,
}: Pick<SettingsDraft, 'draft' | 'update' | 'errors'> & { focus: FocusRequest | undefined }) {
  const { t } = useTranslation();
  const presets = usePresets().data ?? [];
  const [dialog, setDialog] = useState<Dialog | null>(null);
  const [editingId, setEditingId] = useState<string | null>(focus?.id ?? null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  useFocusRequest(focus, setEditingId);

  // A newly added emulator (Add, Find) becomes the selected one.
  const ids = draft.emulators.map((e) => e.id);
  const [knownIds, setKnownIds] = useState(ids);
  if (ids.join() !== knownIds.join()) {
    const added = ids.find((id) => !knownIds.includes(id));
    setKnownIds(ids);
    if (added) {
      setSelectedId(added);
      setEditingId(null);
    }
  }

  const close = () => {
    setDialog(null);
  };
  const apply = (change: (settings: Settings) => Settings) => {
    update(change);
    close();
  };

  const rows: EmulatorRow[] = draft.emulators
    .map((emulator, index) => {
      const profileIndices = draft.profiles.flatMap((p, i) =>
        p.emulatorId === emulator.id ? [i] : [],
      );
      return {
        emulator,
        profileCount: profileIndices.length,
        attention: needsAttention(errors, index, profileIndices),
      };
    })
    .sort((a, b) => byName(a.emulator, b.emulator));

  const editingIndex = draft.profiles.findIndex((p) => p.id === editingId);
  const editing = draft.profiles[editingIndex];
  // The editor's emulator wins (Fix in Settings); a stale choice falls back to the first A–Z.
  const current =
    draft.emulators.find((e) => e.id === editing?.emulatorId) ??
    draft.emulators.find((e) => e.id === selectedId) ??
    rows[0]?.emulator;
  const currentIndex = draft.emulators.findIndex((e) => e.id === current?.id);
  const profileErrors = scoped(errors, `profiles.${String(editingIndex)}.`);
  const emulatorErrors = scoped(errors, `emulators.${String(currentIndex)}.`);

  return (
    <div className="flex min-h-full gap-5">
      <EmulatorList
        rows={rows}
        selectedId={current?.id ?? null}
        onSelect={(id) => {
          setSelectedId(id);
          setEditingId(null);
        }}
        onAdd={() => {
          setDialog({ kind: 'add' });
        }}
        onFind={() => {
          setDialog({ kind: 'find' });
        }}
        tools={<MountToolField path={draft.tools.squashfsMount} update={update} />}
      />
      <div className="flex min-w-0 flex-1 flex-col gap-3 py-4">
        {!current && <p className="text-sm text-slate-300">{t('settings.emulators.intro')}</p>}
        {current && editing && (
          <>
            <button
              type="button"
              onClick={() => {
                setEditingId(null);
              }}
              className="flex items-center gap-1.5 self-start rounded-md px-1 py-0.5 text-xs text-slate-400 hover:text-white focus-visible:ring-2 focus-visible:ring-white/60 focus-visible:outline-none"
            >
              <ArrowLeft aria-hidden="true" className="h-3.5 w-3.5" />
              {t('settings.emulators.back', { name: current.name })}
            </button>
            <ProfileEditor
              key={editing.id}
              profile={editing}
              emulator={current}
              errors={profileErrors}
              valid={
                Object.keys(profileErrors).length === 0 && Object.keys(emulatorErrors).length === 0
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
          </>
        )}
        {current && !editing && (
          <EmulatorDetail
            key={current.id}
            emulator={current}
            profiles={draft.profiles.filter((p) => p.emulatorId === current.id)}
            hasPreset={presets.some((p) => p.id === current.presetId)}
            onChangeProgram={() => {
              void pickExecutable(t('settings.emulators.pickTitle')).then((path) => {
                if (!path) return;
                update((s) => ({
                  ...s,
                  emulators: s.emulators.map((e) =>
                    e.id === current.id ? { ...e, executable: path } : e,
                  ),
                }));
              });
            }}
            onAddFromPreset={() => {
              setDialog({ kind: 'preset', emulatorId: current.id });
            }}
            onNewProfile={() => {
              const id = newId();
              update((s) => ({
                ...s,
                profiles: [
                  ...s.profiles,
                  {
                    id,
                    name: current.name,
                    emulatorId: current.id,
                    systems: [],
                    args: ['{rom}'],
                    archives: 'pass',
                    squashfs: 'pass',
                    entries: [],
                    pointerExtensions: [],
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
              setDialog({ kind: 'delete', emulatorId: current.id });
            }}
          />
        )}
      </div>
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
}
