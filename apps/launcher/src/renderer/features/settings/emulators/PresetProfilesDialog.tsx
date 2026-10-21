import type { PresetProfile } from '@nextlevel/shared';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { INPUT, Modal, PRIMARY_BUTTON, SECONDARY_BUTTON } from '../../library/Modal.tsx';
import { VirtualRows } from './VirtualRows.tsx';

/** Add from preset (FR-EMU-7): the preset profiles this emulator doesn't have yet. */
export function PresetProfilesDialog({
  presetName,
  profiles,
  onAdd,
  onClose,
}: {
  presetName: string;
  profiles: readonly PresetProfile[];
  onAdd: (presetProfileIds: string[]) => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const [query, setQuery] = useState('');
  const [checked, setChecked] = useState<ReadonlySet<string>>(new Set());
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  const shown = profiles.filter((p) => {
    const text = `${p.name} ${p.id} ${p.systems.join(' ')}`.toLowerCase();
    return words.every((word) => text.includes(word));
  });

  return (
    <Modal
      title={t('settings.emulators.presetDialog.title', { name: presetName })}
      onClose={onClose}
      footer={
        <>
          <button type="button" className={SECONDARY_BUTTON} onClick={onClose}>
            {t('settings.emulators.cancel')}
          </button>
          <button
            type="button"
            className={PRIMARY_BUTTON}
            disabled={checked.size === 0}
            onClick={() => {
              onAdd([...checked]);
            }}
          >
            {t('settings.emulators.presetDialog.submit', { count: checked.size })}
          </button>
        </>
      }
    >
      {profiles.length === 0 ? (
        <p className="text-xs text-slate-400">{t('settings.emulators.presetDialog.none')}</p>
      ) : (
        <>
          <input
            type="search"
            value={query}
            aria-label={t('settings.emulators.presetDialog.search')}
            placeholder={t('settings.emulators.presetDialog.search')}
            onChange={(event) => {
              setQuery(event.target.value);
            }}
            className={`${INPUT} mb-2`}
          />
          <VirtualRows
            items={shown}
            label={t('settings.emulators.presetDialog.search')}
            rowHeight={32}
            maxHeight={320}
            getKey={(profile) => profile.id}
            renderRow={(profile) => (
              <label className="flex min-w-0 items-center gap-2 px-1 text-xs text-slate-200">
                <input
                  type="checkbox"
                  checked={checked.has(profile.id)}
                  onChange={(event) => {
                    const next = new Set(checked);
                    if (event.target.checked) next.add(profile.id);
                    else next.delete(profile.id);
                    setChecked(next);
                  }}
                />
                <span className="truncate">{profile.name}</span>
                <span className="shrink-0 text-slate-500">
                  {t('settings.emulators.systemCount', { count: profile.systems.length })}
                </span>
              </label>
            )}
          />
        </>
      )}
    </Modal>
  );
}
