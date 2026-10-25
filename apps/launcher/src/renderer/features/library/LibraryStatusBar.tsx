import { GAME_SORTS, GAME_TABS, type GameSort, type GameTab } from '@nextlevel/shared';
import { useTranslation } from 'react-i18next';

interface LibraryStatusBarProps {
  games: number;
  missing: number;
  /** Games needing review (system scope; FR-SCR-2). */
  review?: number;
  tab: GameTab;
  onTab: (tab: GameTab) => void;
  /** Absent for a collection, whose order is its own setting. */
  sort?: GameSort;
  onSort?: (sort: GameSort) => void;
  scopeName: string;
}

const SELECT =
  'rounded-md border border-white/10 bg-black/40 px-2 py-0.5 text-xs text-slate-300 focus:border-emerald-500/50 focus:outline-none';

/** S7 status bar: counts, the tab filter, the sort and what is shown. */
export function LibraryStatusBar(props: LibraryStatusBarProps) {
  const { t } = useTranslation();
  const counts = [t('library.status.games', { count: props.games })];
  if (props.missing > 0) counts.push(t('library.status.missing', { count: props.missing }));
  if (props.review) counts.push(t('library.status.review', { count: props.review }));
  return (
    <div className="flex shrink-0 items-center gap-4 border-t border-white/5 bg-[#111115] px-4 py-2 text-xs text-slate-500">
      <span>{counts.join(' · ')}</span>
      <label className="flex items-center gap-2">
        {t('library.tabs.label')}
        <select
          className={SELECT}
          value={props.tab}
          onChange={(event) => {
            props.onTab(event.target.value as GameTab);
          }}
        >
          {GAME_TABS.map((tab) => (
            <option key={tab} value={tab}>
              {t(`library.tabs.${tab}`)}
            </option>
          ))}
        </select>
      </label>
      {props.sort && props.onSort && (
        <label className="flex items-center gap-2">
          {t('library.sort.label')}
          <select
            className={SELECT}
            value={props.sort}
            onChange={(event) => {
              props.onSort?.(event.target.value as GameSort);
            }}
          >
            {GAME_SORTS.map((sort) => (
              <option key={sort} value={sort}>
                {t(`library.sort.${sort}`)}
              </option>
            ))}
          </select>
        </label>
      )}
      <span className="ml-auto truncate">{props.scopeName}</span>
    </div>
  );
}
