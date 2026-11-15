import { SYSTEM_KINDS, type SystemInfoSummary } from '@nextlevel/shared';
import { useTranslation } from 'react-i18next';

export interface SystemFilter {
  text: string;
  kind: string;
}

/** Rows matching the text (name or manufacturer) and the kind ('' = any). */
export function filterSystems(
  systems: readonly SystemInfoSummary[],
  { text, kind }: SystemFilter,
): SystemInfoSummary[] {
  const needle = text.trim().toLowerCase();
  return systems.filter(
    (system) =>
      (kind === '' || system.kind === kind) &&
      (needle === '' ||
        system.name.toLowerCase().includes(needle) ||
        (system.manufacturer ?? '').toLowerCase().includes(needle)),
  );
}

interface Props {
  systems: readonly SystemInfoSummary[];
  filter: SystemFilter;
  onFilter: (filter: SystemFilter) => void;
  selectedId: string | null;
  onSelect: (systemId: string) => void;
}

const field =
  'rounded border border-slate-700 bg-slate-900 px-2 py-1 text-xs text-slate-200 outline-none focus:border-sky-500';

/** The Museum's left column: search, kind filter and one row per system (FR-MUS-2). */
export function SystemList({ systems, filter, onFilter, selectedId, onSelect }: Props) {
  const { t } = useTranslation();
  const rows = filterSystems(systems, filter);
  return (
    <div className="flex h-full w-72 shrink-0 flex-col border-r border-slate-800">
      <div className="flex flex-col gap-2 border-b border-slate-800 p-2">
        <input
          type="search"
          className={field}
          aria-label={t('apps.museum.search')}
          placeholder={t('apps.museum.search')}
          value={filter.text}
          onChange={(event) => {
            onFilter({ ...filter, text: event.target.value });
          }}
        />
        <select
          className={field}
          aria-label={t('apps.museum.kind')}
          value={filter.kind}
          onChange={(event) => {
            onFilter({ ...filter, kind: event.target.value });
          }}
        >
          <option value="">{t('apps.museum.kindAll')}</option>
          {SYSTEM_KINDS.map((kind) => (
            <option key={kind} value={kind}>
              {t(`settings.systems.custom.kinds.${kind}`)}
            </option>
          ))}
        </select>
      </div>
      <ul className="min-h-0 flex-1 overflow-y-auto" aria-label={t('apps.museum.listLabel')}>
        {rows.length === 0 && (
          <li className="p-3 text-xs text-slate-500">{t('apps.museum.noMatches')}</li>
        )}
        {rows.map((system) => {
          const detail = [system.manufacturer, system.releaseYear].filter(Boolean).join(' · ');
          const selected = system.systemId === selectedId;
          return (
            <li key={system.systemId}>
              <button
                type="button"
                aria-current={selected}
                className={`flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-slate-800 ${
                  selected ? 'bg-slate-800' : ''
                }`}
                onClick={() => {
                  onSelect(system.systemId);
                }}
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm text-slate-100">{system.name}</span>
                  {detail && (
                    <span className="block truncate text-xs text-slate-500">{detail}</span>
                  )}
                </span>
                {system.edited && (
                  <span
                    role="img"
                    aria-label={t('apps.museum.edited')}
                    title={t('apps.museum.edited')}
                    className="h-2 w-2 shrink-0 rounded-full bg-sky-400"
                  />
                )}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
