import {
  HEALTH_GAPS,
  healthScore,
  type HealthGap,
  type HealthGrade,
  type SystemHealth,
} from '@nextlevel/shared';
import { ArrowLeft } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

type HealthSort = 'grade' | 'name' | 'games';

const GRADE_STYLE: Record<HealthGrade, string> = {
  A: 'bg-emerald-500/20 text-emerald-300',
  B: 'bg-cyan-500/20 text-cyan-300',
  C: 'bg-amber-500/20 text-amber-300',
  D: 'bg-orange-500/20 text-orange-300',
  F: 'bg-red-500/20 text-red-300',
};

const TOOL =
  'flex items-center gap-1.5 rounded-md px-2 py-1 text-xs text-slate-400 hover:bg-white/5 hover:text-white';

interface HealthViewProps {
  systems: SystemHealth[] | undefined;
  systemName: (id: string) => string;
  /** Systems the active menu shows, for "Systems in my menu". */
  menuSystemIds: ReadonlySet<string>;
  onBack: () => void;
  /** Opens the system's games narrowed to the ones lacking `gap`. */
  onShow: (systemId: string, gap: HealthGap) => void;
}

/**
 * System health (owner request 2026-11-02): a grade per system, sortable (worst first by default),
 * and for the selected system what pulls it down, each gap with Show.
 */
export function HealthView({
  systems,
  systemName,
  menuSystemIds,
  onBack,
  onShow,
}: HealthViewProps) {
  const { t } = useTranslation();
  const [sort, setSort] = useState<HealthSort>('grade');
  const [menuOnly, setMenuOnly] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const rows = (systems ?? [])
    .filter((system) => !menuOnly || menuSystemIds.has(system.systemId))
    .map((system) => ({ system, name: systemName(system.systemId), health: healthScore(system) }))
    .sort((a, b) =>
      sort === 'grade'
        ? a.health.score - b.health.score || a.name.localeCompare(b.name)
        : sort === 'games'
          ? b.system.games - a.system.games || a.name.localeCompare(b.name)
          : a.name.localeCompare(b.name),
    );
  const current = rows.find((row) => row.system.systemId === selected) ?? null;
  const percent = (share: number) => `${String(Math.round(share * 100))}%`;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex shrink-0 items-center gap-2 border-b border-white/5 px-4 py-2">
        <button type="button" className={TOOL} onClick={onBack}>
          <ArrowLeft aria-hidden="true" className="h-3.5 w-3.5" />
          {t('library.health.backToMenu')}
        </button>
        <h2 className="flex-1 text-sm font-semibold text-white">{t('library.health.title')}</h2>
        <label className="flex items-center gap-2 text-xs text-slate-400">
          <input
            type="checkbox"
            checked={menuOnly}
            onChange={(event) => {
              setMenuOnly(event.target.checked);
            }}
          />
          {t('library.health.menuOnly')}
        </label>
        <span className="ml-3 text-xs text-slate-500">{t('library.health.sortBy')}</span>
        {(['grade', 'name', 'games'] as const).map((key) => (
          <button
            key={key}
            type="button"
            aria-pressed={sort === key}
            onClick={() => {
              setSort(key);
            }}
            className={`rounded-md px-2 py-1 text-xs ${
              sort === key ? 'bg-white/10 text-white' : 'text-slate-400 hover:bg-white/5'
            }`}
          >
            {t(`library.health.sort.${key}`)}
          </button>
        ))}
      </div>
      <div className="flex min-h-0 flex-1">
        <div className="min-w-0 flex-1 overflow-y-auto p-4">
          <table aria-label={t('library.health.title')} className="w-full text-xs">
            <thead>
              <tr className="text-left text-slate-500">
                <th className="pb-2 font-medium">{t('library.health.system')}</th>
                <th className="pb-2 font-medium">{t('library.health.games')}</th>
                <th className="pb-2 font-medium">{t('library.health.grade')}</th>
                <th className="pb-2 font-medium">{t('library.health.roms')}</th>
                <th className="pb-2 font-medium">{t('library.health.art')}</th>
                <th className="pb-2 font-medium">{t('library.health.details')}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ system, name, health }) => (
                <tr
                  key={system.systemId}
                  aria-selected={selected === system.systemId}
                  className={`border-t border-white/5 ${
                    selected === system.systemId ? 'bg-white/5' : ''
                  }`}
                >
                  <td className="py-1.5 pr-2">
                    <button
                      type="button"
                      onClick={() => {
                        setSelected(system.systemId);
                      }}
                      className="truncate text-left text-slate-200 hover:underline"
                    >
                      {name}
                    </button>
                  </td>
                  <td className="py-1.5 text-slate-400">{system.games}</td>
                  <td className="py-1.5">
                    <span
                      className={`inline-block w-6 rounded text-center font-bold ${GRADE_STYLE[health.grade]}`}
                    >
                      {health.grade}
                    </span>
                    <span className="ml-1.5 text-slate-500">{health.score}</span>
                  </td>
                  {[health.rom, health.art, health.details].map((share, index) => (
                    <td key={index} className="py-1.5">
                      <span
                        aria-hidden="true"
                        className="mr-1.5 inline-block h-1.5 w-14 overflow-hidden rounded-full bg-white/10 align-middle"
                      >
                        <span
                          className="block h-full bg-emerald-400"
                          style={{ width: percent(share) }}
                        />
                      </span>
                      <span className="text-slate-400">{percent(share)}</span>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {current && (
          <aside className="w-72 shrink-0 overflow-y-auto border-l border-white/5 p-4">
            <h3 className="text-sm font-semibold text-white">{current.name}</h3>
            <p className="mt-1 text-xs text-slate-500">
              {t('library.health.score', {
                grade: current.health.grade,
                score: current.health.score,
              })}
            </p>
            <GapList
              system={current.system}
              name={current.name}
              onShow={(gap) => {
                onShow(current.system.systemId, gap);
              }}
            />
          </aside>
        )}
      </div>
    </div>
  );
}

function GapList(props: { system: SystemHealth; name: string; onShow: (gap: HealthGap) => void }) {
  const { system, name, onShow } = props;
  const { t } = useTranslation();
  const label = useGapLabel();
  const gaps = HEALTH_GAPS.filter((gap) => system.lacking[gap] > 0).sort(
    (a, b) => system.lacking[b] - system.lacking[a],
  );
  if (gaps.length === 0) {
    return <p className="mt-4 text-xs text-emerald-300">{t('library.health.nothingMissing')}</p>;
  }
  return (
    <>
      <p className="mt-4 mb-1 text-[11px] text-slate-500">{t('library.health.pullsDown')}</p>
      <ul aria-label={t('library.health.gapsOf', { system: name })} className="flex flex-col">
        {gaps.map((gap) => (
          <li
            key={gap}
            className="flex items-center gap-2 border-b border-white/5 py-1.5 text-xs text-slate-300"
          >
            <span className="flex-1 truncate">{label(gap)}</span>
            <span className="text-slate-500">{system.lacking[gap]}</span>
            <button
              type="button"
              onClick={() => {
                onShow(gap);
              }}
              className="rounded-md px-1.5 py-0.5 text-cyan-300 hover:bg-white/5"
            >
              {t('library.health.show')}
            </button>
          </li>
        ))}
      </ul>
    </>
  );
}

/** "Missing: Box front", "Missing: Year", "Missing: ROM file". */
export function useGapLabel() {
  const { t } = useTranslation();
  return (gap: HealthGap) => {
    const what =
      gap === 'rom'
        ? t('library.health.romFile')
        : gap.startsWith('art:')
          ? t(`settings.themes.options.kinds.${gap.slice(4)}`)
          : t(`library.fields.${gap.slice(6)}`);
    return t('library.health.missing', { what });
  };
}
