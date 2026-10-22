import type { GameRow, SearchResult } from '@nextlevel/shared';
import { useVirtualizer } from '@tanstack/react-virtual';
import { Search } from 'lucide-react';
import { useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { keyStep } from './selection.ts';

const ROW_HEIGHT = 44;

interface SearchResultsProps {
  result: SearchResult | undefined;
  selectedId: number | null;
  onSelect: (gameId: number) => void;
  /** Enter or double-click on a hit (US-C2: Play). */
  onActivate: (game: GameRow) => void;
  systemName: (systemId: string) => string;
}

/** Global search hits from every system (US-C3), virtualized, with each game's system. */
export function SearchResults(props: SearchResultsProps) {
  const { result, selectedId, onSelect, onActivate, systemName } = props;
  const { t } = useTranslation();
  const scroller = useRef<HTMLDivElement>(null);
  const games = result?.games ?? [];
  // TanStack Virtual returns functions that can't be auto-memoized; nothing here relies on the
  // React Compiler, so its "incompatible library" notice doesn't apply.
  // eslint-disable-next-line react-hooks/incompatible-library
  const virtualizer = useVirtualizer({
    count: games.length,
    getScrollElement: () => scroller.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 10,
    initialRect: { width: 640, height: 480 },
  });
  const selectedIndex = games.findIndex((game) => game.id === selectedId);
  if (!result) return <p className="p-6 text-sm text-slate-500">{t('library.list.loading')}</p>;
  if (games.length === 0)
    return <p className="p-6 text-sm text-slate-500">{t('library.search.none')}</p>;
  return (
    <>
      <p className="shrink-0 px-4 pt-3 text-[10px] tracking-wider text-slate-500 uppercase">
        {result.more
          ? t('library.search.more', { count: games.length })
          : t('library.search.count', { count: games.length })}
      </p>
      <div ref={scroller} className="flex-1 overflow-y-auto p-2">
        <div
          role="listbox"
          tabIndex={0}
          aria-label={t('library.search.results')}
          aria-activedescendant={
            selectedIndex >= 0 ? `search-result-${String(selectedIndex)}` : undefined
          }
          onKeyDown={(event) => {
            const current = games[selectedIndex];
            if (event.key === 'Enter' && current) {
              event.preventDefault();
              onActivate(current);
              return;
            }
            const next = keyStep(event.key, selectedIndex, games.length);
            const game = next === null ? undefined : games[next];
            if (next === null || !game) return;
            event.preventDefault();
            onSelect(game.id);
            virtualizer.scrollToIndex(next);
          }}
          className="relative focus-visible:outline-none"
          style={{ height: virtualizer.getTotalSize() }}
        >
          {virtualizer.getVirtualItems().map((item) => {
            const game = games[item.index];
            if (!game) return null;
            const selected = game.id === selectedId;
            return (
              <div
                key={game.id}
                id={`search-result-${String(item.index)}`}
                role="option"
                aria-selected={selected}
                onClick={() => {
                  onSelect(game.id);
                }}
                onDoubleClick={() => {
                  onActivate(game);
                }}
                className={`absolute left-0 flex w-full cursor-default items-center gap-3 rounded-lg border px-4 ${
                  selected
                    ? 'border-violet-500/20 bg-violet-500/10'
                    : 'border-transparent hover:bg-white/5'
                } ${game.missing ? 'opacity-40 grayscale' : ''}`}
                style={{ top: item.start, height: ROW_HEIGHT - 4 }}
              >
                <Search aria-hidden="true" className="h-3.5 w-3.5 shrink-0 text-violet-400/60" />
                <span className="flex-1 truncate text-sm text-slate-300">{game.title}</span>
                <span className="shrink-0 text-xs text-slate-500">{systemName(game.systemId)}</span>
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}
