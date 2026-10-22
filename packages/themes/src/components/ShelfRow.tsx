// Ported from NextLevelOS src/themes/components/ShelfRow.tsx @ 3d530b7. Mouse (FR-THM-3): a click
// focuses, a double-click activates, the wheel moves focus one step. The clicked copy is kept in
// state instead of a ref read during render.
import { motion } from 'motion/react';
import {
  useEffect,
  useRef,
  useState,
  type ReactNode,
  type WheelEvent as ReactWheelEvent,
} from 'react';
import { carouselSlide } from '../engine/transitions.ts';
import { cn } from './cn.ts';
import { nextVirtual, type PendingSlot } from './VerticalWheel.tsx';

const OVERSCAN = 2;
const FALLBACK_VISIBLE = 6;
const WHEEL_DEBOUNCE_MS = 80;

function wrap(i: number, n: number): number {
  return ((i % n) + n) % n;
}

/**
 * Left-anchored window start: unchanged while `focus` is inside `[prevStart, prevStart +
 * visibleCount)`, otherwise shifted just enough to bring it back in. Positions are virtual, so
 * there is no clamping.
 */
export function shelfWindowStart(prevStart: number, focus: number, visibleCount: number): number {
  const vc = Math.max(1, visibleCount);
  if (focus < prevStart) return focus;
  if (focus > prevStart + vc - 1) return focus - vc + 1;
  return prevStart;
}

export interface ShelfRowProps<T> {
  items: readonly T[];
  focusIndex: number;
  onFocusChange: (index: number) => void;
  onActivate: (index: number) => void;
  renderItem: (args: { item: T; index: number; focused: boolean }) => ReactNode;
  itemWidth: number;
  /** Width of the focused slot (it grows; slots after it shift right). */
  focusedWidth: number;
  gap?: number;
  /** Space before the first visible slot, px. */
  leadingInset?: number;
  /** Infinite scroll: wrap around and repeat items around the ring. Default true. */
  loop?: boolean | undefined;
  /** With `loop`, repeat items only when they overflow (default) or whenever there are 2+. */
  repeat?: 'overflow' | 'always' | undefined;
  /** Slots that fit; measured from the container when omitted. */
  visibleCount?: number | undefined;
  /** Keep the focused item at this slot while items repeat; the shelf slides under it. */
  focusSlot?: number | undefined;
  className?: string;
}

/** Controlled, left-anchored horizontal shelf (PS5-style). Styling is up to `renderItem`. */
export function ShelfRow<T>({
  items,
  focusIndex,
  onFocusChange,
  onActivate,
  renderItem,
  itemWidth,
  focusedWidth,
  gap = 16,
  leadingInset = 0,
  loop = true,
  repeat: repeatMode = 'overflow',
  visibleCount: visibleOverride,
  focusSlot,
  className,
}: ShelfRowProps<T>) {
  const n = items.length;
  const step = itemWidth + gap;
  const extra = Math.max(0, focusedWidth - itemWidth);

  const containerRef = useRef<HTMLDivElement>(null);
  const wheelAt = useRef(0);
  const [measured, setMeasured] = useState(0);
  useEffect(() => {
    if (visibleOverride !== undefined) return;
    const el = containerRef.current;
    if (!el) return;
    const update = () => {
      setMeasured(el.clientWidth);
    };
    update();
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => {
      observer.disconnect();
    };
  }, [visibleOverride]);

  const visibleCount =
    visibleOverride ??
    (measured > 0
      ? Math.max(1, Math.floor((measured - leadingInset - extra + gap) / step))
      : FALLBACK_VISIBLE);
  const repeat = loop && (repeatMode === 'always' ? n > 1 : n > visibleCount);

  const [virtual, setVirtual] = useState(focusIndex);
  const [prevFocus, setPrevFocus] = useState(focusIndex);
  const [prevN, setPrevN] = useState(n);
  const [prevRepeat, setPrevRepeat] = useState(repeat);
  const [start, setStart] = useState(0);
  const [pending, setPending] = useState<PendingSlot | null>(null);
  let v = virtual;
  let baseStart = start;
  if (n !== prevN || repeat !== prevRepeat) {
    setPrevN(n);
    setPrevRepeat(repeat);
    setPrevFocus(focusIndex);
    setVirtual(focusIndex);
    setPending(null);
    // Rebase the window by the same offset so it does not sweep or leave a gap.
    baseStart = repeat
      ? start - (virtual - focusIndex)
      : Math.max(0, Math.min(start, n - visibleCount));
    v = focusIndex;
  } else if (focusIndex !== prevFocus) {
    v = repeat ? nextVirtual(virtual, prevFocus, focusIndex, n, pending) : focusIndex;
    setPrevFocus(focusIndex);
    setVirtual(v);
    setPending(null);
  }

  const nextStart =
    focusSlot !== undefined && repeat
      ? v - Math.min(Math.max(0, focusSlot), visibleCount - 1)
      : shelfWindowStart(baseStart, v, visibleCount);
  if (nextStart !== start) setStart(nextStart);

  if (n === 0) return <div ref={containerRef} className={className} />;

  const slots: { k: number; dataIndex: number }[] = [];
  for (let k = nextStart - OVERSCAN; k <= nextStart + visibleCount + OVERSCAN; k++) {
    if (repeat) slots.push({ k, dataIndex: wrap(k, n) });
    else if (k >= 0 && k < n) slots.push({ k, dataIndex: k });
  }

  const onWheel = (event: ReactWheelEvent<HTMLDivElement>) => {
    const now = Date.now();
    if (now - wheelAt.current < WHEEL_DEBOUNCE_MS) return;
    const delta = Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : event.deltaY;
    if (delta === 0) return;
    wheelAt.current = now;
    const dir = delta > 0 ? 1 : -1;
    const next = loop ? wrap(focusIndex + dir, n) : Math.max(0, Math.min(n - 1, focusIndex + dir));
    if (next !== focusIndex) onFocusChange(next);
  };

  return (
    <div
      ref={containerRef}
      className={cn('relative overflow-hidden', className)}
      data-window-start={nextStart}
      onWheel={onWheel}
    >
      <motion.div
        className="absolute inset-y-0 left-0"
        animate={{ x: leadingInset - nextStart * step }}
        transition={carouselSlide}
      >
        {slots.map(({ k, dataIndex }) => {
          const focused = k === v;
          return (
            <div
              key={k}
              data-slot
              data-index={dataIndex}
              data-virtual={k}
              data-focused={focused ? 'true' : undefined}
              className="absolute top-0 h-full"
              style={{
                left: k * step + (k > v ? extra : 0),
                width: focused ? focusedWidth : itemWidth,
                transition: 'left 180ms ease, width 180ms ease',
              }}
              onClick={() => {
                if (focused) return;
                setPending({ k, from: focusIndex });
                onFocusChange(dataIndex);
              }}
              onDoubleClick={() => {
                onActivate(dataIndex);
              }}
            >
              {renderItem({ item: items[dataIndex] as T, index: dataIndex, focused })}
            </div>
          );
        })}
      </motion.div>
    </div>
  );
}
