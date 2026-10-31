import {
  ArrowLeft,
  ChevronRight,
  Folder,
  Gamepad2,
  Home,
  LayoutGrid,
  List,
  Sparkles,
  type LucideIcon,
} from 'lucide-react';
import type { KeyboardEvent, ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import type { ViewMode } from '../useViewMode.ts';
import type { HomeCard, HomeCardKind, HomeLevel } from './levels.ts';

/** Card tints, by position, like the NextLevelOS library's. */
const TINTS = [
  'from-purple-900/70 to-purple-950/60 border-purple-500/20',
  'from-emerald-900/70 to-emerald-950/60 border-emerald-500/20',
  'from-blue-900/70 to-indigo-950/60 border-blue-500/20',
  'from-rose-900/70 to-rose-950/60 border-rose-500/20',
  'from-amber-900/70 to-orange-950/60 border-amber-500/20',
  'from-cyan-900/70 to-cyan-950/60 border-cyan-500/20',
  'from-orange-900/70 to-red-950/60 border-orange-500/20',
  'from-lime-900/70 to-green-950/60 border-lime-500/20',
];

const ICONS: Record<HomeCardKind, LucideIcon> = {
  category: Folder,
  notInMenu: Folder,
  collections: Folder,
  system: Gamepad2,
  collection: Folder,
  smartFilter: Sparkles,
};

const TOOL =
  'flex items-center gap-1.5 rounded-md px-2 py-1 text-xs text-slate-400 hover:bg-white/5 hover:text-white disabled:pointer-events-none disabled:opacity-30';

interface LibraryHomeProps {
  level: HomeLevel;
  rootTitle: string;
  view: ViewMode;
  onView: (view: ViewMode) => void;
  /** A level card opens deeper, a scope card shows its games. */
  onOpen: (card: HomeCard) => void;
  onPath: (path: string[]) => void;
  /** Controls for the Collections level (New collection, New smart filter). */
  actions?: ReactNode;
}

/** The Library home (D61): the active menu one level at a time, as cards or a list. */
export function LibraryHome({
  level,
  rootTitle,
  view,
  onView,
  onOpen,
  onPath,
  actions,
}: LibraryHomeProps) {
  const { t } = useTranslation();
  const atRoot = level.path.length === 0;
  const back = () => {
    onPath(level.path.slice(0, -1));
  };
  const onKeyDown = (event: KeyboardEvent) => {
    if (event.target instanceof HTMLInputElement) return;
    if (event.key === 'Backspace' || (event.altKey && event.key === 'ArrowLeft')) {
      event.preventDefault();
      if (!atRoot) back();
    }
  };
  const count = (card: HomeCard) =>
    card.scope
      ? t('library.status.games', { count: card.count })
      : t('library.home.items', { count: card.count });

  return (
    <div className="flex min-h-0 flex-1 flex-col" onKeyDown={onKeyDown}>
      <div className="flex shrink-0 items-center gap-2 border-b border-white/5 px-4 py-2">
        <button
          type="button"
          className={TOOL}
          disabled={atRoot}
          onClick={() => {
            onPath([]);
          }}
        >
          <Home aria-hidden="true" className="h-3.5 w-3.5" />
          {t('library.home.home')}
        </button>
        <button type="button" className={TOOL} disabled={atRoot} onClick={back}>
          <ArrowLeft aria-hidden="true" className="h-3.5 w-3.5" />
          {t('library.home.back')}
        </button>
        <nav
          aria-label={t('library.home.trail')}
          className="flex min-w-0 flex-1 items-center gap-1 text-sm"
        >
          <button
            type="button"
            className="truncate font-semibold text-white hover:underline"
            onClick={() => {
              onPath([]);
            }}
          >
            {rootTitle}
          </button>
          {level.trail.map((step, index) => (
            <span key={step.id} className="flex min-w-0 items-center gap-1">
              <ChevronRight aria-hidden="true" className="h-3.5 w-3.5 shrink-0 text-slate-600" />
              <button
                type="button"
                className="truncate font-semibold text-white hover:underline"
                aria-current={index === level.trail.length - 1 ? 'page' : undefined}
                onClick={() => {
                  onPath(level.path.slice(0, index + 1));
                }}
              >
                {step.label}
              </button>
            </span>
          ))}
        </nav>
        {actions}
        <div className="flex rounded-lg bg-white/5 p-0.5">
          {(['grid', 'list'] as const).map((mode) => {
            const Icon = mode === 'grid' ? LayoutGrid : List;
            return (
              <button
                key={mode}
                type="button"
                aria-label={t(`library.view.${mode}`)}
                aria-pressed={view === mode}
                className={`rounded-md p-1.5 ${view === mode ? 'bg-white/10 text-white' : 'text-slate-500 hover:text-white'}`}
                onClick={() => {
                  onView(mode);
                }}
              >
                <Icon aria-hidden="true" className="h-3.5 w-3.5" />
              </button>
            );
          })}
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        {level.cards.length === 0 ? (
          <p className="p-6 text-center text-sm text-slate-500">{t('library.home.empty')}</p>
        ) : (
          <ul
            aria-label={level.title}
            className={
              view === 'grid'
                ? 'grid grid-cols-[repeat(auto-fill,minmax(12rem,1fr))] gap-3'
                : 'flex flex-col gap-1'
            }
          >
            {level.cards.map((card, index) => {
              const Icon = ICONS[card.kind];
              return (
                <li key={card.key}>
                  <button
                    type="button"
                    onClick={() => {
                      onOpen(card);
                    }}
                    className={
                      view === 'grid'
                        ? `group relative flex h-24 w-full flex-col justify-center rounded-xl border bg-gradient-to-br px-4 text-left transition hover:brightness-125 focus-visible:ring-2 focus-visible:ring-white/60 focus-visible:outline-none ${TINTS[index % TINTS.length] ?? ''}`
                        : 'flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left hover:bg-white/5 focus-visible:ring-1 focus-visible:ring-white/40 focus-visible:outline-none'
                    }
                  >
                    <Icon
                      aria-hidden="true"
                      className={
                        view === 'grid'
                          ? 'absolute top-3 right-3 h-4 w-4 text-white/40'
                          : 'h-4 w-4 shrink-0 text-slate-500'
                      }
                    />
                    <span className="truncate text-sm font-semibold text-white">{card.label}</span>
                    <span
                      className={
                        view === 'grid'
                          ? 'text-[10px] font-medium tracking-wider text-white/50 uppercase'
                          : 'ml-auto text-xs text-slate-500'
                      }
                    >
                      {count(card)}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
