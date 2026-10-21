import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { INPUT } from '../../library/Modal.tsx';
import { useSystemCatalog } from '../settingsApi.ts';
import { filterSystems } from '../systems/filterSystems.ts';
import { VirtualRows } from './VirtualRows.tsx';

/** The systems a profile runs (FR-EMU-2): a searchable, virtualized checkbox list. */
export function SystemPicker({
  selected,
  onChange,
}: {
  selected: readonly string[];
  onChange: (systems: string[]) => void;
}) {
  const { t } = useTranslation();
  const catalog = useSystemCatalog().data ?? [];
  const [query, setQuery] = useState('');
  const chosen = new Set(selected);
  const shown = filterSystems(catalog, query, {}, 'all').sort(
    (a, b) => Number(chosen.has(b.id)) - Number(chosen.has(a.id)),
  );

  return (
    <fieldset className="flex flex-col gap-1">
      <legend className="mb-1 text-[11px] text-slate-400">
        {t('settings.emulators.editor.systems')}
      </legend>
      <div className="flex items-center gap-2">
        <input
          type="search"
          value={query}
          aria-label={t('settings.emulators.editor.systemsSearch')}
          placeholder={t('settings.emulators.editor.systemsSearch')}
          onChange={(event) => {
            setQuery(event.target.value);
          }}
          className={INPUT}
        />
        <span role="status" className="shrink-0 text-[11px] text-slate-400">
          {t('settings.emulators.editor.systemsSelected', { count: selected.length })}
        </span>
      </div>
      <div className="rounded-lg border border-white/10">
        <VirtualRows
          items={shown}
          label={t('settings.emulators.editor.systems')}
          rowHeight={28}
          maxHeight={168}
          getKey={(system) => system.id}
          renderRow={(system) => (
            <label className="flex min-w-0 items-center gap-2 px-2 text-xs text-slate-200">
              <input
                type="checkbox"
                checked={chosen.has(system.id)}
                onChange={(event) => {
                  onChange(
                    event.target.checked
                      ? [...selected, system.id]
                      : selected.filter((id) => id !== system.id),
                  );
                }}
              />
              <span className="truncate">{system.name}</span>
            </label>
          )}
        />
      </div>
    </fieldset>
  );
}
