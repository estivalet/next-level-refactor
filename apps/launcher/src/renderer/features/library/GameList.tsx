import { useVirtualizer } from '@tanstack/react-virtual';
import { useEffect, useRef, type KeyboardEvent, type MouseEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { GameRow } from './GameRow.tsx';
import type { SelectMode, Selection } from './selection.ts';
import type { PagedGames } from './usePagedGames.ts';

const ROW_HEIGHT = 44;
const PAGE_ROWS = 10;

interface GameListProps {
  games: PagedGames;
  selection: Selection;
  focused: number;
  onSelect: (index: number, mode: SelectMode) => void;
  onRange: (first: number, last: number) => void;
  /** Opens the context menu for the focused row at a screen point. */
  onOpenMenu?: (index: number, point: { x: number; y: number }) => void;
  /** Enter or double-click on a row (US-C2: Play). */
  onActivate?: (index: number) => void;
}

const modeOf = (event: { shiftKey: boolean; ctrlKey: boolean; metaKey: boolean }): SelectMode =>
  event.shiftKey ? 'range' : event.ctrlKey || event.metaKey ? 'toggle' : 'single';

/**
 * The virtualized game list (S7, NFR-PERF-2): a multi-select listbox. Arrows, Home/End and
 * PageUp/PageDown move (Shift extends), Ctrl/⌘-click toggles, the ContextMenu key or Shift+F10
 * opens the menu, Enter or double-click activates (plays) a row.
 */
export function GameList({
  games,
  selection,
  focused,
  onSelect,
  onRange,
  onOpenMenu,
  onActivate,
}: GameListProps) {
  const { t } = useTranslation();
  const scroller = useRef<HTMLDivElement>(null);
  const total = games.total ?? 0;
  // TanStack Virtual returns functions that can't be auto-memoized; nothing here relies on the
  // React Compiler, so its "incompatible library" notice doesn't apply.
  // eslint-disable-next-line react-hooks/incompatible-library
  const virtualizer = useVirtualizer({
    count: total,
    getScrollElement: () => scroller.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 10,
    initialRect: { width: 640, height: 480 },
  });
  const items = virtualizer.getVirtualItems();
  const first = items[0]?.index ?? 0;
  const last = items.at(-1)?.index ?? -1;
  useEffect(() => {
    onRange(first, last);
  }, [first, last, onRange]);

  const moveTo = (index: number, shift: boolean) => {
    const next = Math.min(total - 1, Math.max(0, index));
    if (next < 0) return;
    onSelect(next, shift ? 'range' : 'single');
    virtualizer.scrollToIndex(next);
  };
  const openMenuAt = (index: number) => {
    const row = document.getElementById(`library-game-${String(index)}`);
    const box = row?.getBoundingClientRect();
    onOpenMenu?.(index, { x: (box?.left ?? 0) + 24, y: box?.bottom ?? 0 });
  };
  const onKeyDown = (event: KeyboardEvent) => {
    const steps: Record<string, number> = {
      ArrowDown: 1,
      ArrowUp: -1,
      PageDown: PAGE_ROWS,
      PageUp: -PAGE_ROWS,
    };
    const step = steps[event.key];
    if (step !== undefined) moveTo(focused + step, event.shiftKey);
    else if (event.key === 'Home') moveTo(0, event.shiftKey);
    else if (event.key === 'End') moveTo(total - 1, event.shiftKey);
    else if (event.key === 'Enter') {
      if (focused >= 0) onActivate?.(focused);
    } else if (event.key === 'ContextMenu' || (event.key === 'F10' && event.shiftKey)) {
      if (focused >= 0) openMenuAt(focused);
    } else return;
    event.preventDefault();
  };

  if (games.isLoading) {
    return <p className="p-6 text-sm text-slate-500">{t('library.list.loading')}</p>;
  }
  if (total === 0) {
    return <p className="p-6 text-sm text-slate-500">{t('library.list.empty')}</p>;
  }
  return (
    <div ref={scroller} className="flex-1 overflow-y-auto p-2">
      <div
        role="listbox"
        tabIndex={0}
        aria-label={t('library.list.label')}
        aria-multiselectable="true"
        aria-activedescendant={focused >= 0 ? `library-game-${String(focused)}` : undefined}
        onKeyDown={onKeyDown}
        className="relative focus-visible:outline-none"
        style={{ height: virtualizer.getTotalSize() }}
      >
        {items.map((item) => {
          const game = games.rowAt(item.index);
          if (!game) return null;
          const pick = (event: MouseEvent) => {
            onSelect(item.index, modeOf(event));
          };
          return (
            <GameRow
              key={item.key}
              game={game}
              index={item.index}
              selected={selection.ids.has(game.id)}
              focused={item.index === focused}
              top={item.start}
              height={ROW_HEIGHT}
              onClick={pick}
              onDoubleClick={() => {
                onActivate?.(item.index);
              }}
              onContextMenu={(event) => {
                event.preventDefault();
                if (!selection.ids.has(game.id)) onSelect(item.index, 'single');
                onOpenMenu?.(item.index, { x: event.clientX, y: event.clientY });
              }}
            />
          );
        })}
      </div>
    </div>
  );
}
