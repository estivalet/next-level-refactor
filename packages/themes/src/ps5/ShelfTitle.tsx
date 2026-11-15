// FR-THM-1: the PS5 home's short-name badge and full name beside the focused shelf tile.
import { useLayoutEffect, useRef, useState } from 'react';
import { cn } from '../components/cn.ts';

/** The PS5 home shelf's geometry, shared by ShelfRow and the title's placement. */
export const PS5_SHELF = { itemWidth: 104, focusedWidth: 150, gap: 16, leadingInset: 64 } as const;

/** Space between the tile and the title (matches `.ps5-title` in hero.css). */
const TITLE_GAP = 18;
/** Space kept clear at the shelf's edge. */
const EDGE = 24;
/** Below this much room on the right, the title goes on the tile's left. */
const MIN_ROOM = 200;
const MAX_WIDTH = 640;

interface Placement {
  side: 'right' | 'left';
  maxWidth: number | null;
}

/**
 * Where the title fits, from the shelf's final layout (window start, focused slot, shelf width)
 * rather than on-screen rects, which move while the shelf slides. Null when the shelf has no
 * width yet (jsdom, first paint).
 */
function place(el: HTMLElement): Placement | null {
  const slot = el.closest<HTMLElement>('[data-virtual]');
  const shelf = el.closest<HTMLElement>('[data-window-start]');
  const width = shelf?.clientWidth ?? 0;
  if (!slot || !shelf || width <= 0) return null;
  const offset = Number(slot.dataset.virtual) - Number(shelf.dataset.windowStart);
  const tileLeft = PS5_SHELF.leadingInset + offset * (PS5_SHELF.itemWidth + PS5_SHELF.gap);
  const right = width - (tileLeft + PS5_SHELF.focusedWidth + TITLE_GAP) - EDGE;
  if (right >= MIN_ROOM) return { side: 'right', maxWidth: Math.min(right, MAX_WIDTH) };
  const left = tileLeft - TITLE_GAP - EDGE;
  return { side: 'left', maxWidth: Math.max(0, Math.min(left, MAX_WIDTH)) };
}

export function ShelfTitle({
  shortName,
  name,
  measureKey,
}: {
  shortName?: string | undefined;
  name: string;
  /** Changes when the shelf's layout may have changed (focus, item count). */
  measureKey: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [placement, setPlacement] = useState<Placement>({ side: 'right', maxWidth: null });

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => {
      const next = place(el);
      if (!next) return;
      setPlacement((prev) =>
        prev.side === next.side && prev.maxWidth === next.maxWidth ? prev : next,
      );
    };
    measure();
    window.addEventListener('resize', measure);
    return () => {
      window.removeEventListener('resize', measure);
    };
  }, [measureKey]);

  return (
    <div
      ref={ref}
      className={cn('ps5-title', placement.side === 'left' && 'ps5-title--left')}
      style={placement.maxWidth === null ? undefined : { maxWidth: placement.maxWidth }}
    >
      {shortName && <span className="ps5-title-badge">{shortName.toUpperCase()}</span>}
      <span className="ps5-title-name">{name}</span>
    </div>
  );
}
