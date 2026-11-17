import { SYSTEM_KINDS, type SystemInfoSummary } from '@nextlevel/shared';
import { House } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { HardwareImage } from './HardwareImage.tsx';

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

/** "manufacturer · year", leaving out what is unknown. */
export function systemDetail(system: SystemInfoSummary): string {
  return [system.manufacturer, system.releaseYear].filter(Boolean).join(' · ');
}

interface Props {
  systems: readonly SystemInfoSummary[];
  filter: SystemFilter;
  onFilter: (filter: SystemFilter) => void;
  /** The open system; null while Home is open. */
  selectedId: string | null;
  onSelect: (systemId: string) => void;
  onHome: () => void;
}

/** A menu item; the current one is a filled pill (FR-MUS-9). */
const item = (current: boolean) =>
  `flex w-full min-w-0 items-center gap-3 rounded-lg px-3 py-2 text-left ${
    current ? 'bg-white text-slate-900' : 'text-slate-200 hover:bg-white/10'
  }`;

const field =
  'rounded border border-slate-700 bg-slate-900 px-2 py-1 text-xs text-slate-200 outline-none focus:border-sky-500';

/**
 * The Museum's left menu (FR-MUS-2, FR-MUS-9): Home, then search, kind filter and one row per
 * system.
 */
export function SystemList({ systems, filter, onFilter, selectedId, onSelect, onHome }: Props) {
  const { t } = useTranslation();
  const rows = filterSystems(systems, filter);
  const home = selectedId === null;
  return (
    <nav
      aria-label={t('apps.museum.title')}
      className="flex h-full w-72 min-w-0 shrink-0 flex-col border-r border-slate-800"
    >
      <div className="flex flex-col gap-2 border-b border-slate-800 p-2">
        <button
          type="button"
          aria-current={home ? 'page' : undefined}
          className={`${item(home)} text-sm font-medium`}
          onClick={onHome}
        >
          <House aria-hidden="true" className="h-4 w-4 shrink-0" />
          <span className="truncate">{t('apps.museum.home')}</span>
        </button>
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
      <ul
        className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto p-2"
        aria-label={t('apps.museum.listLabel')}
      >
        {rows.length === 0 && (
          <li className="p-3 text-xs text-slate-500">{t('apps.museum.noMatches')}</li>
        )}
        {rows.map((system) => {
          const detail = systemDetail(system);
          const selected = system.systemId === selectedId;
          return (
            <li key={system.systemId}>
              <button
                type="button"
                aria-current={selected ? 'page' : undefined}
                className={item(selected)}
                onClick={() => {
                  onSelect(system.systemId);
                }}
              >
                <HardwareImage name={system.name} size="thumb" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm">{system.name}</span>
                  {detail && (
                    <span
                      className={`block truncate text-xs ${
                        selected ? 'text-slate-600' : 'text-slate-500'
                      }`}
                    >
                      {detail}
                    </span>
                  )}
                </span>
                {system.edited && (
                  <span
                    role="img"
                    aria-label={t('apps.museum.edited')}
                    title={t('apps.museum.edited')}
                    className="h-2 w-2 shrink-0 rounded-full bg-sky-500"
                  />
                )}
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
