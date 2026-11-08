import type { Emulator } from '@nextlevel/shared';
import { AlertTriangle, Search } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { INPUT, PRIMARY_BUTTON, SECONDARY_BUTTON } from '../../library/Modal.tsx';
import { matchesSearch } from './emulatorSearch.ts';

export interface EmulatorRow {
  emulator: Emulator;
  profileCount: number;
  attention: boolean;
}

/** Left pane of Settings → Emulators (FR-EMU-2): search, the emulators A–Z, add, tools. */
export function EmulatorList({
  rows,
  selectedId,
  onSelect,
  onAdd,
  onFind,
  tools,
}: {
  /** Already sorted A–Z. */
  rows: readonly EmulatorRow[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onAdd: () => void;
  onFind: () => void;
  tools: ReactNode;
}) {
  const { t } = useTranslation();
  const [query, setQuery] = useState('');
  const shown = rows.filter((row) => matchesSearch(row.emulator.name, query));

  return (
    <div className="flex w-60 shrink-0 flex-col gap-2 border-r border-white/5 py-4 pr-4">
      <div className="relative">
        <Search
          aria-hidden="true"
          className="pointer-events-none absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2 text-slate-500"
        />
        <input
          type="search"
          value={query}
          aria-label={t('settings.emulators.search')}
          placeholder={t('settings.emulators.search')}
          onChange={(event) => {
            setQuery(event.target.value);
          }}
          className={`${INPUT} pl-8`}
        />
      </div>
      {rows.length === 0 ? (
        <p className="px-1 text-xs text-slate-400">{t('settings.emulators.empty')}</p>
      ) : shown.length === 0 ? (
        <p className="px-1 text-xs text-slate-400">{t('settings.emulators.noMatch')}</p>
      ) : (
        <ul
          aria-label={t('settings.emulators.list')}
          className="flex max-h-[55vh] flex-col gap-0.5 overflow-y-auto"
        >
          {shown.map(({ emulator, profileCount, attention }) => (
            <li key={emulator.id}>
              <button
                type="button"
                aria-current={emulator.id === selectedId ? 'true' : undefined}
                onClick={() => {
                  onSelect(emulator.id);
                }}
                className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-xs text-slate-300 hover:bg-white/10 focus-visible:ring-2 focus-visible:ring-white/60 focus-visible:outline-none aria-[current=true]:bg-white/15 aria-[current=true]:text-white"
              >
                <span className="min-w-0 flex-1 truncate">{emulator.name}</span>
                {attention && (
                  <AlertTriangle
                    aria-label={t('settings.emulators.attention')}
                    className="h-3.5 w-3.5 shrink-0 text-amber-400"
                  />
                )}
                <span className="shrink-0 text-[11px] text-slate-500">{profileCount}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="flex flex-col gap-1.5 pt-1">
        <button type="button" className={PRIMARY_BUTTON} onClick={onAdd}>
          {t('settings.emulators.add')}
        </button>
        <button type="button" className={SECONDARY_BUTTON} onClick={onFind}>
          {t('settings.emulators.find')}
        </button>
      </div>
      <div className="mt-2 border-t border-white/5 pt-3">
        <h4 className="mb-2 text-[11px] font-semibold tracking-wide text-slate-400 uppercase">
          {t('settings.emulators.tools')}
        </h4>
        {tools}
      </div>
    </div>
  );
}
