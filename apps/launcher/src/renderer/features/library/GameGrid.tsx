import { useVirtualizer } from '@tanstack/react-virtual';
import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type MouseEvent,
} from 'react';
import { useTranslation } from 'react-i18next';
import { GameCard } from './GameCard.tsx';
import { gridMove } from './gridNav.ts';
import type { SelectMode, Selection } from './selection.ts';
import type { PagedGames } from './usePagedGames.ts';

/** Smallest card width; the columns stretch to fill the row. */
const MIN_CARD = 170;
const GAP = 12;
/** Box art is about 3:4, plus the title strip. */
const cardHeight = (width: number) => Math.round(width * (4 / 3)) + 28;

interface GameGridProps {
  games: PagedGames;
  selection: Selection;
  focused: number;
  onSelect: (index: number, mode: SelectMode) => void;
  onRange: (first: number, last: number) => void;
  onOpenMenu?: (index: number, point: { x: number; y: number }) => void;
  onActivate?: (index: number) => void;
}

const modeOf = (event: { shiftKey: boolean; ctrlKey: boolean; metaKey: boolean }): SelectMode =>
  event.shiftKey ? 'range' : event.ctrlKey || event.metaKey ? 'toggle' : 'single';

/**
 * The virtualized box-art grid (D62, NFR-PERF-2): the list's multi-select listbox laid out in
 * rows of cards. Arrows move across and between rows (Shift extends), Enter or double-click
 * plays, the ContextMenu key or Shift+F10 opens the menu.
 */
export function GameGrid({
  games,
  selection,
  focused,
  onSelect,
  onRange,
  onOpenMenu,
  onActivate,
}: GameGridProps) {
  const { t } = useTranslation();
  const scroller = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  useLayoutEffect(() => {
    const element = scroller.current;
    if (!element) return;
    setWidth(element.clientWidth);
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(() => {
      setWidth(element.clientWidth);
    });
    observer.observe(element);
    return () => {
      observer.disconnect();
    };
  }, []);
  const total = games.total ?? 0;
  const inner = Math.max(0, width - 2 * GAP);
  const columns = Math.max(1, Math.floor((inner + GAP) / (MIN_CARD + GAP)));
  const cardWidth = Math.max(MIN_CARD, (inner - GAP * (columns - 1)) / columns);
  const rowHeight = cardHeight(cardWidth) + GAP;
  // TanStack Virtual returns functions that can't be auto-memoized; nothing here relies on the
  // React Compiler, so its "incompatible library" notice doesn't apply.
  // eslint-disable-next-line react-hooks/incompatible-library
  const virtualizer = useVirtualizer({
    count: Math.ceil(total / columns),
    getScrollElement: () => scroller.current,
    estimateSize: () => rowHeight,
    overscan: 3,
    initialRect: { width: 800, height: 600 },
  });
  useEffect(() => {
    virtualizer.measure();
  }, [rowHeight, virtualizer]);
  const rows = virtualizer.getVirtualItems();
  const first = (rows[0]?.index ?? 0) * columns;
  const lastRow = rows.at(-1)?.index;
  const last = lastRow === undefined ? -1 : Math.min(total - 1, (lastRow + 1) * columns - 1);
  useEffect(() => {
    onRange(first, last);
  }, [first, last, onRange]);

  const openMenuAt = (index: number) => {
    const card = document.getElementById(`library-game-${String(index)}`);
    const box = card?.getBoundingClientRect();
    onOpenMenu?.(index, { x: (box?.left ?? 0) + 24, y: box?.bottom ?? 0 });
  };
  const onKeyDown = (event: KeyboardEvent) => {
    const next = gridMove(focused, event.key, columns, total);
    if (next !== null) {
      if (total === 0) return;
      onSelect(next, event.shiftKey ? 'range' : 'single');
      virtualizer.scrollToIndex(Math.floor(next / columns));
    } else if (event.key === 'Enter') {
      if (focused >= 0) onActivate?.(focused);
    } else if (event.key === 'ContextMenu' || (event.key === 'F10' && event.shiftKey)) {
      if (focused >= 0) openMenuAt(focused);
    } else return;
    event.preventDefault();
  };

  return (
    // The scroller is always there, so its width is measured before the first page arrives.
    <div ref={scroller} className="flex-1 overflow-y-auto">
      {games.isLoading ? (
        <p className="p-6 text-sm text-slate-500">{t('library.list.loading')}</p>
      ) : total === 0 ? (
        <p className="p-6 text-sm text-slate-500">{t('library.list.empty')}</p>
      ) : (
        <div
          role="listbox"
          tabIndex={0}
          aria-label={t('library.list.label')}
          aria-multiselectable="true"
          aria-activedescendant={focused >= 0 ? `library-game-${String(focused)}` : undefined}
          onKeyDown={onKeyDown}
          className="relative focus-visible:outline-none"
          style={{ height: virtualizer.getTotalSize() + GAP }}
        >
          {rows.flatMap((row) =>
            Array.from({ length: columns }, (_, column) => {
              const index = row.index * columns + column;
              const game = index < total ? games.rowAt(index) : undefined;
              if (!game) return null;
              return (
                <GameCard
                  key={game.id}
                  game={game}
                  index={index}
                  selected={selection.ids.has(game.id)}
                  focused={index === focused}
                  style={{
                    left: GAP + column * (cardWidth + GAP),
                    top: GAP + row.start,
                    width: cardWidth,
                    height: rowHeight - GAP,
                  }}
                  onClick={(event: MouseEvent) => {
                    onSelect(index, modeOf(event));
                  }}
                  onDoubleClick={() => {
                    onActivate?.(index);
                  }}
                  onContextMenu={(event) => {
                    event.preventDefault();
                    if (!selection.ids.has(game.id)) onSelect(index, 'single');
                    onOpenMenu?.(index, { x: event.clientX, y: event.clientY });
                  }}
                />
              );
            }),
          )}
        </div>
      )}
    </div>
  );
}
