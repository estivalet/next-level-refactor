// Ported from NextLevelOS src/themes/components/GameGrid.tsx @ 3d530b7: cells are ThemeGames keyed
// by id. Mouse (FR-THM-3): a click focuses, a double-click plays, the wheel moves focus one row.
import type { ThemeGame } from '@nextlevel/shared';
import { observeElementRect, useVirtualizer } from '@tanstack/react-virtual';
import {
  useEffect,
  useRef,
  useState,
  type ReactNode,
  type WheelEvent as ReactWheelEvent,
} from 'react';
import { cn } from './cn.ts';

const WHEEL_DEBOUNCE_MS = 80;

export interface GameGridProps {
  games: readonly ThemeGame[];
  focusIndex: number;
  onFocusChange: (index: number) => void;
  onActivate: (index: number) => void;
  renderCell: (args: { game: ThemeGame; index: number; focused: boolean }) => ReactNode;
  /** Fixed number of columns; index math lives in engine/gridMath. */
  columns: number;
  /** Row height in px. With `cellAspect`, used only until the width is measured. */
  rowHeight: number;
  /** Cell width ÷ height. When set, row height follows the measured column width (1 = square). */
  cellAspect?: number;
  /** Gap between rows and columns in px. Default 16. */
  gap?: number;
  className?: string;
}

/** Controlled, row-virtualized grid. Visual styling is entirely up to `renderCell`. */
export function GameGrid({
  games,
  focusIndex,
  onFocusChange,
  onActivate,
  renderCell,
  columns,
  rowHeight: fallbackRowHeight,
  cellAspect,
  gap = 16,
  className,
}: GameGridProps) {
  const parentRef = useRef<HTMLDivElement>(null);
  const sizerRef = useRef<HTMLDivElement>(null);
  const wheelAt = useRef(0);
  const cols = Math.max(1, Math.floor(columns));
  const rowCount = Math.ceil(games.length / cols);

  // Content width of the scroll area, tracked only when rows follow it.
  const [contentWidth, setContentWidth] = useState(0);
  useEffect(() => {
    const el = sizerRef.current;
    if (!cellAspect || !el) return;
    const update = () => {
      setContentWidth(el.clientWidth);
    };
    update();
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => {
      observer.disconnect();
    };
  }, [cellAspect]);

  const colWidth = (contentWidth - gap * (cols - 1)) / cols;
  const rowHeight =
    cellAspect && colWidth > 0 ? Math.round(colWidth / cellAspect) : fallbackRowHeight;

  // eslint-disable-next-line react-hooks/incompatible-library -- the virtualizer is read only here, never memoized across renders
  const virt = useVirtualizer({
    count: rowCount,
    getScrollElement: () => parentRef.current,
    estimateSize: () => rowHeight + gap,
    overscan: 3,
    // An unmeasured (0px) viewport renders nothing at all; treat it as one row tall so the first
    // rows (plus overscan) mount until a real size is observed.
    observeElementRect: (instance, cb) =>
      observeElementRect(instance, (rect) => {
        cb({ width: rect.width, height: rect.height || rowHeight });
      }),
  });

  // Cached row sizes are stale once the row height changes (e.g. the window was resized).
  useEffect(() => {
    virt.measure();
  }, [rowHeight, gap, virt]);

  const focusRow = Math.floor(focusIndex / cols);
  useEffect(() => {
    if (rowCount > 0) virt.scrollToIndex(Math.min(focusRow, rowCount - 1), { align: 'auto' });
  }, [focusRow, rowCount, virt]);

  const onWheel = (event: ReactWheelEvent<HTMLDivElement>) => {
    event.preventDefault();
    const now = Date.now();
    if (now - wheelAt.current < WHEEL_DEBOUNCE_MS || event.deltaY === 0) return;
    wheelAt.current = now;
    const next = focusIndex + (event.deltaY > 0 ? cols : -cols);
    if (next < 0) return;
    const clamped = Math.min(next, games.length - 1);
    if (clamped !== focusIndex) onFocusChange(clamped);
  };

  return (
    <div ref={parentRef} data-grid className={cn('overflow-y-auto', className)} onWheel={onWheel}>
      <div ref={sizerRef} style={{ height: virt.getTotalSize(), position: 'relative' }}>
        {virt.getVirtualItems().map((row) => (
          <div
            key={row.key}
            role="row"
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: rowHeight,
              transform: `translateY(${String(row.start)}px)`,
              display: 'grid',
              gridTemplateColumns: `repeat(${String(cols)}, minmax(0, 1fr))`,
              // An implicit `auto` row grows to fit tall content and spills into the next row.
              gridTemplateRows: 'minmax(0, 1fr)',
              columnGap: gap,
            }}
          >
            {Array.from({ length: cols }, (_, c) => {
              const index = row.index * cols + c;
              const game = games[index];
              if (!game) return <div key={`empty-${String(c)}`} />;
              const focused = index === focusIndex;
              return (
                <div
                  key={game.id}
                  data-index={index}
                  data-focused={focused ? 'true' : undefined}
                  className="h-full min-h-0 min-w-0"
                  onClick={() => {
                    if (!focused) onFocusChange(index);
                  }}
                  onDoubleClick={() => {
                    onActivate(index);
                  }}
                >
                  {renderCell({ game, index, focused })}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
