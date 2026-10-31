import type { GameFacets, GameTab } from '@nextlevel/shared';
import {
  AlertTriangle,
  Clock,
  EyeOff,
  Heart,
  LayoutGrid,
  SearchCheck,
  Trophy,
  type LucideIcon,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';

const MAIN_TABS: Array<[GameTab, LucideIcon]> = [
  ['all', LayoutGrid],
  ['favorites', Heart],
  ['recent', Clock],
  ['completed', Trophy],
];
const MORE_TABS: Array<[GameTab, LucideIcon]> = [
  ['hidden', EyeOff],
  ['missing', AlertTriangle],
  ['needsReview', SearchCheck],
];

const ITEM =
  'flex w-full items-center gap-2.5 rounded-lg px-3 py-1.5 text-left text-sm transition-colors';
const itemState = (on: boolean) =>
  on ? 'bg-emerald-500/10 text-emerald-300' : 'text-slate-400 hover:bg-white/5 hover:text-white';

/** A filter slug as people read it: a known one translated, else `hack-fix` → "Hack fix". */
function useFilterLabel() {
  const { t } = useTranslation();
  return (slug: string) => {
    const words = slug.replace(/-/g, ' ');
    return t(`frontend.filters.${slug}`, {
      defaultValue: words.charAt(0).toUpperCase() + words.slice(1),
    });
  };
}

interface ScopeSidebarProps {
  tab: GameTab;
  onTab: (tab: GameTab) => void;
  facets: GameFacets | undefined;
  narrow: { filter?: string | undefined; genre?: string | undefined };
  onNarrow: (narrow: { filter?: string | undefined; genre?: string | undefined }) => void;
}

/**
 * The scope view's left column (D62): the tabs, then the scope's filter tags and genres with
 * their counts. A filter or genre narrows the list; picking it again clears it.
 */
export function ScopeSidebar({ tab, onTab, facets, narrow, onNarrow }: ScopeSidebarProps) {
  const { t } = useTranslation();
  const filterLabel = useFilterLabel();
  const tabButton = ([value, Icon]: [GameTab, LucideIcon]) => (
    <button
      key={value}
      type="button"
      aria-pressed={tab === value}
      className={`${ITEM} ${itemState(tab === value)}`}
      onClick={() => {
        onTab(value);
      }}
    >
      <Icon aria-hidden="true" className="h-4 w-4 shrink-0" />
      {t(`library.tabs.${value}`)}
    </button>
  );
  const facetGroup = (
    label: string,
    counted: GameFacets['filters'],
    picked: string | undefined,
    pick: (value: string | undefined) => void,
    show: (value: string) => string,
  ) => {
    // A picked value this tab doesn't have stays listed (count 0), so it can be seen and cleared.
    const items =
      picked === undefined || counted.some((item) => item.value === picked)
        ? counted
        : [...counted, { value: picked, count: 0 }];
    return (
      items.length > 0 && (
        <div role="group" aria-label={label} className="border-t border-white/5 px-2 py-3">
          <h3 className="px-3 pb-1 text-[10px] font-medium tracking-wider text-slate-500 uppercase">
            {label}
          </h3>
          {items.map((item) => (
            <button
              key={item.value}
              type="button"
              aria-pressed={picked === item.value}
              className={`${ITEM} ${itemState(picked === item.value)}`}
              onClick={() => {
                pick(picked === item.value ? undefined : item.value);
              }}
            >
              <span aria-hidden="true" className="h-1.5 w-1.5 shrink-0 rounded-full bg-current" />
              <span className="flex-1 truncate">{show(item.value)}</span>
              <span className="font-mono text-[10px] text-slate-500">
                {item.count.toLocaleString()}
              </span>
            </button>
          ))}
        </div>
      )
    );
  };

  return (
    <aside
      aria-label={t('library.sidebar.label')}
      className="flex w-56 shrink-0 flex-col overflow-y-auto border-r border-white/5 bg-[#111115]"
    >
      <div role="group" aria-label={t('library.tabs.label')} className="space-y-0.5 px-2 py-3">
        {MAIN_TABS.map(tabButton)}
      </div>
      <div className="space-y-0.5 border-t border-white/5 px-2 py-3">
        {MORE_TABS.map(tabButton)}
      </div>
      {facetGroup(
        t('library.sidebar.filters'),
        facets?.filters ?? [],
        narrow.filter,
        (filter) => {
          onNarrow({ ...narrow, filter });
        },
        filterLabel,
      )}
      {facetGroup(
        t('library.sidebar.genres'),
        facets?.genres ?? [],
        narrow.genre,
        (genre) => {
          onNarrow({ ...narrow, genre });
        },
        (genre) => genre,
      )}
    </aside>
  );
}
